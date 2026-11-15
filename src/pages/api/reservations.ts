/// <reference types="astro/client" />
import type { APIRoute } from 'astro'
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { bookingClock, calendarWeekday, sessionInterval } from '../../lib/session-time'
import { createSandboxCheckout, stripe } from '../../server/stripe-sandbox'
import { pool, tutorHours } from '../../server/tutor-hours'

export const prerender = false

function reply(status: number, body: object) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function validateSessions(input: unknown, tutors: Awaited<ReturnType<typeof tutorHours>>) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 20) return null
  const { now, noticeMs } = bookingClock()
  const sessions: { tutorId: string; studentId: string; studentName: string | null; subject: string; start: number; end: number }[] = []
  for (const value of input) {
    if (!value || typeof value !== 'object') return null
    const { tutorId, studentId, studentName, subject, date, start } = value
    if (typeof tutorId !== 'string' || typeof studentId !== 'string' || !studentId ||
        typeof subject !== 'string' || typeof date !== 'string' || typeof start !== 'number') return null
    const tutor = tutors.find(tutor => tutor.id === tutorId)
    const slot = sessionInterval({ date, start, duration: 60 })
    if (!tutor || !tutor.subjects.includes(subject) || slot.kind !== 'resolved' ||
        slot.start < now + noticeMs || !tutor.startsByDay[calendarWeekday(date)].includes(start)) return null
    if (sessions.some(other => (other.studentId === studentId || other.tutorId === tutorId) &&
        other.start < slot.end && slot.start < other.end)) return null
    sessions.push({ tutorId, studentId, studentName: typeof studentName === 'string' ? studentName.trim().slice(0, 200) || null : null, subject, start: slot.start, end: slot.end })
  }
  return sessions.sort((a, b) => a.tutorId.localeCompare(b.tutorId) || a.start - b.start)
}

export const POST: APIRoute = async ({ request }) => {
  if (!pool) return reply(503, { error: 'Reservations are temporarily unavailable.' })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return reply(400, { error: 'Invalid reservation request.' })
  try {
    if (typeof body.id === 'string' && /^[0-9a-f-]{36}$/i.test(body.id)) {
      const result = await pool.query(
        `UPDATE booking_reservations SET confirmed_at = COALESCE(confirmed_at, now())
         WHERE id = $1 AND NOT COALESCE((to_jsonb(booking_reservations)->>'stripe_checkout_required')::boolean, false) AND (confirmed_at IS NOT NULL OR expires_at > now()) RETURNING id`, [body.id],
      )
      return result.rowCount ? reply(200, { id: body.id }) : reply(409, { error: 'Your reservation expired. Please try again.' })
    }
    const stripeRequired = Boolean(stripe)
    if (body.checkout === 'stripe' && !stripeRequired)
      return reply(503, { error: 'Stripe sandbox checkout is temporarily unavailable.' })
    const sessions = validateSessions(body.sessions, await tutorHours())
    if (!sessions) return reply(400, { error: 'Some sessions are no longer valid. Please review your schedule.' })
    const subtotal = new Map([[5, 40000], [10, 75000], [20, 140000]]).get(body.packageHours)
    if (!subtotal || sessions.length > body.packageHours)
      return reply(400, { error: 'Invalid package.' })
    const discount = body.demoDiscount === true ? subtotal / 5 : 0
    const familyName = typeof body.familyName === 'string' ? body.familyName.trim() : ''
    if (!familyName || familyName.length > 200) return reply(400, { error: 'Enter a valid family contact name.' })
    let timeZone = 'America/New_York'
    if (typeof body.timeZone === 'string' && body.timeZone.length <= 100) {
      try {
        timeZone = new Intl.DateTimeFormat('en', { timeZone: body.timeZone }).resolvedOptions().timeZone
      } catch {
        return reply(400, { error: 'Choose a valid time zone.' })
      }
    }
    const id = randomUUID()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM booking_reservations WHERE confirmed_at IS NULL AND expires_at <= now()')
      if (stripeRequired) {
        await client.query(
          "INSERT INTO booking_reservations (id, expires_at, subtotal_cents, discount_cents, label, package_hours, stripe_checkout_required, display_time_zone) VALUES ($1, now() + interval '45 minutes', $2, $3, $4, $5, true, $6)",
          [id, subtotal, discount, familyName, body.packageHours, timeZone],
        )
      } else {
        await client.query(
          "INSERT INTO booking_reservations (id, expires_at, subtotal_cents, discount_cents, label, package_hours) VALUES ($1, now() + interval '10 minutes', $2, $3, $4, $5)",
          [id, subtotal, discount, familyName, body.packageHours],
        )
      }
      for (const slot of sessions) {
        const params = [id, slot.tutorId, new Date(slot.start), new Date(slot.end), slot.subject]
        if (stripeRequired) {
          await client.query(
            "INSERT INTO booking_sessions (reservation_id, tutor_id, slot, subject, student_name) VALUES ($1, $2, tstzrange($3, $4, '[)'), $5, $6)",
            [...params, slot.studentName],
          )
        } else {
          await client.query(
            "INSERT INTO booking_sessions (reservation_id, tutor_id, slot, subject) VALUES ($1, $2, tstzrange($3, $4, '[)'), $5)",
            params,
          )
        }
      }
      await client.query('COMMIT')

    } catch (error) {
      await client.query('ROLLBACK')
      if ((error as pg.DatabaseError).code === '23P01') {
        return reply(409, { error: 'One of your tutor times was just taken. Please choose another time.' })
      }
      throw error
    } finally {
      client.release()
    }
    if (!stripeRequired) return reply(201, { id })
    try {
      const checkoutUrl = await createSandboxCheckout(id, body.packageHours, subtotal - discount, new URL(request.url).origin)
      return reply(201, { id, checkoutUrl })
    } catch {
      await pool.query('DELETE FROM booking_reservations WHERE id=$1 AND stripe_checkout_id IS NULL', [id])
      return reply(503, { error: 'Stripe checkout could not start. Please try again.' })
    }
  } catch {
    return reply(503, { error: 'Reservations are temporarily unavailable. Please try again.' })
  }
}
