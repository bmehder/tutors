import { getSecret } from 'astro:env/server'
import type pg from 'pg'
import { pool } from './tutor-hours'
import { orderEmails, sendWithResend, type ConfirmedOrderEmailDetails, type OutgoingEmail } from './order-email'
import { tutors } from '../lib/tutoring-data'

export const adminEmail = 'admin@mychristiantutors.com'
export const emailDeliveryEnabled = getSecret('EMAIL_DELIVERY_ENABLED') === '1' &&
  Boolean(getSecret('RESEND_API_KEY'))
// Tutor messages remain held until they are explicitly enabled separately.
export const tutorEmailDeliveryEnabled = () => getSecret('TUTOR_EMAIL_DELIVERY_ENABLED') === '1'
const from = `MyChristianTutors <${adminEmail}>`

export async function emailQueueStatus() {
  if (!pool) throw new Error('Email storage is unavailable.')
  const result = await pool.query<{
    delivered: number; pending: number; failed: number; held: number; drafts: number;
  }>(`WITH queue AS (
      SELECT sent_at,last_error,delivery_allowed,
        ($1::boolean OR (message_key NOT LIKE 'order-confirmation/%/tutor/%'
          AND NOT EXISTS (SELECT 1 FROM tutor_profiles p
            WHERE lower(p.contact_email)=lower(e.recipient) AND lower(e.recipient)<>lower($2)))) AS recipient_allowed
      FROM outgoing_emails e
    ) SELECT
      count(*) FILTER (WHERE sent_at IS NOT NULL)::int AS delivered,
      count(*) FILTER (WHERE sent_at IS NULL AND delivery_allowed AND recipient_allowed)::int AS pending,
      count(*) FILTER (WHERE sent_at IS NULL AND delivery_allowed AND recipient_allowed AND last_error IS NOT NULL)::int AS failed,
      count(*) FILTER (WHERE sent_at IS NULL AND delivery_allowed AND NOT recipient_allowed)::int AS held,
      count(*) FILTER (WHERE sent_at IS NULL AND NOT delivery_allowed)::int AS drafts
    FROM queue`, [tutorEmailDeliveryEnabled(), adminEmail])
  return result.rows[0]
}

export async function queueEmail(
  db: pg.Pool | pg.PoolClient,
  message: OutgoingEmail,
  reservationId: string | null = null,
  deliveryAllowed = true,
) {
  await db.query(
    `INSERT INTO outgoing_emails(message_key, reservation_id, recipient, reply_to, subject, body, delivery_allowed)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (message_key) DO NOTHING`,
    [message.key, reservationId, message.to, message.replyTo ?? adminEmail, message.subject, message.text, deliveryAllowed],
  )
}

