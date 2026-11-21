import type pg from 'pg'
import { reconcileExpiredHolds } from './checkout-holds'
import { tutorHours } from './tutor-hours'
import { subjectCatalog } from './subjects'
import { instantParts, sessionInterval, TUTOR_ZONE } from '../lib/session-time'

function submittedSlot(form: FormData) {
  const time = String(form.get('time') ?? '')
  const zone = String(form.get('time-zone') || TUTOR_ZONE)
  if (!/^([01]\d|2[0-3]):(00|15|30|45)$/.test(time))
    throw new Error('Choose a valid date and quarter-hour start.')
  const [hour, minute] = time.split(':').map(Number)
  const interval = sessionInterval({ date: String(form.get('date')), start: hour * 60 + minute, duration: 60 }, zone)
  switch (interval.kind) {
    case 'resolved': return interval
    case 'ambiguousTime': throw new Error('That time occurs twice when clocks change. Choose another time or use Eastern time.')
    case 'nonexistentTime': throw new Error('That time does not exist because the clocks change. Choose another time.')
    default: throw new Error('Choose a valid date, time, and time zone.')
  }
}

type BookingContact =
  | { kind: 'missing' }
  | { kind: 'complete'; name: string; email: string; phone: string }

function bookingContact(form: FormData, name: string): BookingContact {
  const email = String(form.get('contact-email') ?? '').trim()
  const phone = String(form.get('contact-phone') ?? '').trim()
  if (!email && !phone) return { kind: 'missing' }
  if (!name || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('Enter a contact name and a valid email address.')
  const digits = phone.replace(/\D/g, '')
  if (!/^\+?[\d(). -]+$/.test(phone) || digits.length < 7 || digits.length > 15 || phone.length > 40)
    throw new Error('Enter a valid phone number, including the country code if applicable.')
  return { kind: 'complete', name, email, phone }
}

// Match cancellation's lock order so a concurrent edit cannot escape its history snapshot.
async function activeSession(client: pg.PoolClient, id: FormDataEntryValue | null) {
  const booking = await client.query(`SELECT b.id FROM booking_reservations b JOIN booking_sessions s ON s.reservation_id=b.id
    WHERE s.id=$1 AND b.confirmed_at IS NOT NULL AND b.cancelled_at IS NULL FOR UPDATE OF b`, [id])
  if (!booking.rowCount) throw new Error('Session not found.')
  const session = (await client.query<{ tutor_id: string; subject: string | null }>('SELECT tutor_id,subject FROM booking_sessions WHERE id=$1 FOR UPDATE', [id])).rows[0]
  if (!session) throw new Error('Session not found.')
  return session
}

export async function editBooking(pool: pg.Pool, form: FormData, action: string) {
  const id = String(form.get('booking') ?? '')
  if (action === 'record-refund') {
    const value = String(form.get('refund') ?? '').trim()
    const amount = value === '' ? NaN : Number(value)
    const reference = String(form.get('refund-reference') ?? '').trim()
    if (!Number.isSafeInteger(amount) || amount <= 0 || !reference || reference.length > 500)
      throw new Error('Enter the total refunded amount in cents and a payment-provider or invoice reference.')
    const result = await pool.query(`UPDATE booking_reservations SET refund_cents=$2,refund_reference=$3
      WHERE id=$1 AND confirmed_at IS NOT NULL AND NOT payment_pending
        AND subtotal_cents IS NOT NULL AND discount_cents IS NOT NULL
        AND $2 BETWEEN refund_cents AND subtotal_cents-discount_cents`, [id,amount,reference])
    if (!result.rowCount) throw new Error('The refund must be within the recorded payment and cannot reduce a previously recorded refund.')
    return
  }
  if (action === 'mark-booking-paid') {
    const result = await pool.query(
      'UPDATE booking_reservations SET payment_pending=false WHERE id=$1 AND confirmed_at IS NOT NULL AND cancelled_at IS NULL AND subtotal_cents IS NOT NULL AND discount_cents IS NOT NULL',
      [id],
    )
    if (!result.rowCount) throw new Error('This order could not be marked paid. Check that its amounts are recorded.')
    return
  }
  if (action === 'cancel-booking' || action === 'delete-booking') {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const order = (await client.query('SELECT cancelled_at FROM booking_reservations WHERE id=$1 AND confirmed_at IS NOT NULL FOR UPDATE', [id])).rows[0]
      if (!order) throw new Error('Booking not found.')
      if (!order.cancelled_at) {
        await client.query(`UPDATE booking_reservations SET cancelled_at=now(),cancelled_sessions=COALESCE(
          (SELECT jsonb_agg(jsonb_build_object('id',s.id::text,'tutor',s.tutor_id,'subject',s.subject,'student',s.student_name,'start',lower(s.slot),'end',upper(s.slot)) ORDER BY lower(s.slot))
          FROM booking_sessions s WHERE s.reservation_id=$1),'[]'::jsonb) WHERE id=$1`, [id])
        await client.query('DELETE FROM booking_sessions WHERE reservation_id=$1', [id])
        await client.query('UPDATE outgoing_emails SET delivery_allowed=false WHERE reservation_id=$1 AND sent_at IS NULL', [id])
      }
      await client.query('COMMIT')
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
    return
  }
  if (action === 'save-session-subject') {
    const subject = String(form.get('session-subject') ?? '')
    if (!(await subjectCatalog(pool)).some(item => item.name === subject)) throw new Error('Choose a subject.')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const session = await activeSession(client, form.get('session'))
      if (!(await tutorHours(false,client)).some(tutor => tutor.id===session.tutor_id && tutor.subjects.includes(subject)))
        throw new Error('The current tutor does not teach that subject. Choose a subject they teach, or change the tutor first.')
      await client.query('UPDATE booking_sessions SET subject=$2 WHERE id=$1', [form.get('session'),subject])
      await client.query('COMMIT')
    } catch (error) {await client.query('ROLLBACK');throw error}
    finally {client.release()}
    return
  }
  if (action === 'move-session') {
    const slot = submittedSlot(form)
    await reconcileExpiredHolds()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const current = await activeSession(client, form.get('session'))
      const replacement = String(form.get('replacement-tutor') ?? '')
      if (replacement) {
        const subject = current.subject
        const tutor = (await tutorHours(false, client)).find(candidate => candidate.id === replacement)
        if (!subject || !tutor?.subjects.includes(subject))
          throw new Error('Choose an active tutor who teaches this subject.')
        const eastern = instantParts(slot.start, TUTOR_ZONE)
        if (!tutor.startsByDay[eastern.weekday].includes(eastern.start))
          throw new Error('The replacement tutor does not offer that time.')
      }
      const result = await client.query(
        "UPDATE booking_sessions s SET slot=tstzrange($2,$3,'[)'), tutor_id=COALESCE(NULLIF($4,''),s.tutor_id) FROM booking_reservations b WHERE s.id=$1 AND b.id=s.reservation_id AND b.confirmed_at IS NOT NULL AND b.cancelled_at IS NULL",
        [form.get('session'), new Date(slot.start), new Date(slot.end), replacement],
      )
      if (!result.rowCount) throw new Error('Session not found.')
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      if ((error as pg.DatabaseError).code === '23P01') throw new Error('That tutor already has a session during this time.')
      throw error
    } finally {
      client.release()
    }
    return
  }
  const label = String(form.get('label') ?? '').trim()
  const subtotalInput = String(form.get('subtotal') ?? '').trim()
  const subtotal = subtotalInput === '' ? NaN : Number(subtotalInput)
  const discount = Number(form.get('discount'))
  if (!label || !Number.isSafeInteger(subtotal) || !Number.isSafeInteger(discount) ||
      subtotal < 0 || subtotal > 100000000 || discount < 0 || discount > subtotal)
    throw new Error('Enter a booking label and valid amounts in cents.')
  const contact = bookingContact(form, label)
  if (action === 'edit-booking') {
    const result = await pool.query(
      `UPDATE booking_reservations SET label=$2, subtotal_cents=$3, discount_cents=$4, contact_email=COALESCE($5,contact_email), contact_phone=COALESCE($6,contact_phone)
       WHERE id=$1 AND confirmed_at IS NOT NULL AND $3::integer-$4::integer>=refund_cents
         AND (NOT stripe_checkout_required OR (subtotal_cents=$3 AND discount_cents=$4))`,
      [id, label, subtotal, discount, contact.kind === 'complete' ? contact.email : null, contact.kind === 'complete' ? contact.phone : null],
    )
    if (!result.rowCount) throw new Error('Booking not found, or the amounts conflict with a Stripe payment or recorded refund.')
    return
  }
  if (contact.kind === 'missing') throw new Error('Enter the family’s email address and phone number.')
  const tutor = String(form.get('booking-tutor'))
  const subject = String(form.get('booking-subject') ?? '')
  if (!(await tutorHours(false,pool)).some(candidate => candidate.id===tutor && candidate.subjects.includes(subject)))
    throw new Error('Choose an active tutor and a subject they teach.')
  const slot = submittedSlot(form)
  await reconcileExpiredHolds([tutor])
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query<{id: string}>(
      'INSERT INTO booking_reservations (id, expires_at, confirmed_at, label, subtotal_cents, discount_cents, payment_pending, contact_email, contact_phone, requires_contact) VALUES (gen_random_uuid(), now(), now(), $1, $2, $3, true, $4, $5, true) RETURNING id',
      [contact.name, subtotal, discount, contact.email, contact.phone],
    )
    await client.query("INSERT INTO booking_sessions (reservation_id, tutor_id, slot, subject) VALUES ($1, $2, tstzrange($3, $4, '[)'),$5)",
      [result.rows[0].id, tutor, new Date(slot.start), new Date(slot.end),subject])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    if ((error as pg.DatabaseError).code === '23P01') throw new Error('That tutor already has a session during this time.')
    throw new Error('The booking could not be saved.')
  } finally {
    client.release()
  }
}
