import { getSecret } from 'astro:env/server'
import Stripe from 'stripe'
import { pool } from './tutor-hours'

const key = getSecret('STRIPE_TEST_SECRET_KEY')
export const stripe = key && /^(sk|rk|rkcs)_test_/.test(key)
  ? new Stripe(key, { timeout: 8_000, maxNetworkRetries: 0 })
  : undefined

export async function createSandboxCheckout(
  reservationId: string,
  packageHours: number,
  amount: number,
  origin: string,
) {
  if (!stripe || !pool) throw new Error('Stripe sandbox is unavailable.')
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    allowed_payment_method_types: ['card'],
    client_reference_id: reservationId,
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    success_url: origin + '/checkout/stripe?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: origin + '/checkout/stripe?cancelled=1',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: amount,
        product_data: { name: `MyChristianTutors · ${packageHours}-hour tutoring package` },
      },
    }],
  }, { idempotencyKey: 'tutoring-checkout-' + reservationId })

  if (session.livemode || !session.url) throw new Error('Stripe did not return a sandbox payment page.')
  const saved = await pool.query(
    'UPDATE booking_reservations SET stripe_checkout_id=$2 WHERE id=$1 AND stripe_checkout_required',
    [reservationId, session.id],
  )
  if (!saved.rowCount) throw new Error('The reservation could not be linked to checkout.')
  return session.url
}

export async function confirmSandboxCheckout(session: Stripe.Checkout.Session) {
  if (!pool || session.livemode || session.mode !== 'payment' ||
      session.status !== 'complete' || session.payment_status !== 'paid' ||
      session.currency !== 'usd' || session.amount_total === null ||
      !session.client_reference_id) return null

  const result = await pool.query<{ id: string }>(
    `UPDATE booking_reservations
     SET confirmed_at = COALESCE(confirmed_at, now())
     WHERE id::text = $1 AND stripe_checkout_required AND stripe_checkout_id = $2
       AND subtotal_cents - discount_cents = $3
     RETURNING id`,
    [session.client_reference_id, session.id, session.amount_total],
  )
  return result.rows[0]?.id ?? null
}

export async function sandboxBookingDetails(id: string) {
  if (!pool) throw new Error('Bookings are unavailable.')
  const { rows } = await pool.query<{
    label: string | null
    package_hours: number
    subtotal_cents: number
    discount_cents: number
    display_time_zone: string | null
    student_name: string | null
    tutor_id: string
    tutor_name: string | null
    subject: string | null
    starts_at: Date
    ends_at: Date
  }>(
    `SELECT r.label, r.package_hours, r.subtotal_cents, r.discount_cents, r.display_time_zone,
            s.student_name, s.tutor_id, p.name AS tutor_name, s.subject,
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
