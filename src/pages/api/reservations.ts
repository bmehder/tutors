/// <reference types="astro/client" />
import type { APIRoute } from 'astro'
import { CheckoutError } from '../../server/checkout-errors'
import { reserveCheckout, type RequestedSession } from '../../server/checkout-reservations'
import { reconcileExpiredHolds, releaseExpiredSandboxCheckout } from '../../server/checkout-holds'
import { bookingClock, calendarWeekday, sessionInterval } from '../../lib/session-time'
import { sandboxCheckoutSession, confirmSandboxCheckout, stripe } from '../../server/stripe-sandbox'
import { pool, tutorHours } from '../../server/tutor-hours'
import { familyBookingIssue } from '../../server/booking-validation'
import { getSecret } from 'astro:env/server'
import { checkoutDiscount } from '../../server/discounts'
import { enforceRequestLimit, requestAddress, RequestLimitError } from '../../server/request-limits'

export const prerender = false

function reply(status: number, body: object, retryAfterSeconds?: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...(retryAfterSeconds ? { 'Retry-After': String(retryAfterSeconds) } : {}) } })
}

function parseSessions(input: unknown): RequestedSession[] | null {
  if (!Array.isArray(input) || input.length < 1 || input.length > 20) return null
  const sessions: RequestedSession[] = []
  for (const value of input) {
    if (!value || typeof value !== 'object') return null
    const { tutorId, studentId, studentName, subject, date, start } = value
    if (typeof tutorId !== 'string' || tutorId.length > 200 || typeof studentId !== 'string' || !studentId || studentId.length > 200 ||
        typeof subject !== 'string' || subject.length > 200 || typeof date !== 'string' || typeof start !== 'number') return null
    const slot = sessionInterval({ date, start, duration: 60 })
    if (slot.kind !== 'resolved') return null
    if (sessions.some(other => (other.studentId === studentId || other.tutorId === tutorId) &&
        other.start < slot.end && slot.start < other.end)) return null
    sessions.push({ tutorId, studentId, studentName: typeof studentName === 'string' ? studentName.trim().slice(0, 200) || null : null,
      subject, date, startMinute: start, start: slot.start, end: slot.end })
  }
  return sessions
}

