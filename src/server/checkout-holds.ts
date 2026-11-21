import { pool } from './tutor-hours'
import { confirmSandboxCheckout, sandboxCheckoutSession, stripe } from './stripe-sandbox'
import type Stripe from 'stripe'

// Keep the request identity after release so a delayed retry cannot recreate it.
// Clear abandoned contact details; there is no completed order to retain them for.
async function releaseHold(id: string, expiredSessionId: string | null) {
  if (!pool) return
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const released = await db.query(`UPDATE booking_reservations SET checkout_released_at=now(),
      label=NULL,contact_email=NULL,contact_phone=NULL,requires_contact=false,display_time_zone=NULL
      WHERE id=$1 AND confirmed_at IS NULL AND checkout_released_at IS NULL
        AND (($2::text IS NOT NULL AND stripe_checkout_id=$2)
          OR ($2::text IS NULL AND expires_at<=now() AND
            (NOT stripe_checkout_required OR (checkout_creation_at IS NULL AND stripe_checkout_id IS NULL))))
      RETURNING id`, [id, expiredSessionId])
    if (released.rowCount) await db.query('DELETE FROM booking_sessions WHERE reservation_id=$1', [id])
    await db.query('COMMIT')
  } catch (error) {
    await db.query('ROLLBACK')
    throw error
  } finally { db.release() }
}

export async function releaseExpiredSandboxCheckout(session: Stripe.Checkout.Session) {
  if (session.livemode || session.status !== 'expired' || session.payment_status !== 'unpaid' ||
      session.mode !== 'payment' || !session.client_reference_id) return
  await releaseHold(session.client_reference_id, session.id)
}

export async function reconcileExpiredHolds(tutorIds?: string[]) {
  if (!pool) return
  // Claim a bounded batch so concurrent availability requests do not all call Stripe.
  const claimed = await pool.query<{
    id: string; stripe_checkout_required: boolean; stripe_checkout_id: string | null;
    checkout_creation_started: boolean;
  }>(`WITH expired AS (
    SELECT r.id FROM booking_reservations r WHERE r.confirmed_at IS NULL
      AND r.checkout_released_at IS NULL AND r.expires_at<=now()
      AND (r.checkout_reconcile_after IS NULL OR r.checkout_reconcile_after<=now())
      AND ($1::text[] IS NULL OR EXISTS (SELECT 1 FROM booking_sessions s
        WHERE s.reservation_id=r.id AND s.tutor_id=ANY($1)))
    ORDER BY r.expires_at LIMIT 10 FOR UPDATE SKIP LOCKED
  ) UPDATE booking_reservations r SET checkout_reconcile_after=now()+interval '1 minute'
    FROM expired WHERE r.id=expired.id
    RETURNING r.id,r.stripe_checkout_required,r.stripe_checkout_id,r.checkout_creation_at IS NOT NULL AS checkout_creation_started`, [tutorIds ?? null])
  await Promise.all(claimed.rows.map(async hold => {
    try {
      if (!hold.stripe_checkout_required || !hold.checkout_creation_started && !hold.stripe_checkout_id) {
        await releaseHold(hold.id, null)
        return
      }
      if (!stripe) return // Provider failure keeps the time blocked until payment can be checked.
      let session = await sandboxCheckoutSession(hold.id, true)
      if (session.status === 'open') {
        try { session = await stripe.checkout.sessions.expire(session.id) }
        catch { session = await stripe.checkout.sessions.retrieve(session.id) } // Payment may win the race.
      }
      if (session.status === 'complete') await confirmSandboxCheckout(session)
      else await releaseExpiredSandboxCheckout(session)
    } catch {
      // Unknown payment outcome is a held time, never a newly available time.
      console.warn('An expired checkout could not be reconciled; its tutor times remain held.', { reservationId: hold.id })
    }
  }))
}
