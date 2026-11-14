import type pg from 'pg'
import { tutorHours } from './tutor-hours'
import { SUBJECTS } from '../lib/tutoring-data'
import { calendarWeekday, sessionInterval } from '../lib/session-time'

export async function editBooking(pool: pg.Pool, form: FormData, action: string) {
  const id = String(form.get('booking') ?? '')
  if (action === 'delete-booking') {
    await pool.query('DELETE FROM booking_reservations WHERE id = $1 AND confirmed_at IS NOT NULL', [id])
    return
  }
  if (action === 'save-session-subject') {
    const subject = String(form.get('session-subject') ?? '')
    if (!SUBJECTS.includes(subject)) throw new Error('Choose a subject.')
    const result = await pool.query(
      'UPDATE booking_sessions s SET subject = $2 FROM booking_reservations b WHERE s.id = $1 AND b.id = s.reservation_id AND b.confirmed_at IS NOT NULL',
      [form.get('session'), subject],
    )
    if (!result.rowCount) throw new Error('Session not found.')
    return
  }
  if (action === 'move-session') {
    const [hour, minute] = String(form.get('time')).split(':').map(Number)
    const slot = sessionInterval({ date: String(form.get('date')), start: hour * 60 + minute, duration: 60 })
    if (slot.kind !== 'resolved') throw new Error('Choose a valid Eastern date and quarter-hour start.')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM booking_reservations WHERE confirmed_at IS NULL AND expires_at <= now()')
      const replacement = String(form.get('replacement-tutor') ?? '')
      if (replacement) {
        const current = await client.query<{ subject: string | null }>(
          'SELECT subject FROM booking_sessions WHERE id = $1 FOR UPDATE', [form.get('session')],
        )
        const subject = current.rows[0]?.subject
        const tutor = (await tutorHours()).find(candidate => candidate.id === replacement)
        if (!subject || !tutor?.subjects.includes(subject))
          throw new Error('Choose an active tutor who teaches this subject.')
        if (!tutor.startsByDay[calendarWeekday(String(form.get('date')))].includes(hour * 60 + minute))
          throw new Error('The replacement tutor does not offer that time.')
      }
      const result = await client.query(
        "UPDATE booking_sessions s SET slot=tstzrange($2,$3,'[)'), tutor_id=COALESCE(NULLIF($4,''),s.tutor_id) FROM booking_reservations b WHERE s.id=$1 AND b.id=s.reservation_id AND b.confirmed_at IS NOT NULL",
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
  const subtotal = Number(form.get('subtotal'))
  const discount = Number(form.get('discount'))
  if (!label || !Number.isSafeInteger(subtotal) || !Number.isSafeInteger(discount) ||
      subtotal < 0 || subtotal > 100000000 || discount < 0 || discount > subtotal)
    throw new Error('Enter a booking label and valid amounts in cents.')
  if (action === 'edit-booking') {
    await pool.query(
      'UPDATE booking_reservations SET label=$2, subtotal_cents=$3, discount_cents=$4 WHERE id=$1 AND confirmed_at IS NOT NULL',
      [id, label, subtotal, discount],
    )
    return
  }
  const tutor = String(form.get('booking-tutor'))
  const time = String(form.get('time')).split(':').map(Number)
  const slot = sessionInterval({ date: String(form.get('date')), start: time[0] * 60 + time[1], duration: 60 })
  if (!tutor || slot.kind !== 'resolved') throw new Error('Choose a valid Eastern date and quarter-hour start.')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM booking_reservations WHERE confirmed_at IS NULL AND expires_at <= now()')
    const result = await client.query<{id: string}>(
      'INSERT INTO booking_reservations (id, expires_at, confirmed_at, label, subtotal_cents, discount_cents) VALUES (gen_random_uuid(), now(), now(), $1, $2, $3) RETURNING id',
      [label, subtotal, discount],
    )
    await client.query("INSERT INTO booking_sessions (reservation_id, tutor_id, slot) VALUES ($1, $2, tstzrange($3, $4, '[)'))",
      [result.rows[0].id, tutor, new Date(slot.start), new Date(slot.end)])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    if ((error as pg.DatabaseError).code === '23P01') throw new Error('That tutor already has a session during this time.')
    throw new Error('The booking could not be saved.')
  } finally {
    client.release()
  }
}
