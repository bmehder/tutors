import { getSecret } from 'astro:env/server'
import Stripe from 'stripe'
import { queueOrderEmails, deliverQueuedEmails } from './email-delivery'
import { pool } from './tutor-hours'

const key = getSecret('STRIPE_TEST_SECRET_KEY')
export const stripe = key && /^(sk|rk|rkcs)_test_/.test(key)
  ? new Stripe(key, { timeout: 8_000, maxNetworkRetries: 0 })
  : undefined

// A creation attempt is recorded before contacting Stripe. A lost response must
// be recovered with the same idempotency key, never treated as an unpaid checkout.
export async function sandboxCheckoutSession(reservationId: string, reconcile = false) {
  if (!stripe || !pool) throw new Error('Stripe sandbox is unavailable.')
  if (!reconcile) await pool.query(`UPDATE booking_reservations SET checkout_creation_at=COALESCE(checkout_creation_at,now())
    WHERE id=$1 AND stripe_checkout_required AND checkout_released_at IS NULL AND expires_at>now()`, [reservationId])
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const reservation = (await db.query<{
      stripe_checkout_id: string | null; checkout_origin: string | null;
      subtotal_cents: number; discount_cents: number; package_hours: number;
      checkout_released_at: Date | null; checkout_creation_started: boolean; active: boolean; recoverable: boolean;
    }>(`SELECT stripe_checkout_id,checkout_origin,subtotal_cents,discount_cents,package_hours,
       checkout_released_at,checkout_creation_at IS NOT NULL AS checkout_creation_started,expires_at>now() AS active,
       checkout_creation_at>now()-interval '23 hours' AS recoverable
       FROM booking_reservations WHERE id=$1 AND stripe_checkout_required FOR UPDATE`, [reservationId])).rows[0]
    if (!reservation || reservation.checkout_released_at ||
        (!reconcile && !reservation.active) || !reservation.checkout_creation_started && !reservation.stripe_checkout_id)
      throw new Error('This checkout is no longer available.')
    let session: Stripe.Checkout.Session
    if (reservation.stripe_checkout_id) {
      session = await stripe.checkout.sessions.retrieve(reservation.stripe_checkout_id)
    } else {
      if (!reservation.recoverable) throw new Error('This unresolved payment needs manual review before its times can be released.')
      if (!reservation.checkout_origin) throw new Error('The checkout origin is missing.')
      // All parameters come from the accepted reservation and stay identical on retries.
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        allowed_payment_method_types: ['card'],
        client_reference_id: reservationId,
        success_url: reservation.checkout_origin + '/checkout/stripe?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: reservation.checkout_origin + '/checkout/stripe?cancelled=1',
        line_items: [{ quantity: 1, price_data: {
          currency: 'usd', unit_amount: reservation.subtotal_cents - reservation.discount_cents,
          product_data: { name: `MyChristianTutors · ${reservation.package_hours}-hour tutoring package` },
        } }],
      }, { idempotencyKey: 'tutoring-checkout-' + reservationId })
      if (session.livemode) throw new Error('Stripe returned a live checkout.')
      await db.query('UPDATE booking_reservations SET stripe_checkout_id=$2 WHERE id=$1', [reservationId, session.id])
    }
    if (session.livemode) throw new Error('Stripe returned a live checkout.')
    await db.query('COMMIT')
    return session
  } catch (error) {
    await db.query('ROLLBACK')
    throw error
  } finally { db.release() }
}

export async function confirmSandboxCheckout(session: Stripe.Checkout.Session) {
  if (!pool || session.livemode || session.mode !== 'payment' ||
      session.status !== 'complete' || session.payment_status !== 'paid' ||
      session.currency !== 'usd' || session.amount_total === null ||
      !session.client_reference_id) return null

  const db = await pool.connect()
  let bookingId: string | null = null
  let cancelled = false
  try {
  await db.query('BEGIN')
  const result = await db.query<{ id: string; cancelled_at: Date | null }>(
    `UPDATE booking_reservations
     SET confirmed_at = COALESCE(confirmed_at, now())
     WHERE id::text = $1 AND stripe_checkout_required AND stripe_checkout_id = $2
       AND checkout_released_at IS NULL
       AND subtotal_cents - discount_cents = $3
     RETURNING id,cancelled_at`,
    [session.client_reference_id, session.id, session.amount_total],
  )
  bookingId = result.rows[0]?.id ?? null
  cancelled = Boolean(result.rows[0]?.cancelled_at)
  if (bookingId && !cancelled) await queueOrderEmails(db, bookingId, {
    paymentMode: 'sandbox',
    deliveryAllowed: getSecret('SANDBOX_ORDER_EMAIL_DELIVERY_ENABLED') === '1',
  })
  await db.query('COMMIT')
  } catch (error) {
    await db.query('ROLLBACK')
    throw error
  } finally { db.release() }
  // Email failures leave the confirmed order intact and queued for retry.
  if (bookingId && !cancelled) await deliverQueuedEmails().catch(() => {})
  return bookingId
}

export async function sandboxBookingCancelled(id: string) {
  if (!pool) return false
  return Boolean((await pool.query('SELECT cancelled_at FROM booking_reservations WHERE id=$1', [id])).rows[0]?.cancelled_at)
}

export async function sandboxBookingDetails(id: string) {
  if (!pool) throw new Error('Bookings are unavailable.')
  const { rows } = await pool.query<{
    label: string | null
    package_hours: number
    contact_email: string | null
    contact_phone: string | null
    subtotal_cents: number
    discount_cents: number
    display_time_zone: string | null
    student_name: string | null
    tutor_id: string
    tutor_name: string | null
    meeting_instructions: string | null
    subject: string | null
    starts_at: Date
    ends_at: Date
  }>(
    `SELECT r.label, r.package_hours, r.subtotal_cents, r.discount_cents, r.display_time_zone, r.contact_email, r.contact_phone,
            s.student_name, s.tutor_id, p.name AS tutor_name, p.meeting_instructions, s.subject,
            lower(s.slot) AS starts_at, upper(s.slot) AS ends_at
     FROM booking_reservations r
     JOIN booking_sessions s ON s.reservation_id = r.id
     LEFT JOIN tutor_profiles p ON p.tutor_id = s.tutor_id
     WHERE r.id = $1 AND r.stripe_checkout_required AND r.confirmed_at IS NOT NULL
     ORDER BY lower(s.slot), s.id`,
    [id],
  )
  return rows
}