export const POST: APIRoute = async context => {
  const { request } = context
  if (!import.meta.env.DEV && !stripe) return reply(403, { error: 'Online bookings are currently closed.' })
  if (!pool) return reply(503, { error: 'Reservations are temporarily unavailable.' })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return reply(400, { error: 'Invalid reservation request.' })
  try {
    if (typeof body.id === 'string' && /^[0-9a-f-]{36}$/i.test(body.id)) {
      const result = await pool.query(
        `UPDATE booking_reservations SET confirmed_at = COALESCE(confirmed_at, now())
         WHERE id = $1 AND NOT COALESCE((to_jsonb(booking_reservations)->>'stripe_checkout_required')::boolean, false) AND checkout_released_at IS NULL AND (confirmed_at IS NOT NULL OR expires_at > now()) RETURNING id`, [body.id],
      )
      return result.rowCount ? reply(200, { id: body.id }) : reply(409, { error: 'Your reservation expired. Please try again.' })
    }
    await enforceRequestLimit(pool, 'reservation', requestAddress(context))
    const stripeRequired = Boolean(stripe)
    if (body.checkout === 'stripe' && !stripeRequired)
      return reply(503, { error: 'Stripe sandbox checkout is temporarily unavailable.' })
    if (typeof body.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId))
      return reply(400, { error: 'Refresh this page before starting checkout.' })
    const sessions = parseSessions(body.sessions)
    if (!sessions) return reply(400, { error: 'Some sessions are no longer valid. Please review your schedule.' })
    const subtotal = new Map([[5, 30000], [10, 55000], [20, 100000]]).get(body.packageHours)
    if (!subtotal || sessions.length > body.packageHours)
      return reply(400, { error: 'Invalid package.' })
    const familyIssue = familyBookingIssue(body.packageHours, sessions)
    if (familyIssue) return reply(400, { error: familyIssue })
    const familyName = typeof body.familyName === 'string' ? body.familyName.trim() : ''
    if (!familyName || familyName.length > 200) return reply(400, { error: 'Enter a valid family contact name.' })
    const contactEmail = typeof body.contactEmail === 'string' ? body.contactEmail.trim() : ''
    const contactPhone = typeof body.contactPhone === 'string' ? body.contactPhone.trim() : ''
    const digits = contactPhone.replace(/\D/g, '')
    if (stripeRequired && (
      contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) ||
      contactPhone.length > 40 || !/^\+?[\d(). -]+$/.test(contactPhone) ||
      digits.length < 7 || digits.length > 15
    )) return reply(400, { error: 'Enter a valid email address and phone number.' })
    let timeZone = 'America/New_York'
    if (typeof body.timeZone === 'string' && body.timeZone.length <= 100) {
      try {
        timeZone = new Intl.DateTimeFormat('en', { timeZone: body.timeZone }).resolvedOptions().timeZone
      } catch {
        return reply(400, { error: 'Choose a valid time zone.' })
      }
    }
    await reconcileExpiredHolds([...new Set(sessions.map(session => session.tutorId))])
    const reservation = await reserveCheckout({
      requestId: body.requestId, packageHours: body.packageHours, discountRequested: body.demoDiscount === true,
      familyName, contactEmail, contactPhone, timeZone, origin: new URL(request.url).origin, stripeRequired, sessions,
    }, async db => {
      const tutors = await tutorHours(false, db)
      const { now, noticeMs } = bookingClock()
      if (sessions.some(session => {
        const tutor = tutors.find(tutor => tutor.id === session.tutorId)
        return !tutor || !tutor.subjects.includes(session.subject) || session.start < now + noticeMs ||
          !tutor.startsByDay[calendarWeekday(session.date)].includes(session.startMinute)
      })) throw new CheckoutError(400, 'invalid_sessions', 'Some sessions are no longer valid. Please review your schedule.')
      const discountResult = checkoutDiscount(subtotal, body.demoDiscount === true, {
        paymentMode: stripeRequired ? 'sandbox' : 'mock',
        sandboxDiscountsEnabled: getSecret('SANDBOX_DISCOUNTS_ENABLED') === '1',
      })
      if (discountResult.kind === 'unavailable') throw new CheckoutError(400, 'invalid_discount', discountResult.message)
      return { subtotal, discount: discountResult.amountCents }
    })
    const { id } = reservation
    if (!stripeRequired) return reply(201, { id })
    if (reservation.kind === 'confirmed' && reservation.checkoutId)
      return reply(200, { id, checkoutUrl: '/checkout/stripe?session_id=' + encodeURIComponent(reservation.checkoutId) })
    try {
      const session = await sandboxCheckoutSession(id)
      if (session.status === 'expired') {
        await releaseExpiredSandboxCheckout(session)
        throw new CheckoutError(409, 'checkout_expired', 'Your checkout hold expired. Please review the available times and try again.')
      }
      if (session.status === 'complete' && await confirmSandboxCheckout(session))
        return reply(200, { id, checkoutUrl: '/checkout/stripe?session_id=' + encodeURIComponent(session.id) })
      if (session.status !== 'open' || !session.url) throw new Error('Checkout is not open.')
      return reply(201, { id, checkoutUrl: session.url })
    } catch (error) {
      if (error instanceof CheckoutError) throw error
      // A lost Stripe response may still have created a payable checkout.
      // Keep its hold and request identity so a retry recovers that same checkout.
      return reply(503, { error: 'Stripe checkout could not start. Please try again; your existing checkout will be reused.' })
    }
  } catch (error) {
    if (error instanceof CheckoutError) return reply(error.status, { error: error.message, code: error.code })
    if (error instanceof RequestLimitError) return reply(429, { error: error.message }, error.retryAfterSeconds)
    return reply(503, { error: 'Reservations are temporarily unavailable. Please try again.' })
  }
}
