import { createHash, randomUUID } from 'node:crypto'
import type pg from 'pg'
import { pool } from './tutor-hours'
import { CheckoutError } from './checkout-errors'

export type RequestedSession = {
  tutorId: string; studentId: string; studentName: string | null; subject: string;
  date: string; startMinute: number; start: number; end: number;
}

export type CheckoutRequest = {
  requestId: string;
  packageHours: number; discountRequested: boolean;
  familyName: string; contactEmail: string; contactPhone: string;
  timeZone: string; origin: string; stripeRequired: boolean;
  sessions: RequestedSession[];
}

type CheckoutReservation =
  | { kind: 'held'; id: string }
  | { kind: 'confirmed'; id: string; checkoutId: string | null }

export async function reserveCheckout(
  input: CheckoutRequest,
  validateNewBooking: (db: pg.PoolClient) => Promise<{ subtotal: number; discount: number }>,
): Promise<CheckoutReservation> {
  if (!pool) throw new Error('Reservation storage is unavailable.')
  const { requestId, ...payload } = input
  const sessions = [...input.sessions].sort((a, b) => a.tutorId.localeCompare(b.tutorId) || a.start - b.start)
  const fingerprint = createHash('sha256').update(JSON.stringify({ ...payload, sessions })).digest('hex')
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['checkout-request:' + requestId])
    const previous = (await db.query<{
      id: string; checkout_request_hash: string; checkout_released_at: Date | null;
      confirmed_at: Date | null; active: boolean; stripe_checkout_id: string | null;
    }>(`SELECT id,checkout_request_hash,checkout_released_at,confirmed_at,stripe_checkout_id,
        expires_at > now() AS active FROM booking_reservations WHERE checkout_request_id=$1 FOR UPDATE`, [requestId])).rows[0]
    if (previous) {
      if (previous.checkout_request_hash !== fingerprint)
        throw new CheckoutError(409, 'request_mismatch', 'This checkout request was already used for a different plan. Please review your plan.')
      if (previous.checkout_released_at)
        throw new CheckoutError(409, 'checkout_expired', 'Your checkout hold expired. Please review the available times and try again.')
      if (previous.confirmed_at) {
        await db.query('COMMIT')
        return { kind: 'confirmed', id: previous.id, checkoutId: previous.stripe_checkout_id }
      }
      if (!previous.active)
        throw new CheckoutError(409, 'checkout_pending', 'Your previous checkout is still being checked. Please try again shortly.')
      // An accepted hold remains authoritative when the notice deadline or tutor hours change.
      await db.query('COMMIT')
      return { kind: 'held', id: previous.id }
    }
    if (input.contactEmail) {
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['family-checkouts:' + input.contactEmail.toLowerCase()])
      const active = await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM booking_reservations
        WHERE lower(contact_email)=$1 AND confirmed_at IS NULL AND checkout_released_at IS NULL`, [input.contactEmail.toLowerCase()])
      if (active.rows[0].count >= 3)
        throw new CheckoutError(429, 'hold_limit', 'You have several checkouts in progress. Finish one or wait for it to expire before starting another.')
    }
    const { subtotal, discount } = await validateNewBooking(db)
    const id = randomUUID()
    await db.query(`INSERT INTO booking_reservations
      (id,expires_at,subtotal_cents,discount_cents,label,package_hours,stripe_checkout_required,
       display_time_zone,contact_email,contact_phone,requires_contact,checkout_request_id,checkout_request_hash,checkout_origin)
      VALUES($1,now()+($2*interval '1 minute'),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id,input.stripeRequired ? 45 : 10,subtotal,discount,input.familyName,input.packageHours,input.stripeRequired,
        input.timeZone,input.contactEmail || null,input.contactPhone || null,Boolean(input.contactEmail && input.contactPhone),requestId,fingerprint,input.origin])
    for (const session of sessions) {
      await db.query(`INSERT INTO booking_sessions(reservation_id,tutor_id,slot,subject,student_name)
        VALUES($1,$2,tstzrange($3,$4,'[)'),$5,$6)`,
        [id,session.tutorId,new Date(session.start),new Date(session.end),session.subject,session.studentName])
    }
    await db.query('COMMIT')
    return { kind: 'held', id }
  } catch (error) {
    await db.query('ROLLBACK')
    if ((error as pg.DatabaseError).code === '23P01')
      throw new CheckoutError(409, 'time_taken', 'One of your tutor times was just taken. Please choose another time.')
    throw error
  } finally { db.release() }
}