export async function queueOrderEmails(
  db: pg.PoolClient,
  id: string,
  options: { deliveryAllowed: boolean; paymentMode: 'sandbox' | 'live' },
) {
  const { deliveryAllowed, paymentMode } = options
  const result = await db.query<{
    label: string; contact_email: string; contact_phone: string; package_hours: number;
    subtotal_cents: number; discount_cents: number; display_time_zone: string | null;
    tutor_id: string; tutor_name: string | null; tutor_email: string | null;
    meeting_instructions: string | null; student_name: string | null; subject: string | null; start: Date;
  }>(
    `SELECT r.*, s.tutor_id, p.name AS tutor_name, p.contact_email AS tutor_email,
       p.meeting_instructions, s.student_name, s.subject, lower(s.slot) AS start
     FROM booking_reservations r JOIN booking_sessions s ON s.reservation_id=r.id
     LEFT JOIN tutor_profiles p ON p.tutor_id=s.tutor_id
     WHERE r.id=$1 AND r.confirmed_at IS NOT NULL ORDER BY lower(s.slot),s.id`, [id],
  )
  const first = result.rows[0]
  if (!first?.contact_email) return
  const order: ConfirmedOrderEmailDetails = {
    id, familyName: first.label, customerEmail: first.contact_email,
    customerPhone: first.contact_phone, packageHours: first.package_hours,
    totalCents: first.subtotal_cents - first.discount_cents,
    paymentMode,
    timeZone: first.display_time_zone ?? 'America/New_York',
    sessions: result.rows.map(row => ({
      student: row.student_name ?? 'Student', subject: row.subject ?? 'Tutoring',
      tutor: row.tutor_name ?? tutors.find(tutor => tutor.id === row.tutor_id)?.name ?? 'Tutor',
      start: row.start, meetingInstructions: row.meeting_instructions ?? '',
    })),
  }
  for (const message of orderEmails(order, adminEmail)) await queueEmail(db, message, id, deliveryAllowed)
  for (const tutorId of new Set(result.rows.map(row => row.tutor_id))) {
    const rows = result.rows.filter(row => row.tutor_id === tutorId)
    const tutorEmail = rows[0].tutor_email
    if (!tutorEmail) continue
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short',
    })
    await queueEmail(db, {
      to: tutorEmail, key: `order-confirmation/${id}/tutor/${tutorId}`,
      subject: `New tutoring booking #${id.slice(0,8).toUpperCase()}`,
      text: [
        `Family: ${first.label}`, `Email: ${first.contact_email}`, `Phone: ${first.contact_phone}`,
        '', 'Your sessions (Eastern time)',
        ...rows.map(row => `${formatter.format(row.start)} · ${row.student_name ?? 'Student'} · ${row.subject ?? 'Tutoring'}`),
        '', 'Reply to this email to contact administration.',
      ].join('\n'),
    }, id, deliveryAllowed && paymentMode === 'live')
  }
}

// Claim messages before calling Resend so a crash preserves the attempt timestamp.
// A five-minute lease exceeds the provider timeout and prevents parallel delivery.
// Uncertain deliveries older than 23 hours require review before another attempt.
export async function deliverQueuedEmails(limit = 3) {
  if (!emailDeliveryEnabled || !pool) return 0
  let sent = 0
  for (let index = 0; index < limit; index++) {
    const db = await pool.connect()
    try {
      await db.query('BEGIN')
      const result = await db.query<{
        id: string; message_key: string; recipient: string; reply_to: string; subject: string; body: string;
      }>(`SELECT * FROM outgoing_emails e WHERE sent_at IS NULL AND delivery_allowed
         AND ($1::boolean OR (message_key NOT LIKE 'order-confirmation/%/tutor/%'
           AND NOT EXISTS (SELECT 1 FROM tutor_profiles p
             WHERE lower(p.contact_email)=lower(e.recipient)
             AND lower(e.recipient)<>lower($2))))
         AND (attempted_at IS NULL OR attempted_at < now()-interval '5 minutes')
         AND (first_attempt_at IS NULL OR first_attempt_at > now()-interval '23 hours')
         ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`, [tutorEmailDeliveryEnabled(), adminEmail])
      const row = result.rows[0]
      if (!row) { await db.query('COMMIT'); break }
      await db.query(
        'UPDATE outgoing_emails SET attempted_at=now(),first_attempt_at=COALESCE(first_attempt_at,now()),attempts=attempts+1 WHERE id=$1',
        [row.id],
      )
      await db.query('COMMIT')
      try {
        const resendId = await sendWithResend({
          apiKey: getSecret('RESEND_API_KEY')!, from, replyTo: adminEmail,
        }, {
          to: row.recipient, replyTo: row.reply_to, subject: row.subject, text: row.body, key: row.message_key,
        })
        await db.query('UPDATE outgoing_emails SET sent_at=now(),resend_id=$2,last_error=NULL WHERE id=$1', [row.id, resendId])
        sent++
      } catch {
        await db.query("UPDATE outgoing_emails SET last_error='Email delivery failed. Retry required.' WHERE id=$1", [row.id])
      }
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    } finally { db.release() }
  }
  return sent
}
