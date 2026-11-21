// Actual admin rules and database constraints, isolated from real records/providers.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pg from 'pg'
import { build } from 'esbuild'

const direct = new URL(process.env.BOOKING_DATABASE_URL)
direct.hostname = direct.hostname.replace('-pooler.', '.')
const owner = new pg.Client({ connectionString: direct.toString() })
await owner.connect()
const schema = 'admin_workflows_' + randomUUID().replaceAll('-', '')
const directory = resolve('node_modules/.cache/admin-workflows')
await mkdir(directory, { recursive: true })
let db, pool
const originalFetch = globalThis.fetch
try {
  await owner.query('CREATE SCHEMA ' + schema)
  for (const table of ['booking_reservations', 'booking_sessions', 'tutor_profiles', 'tutor_profile_slugs', 'tutor_weekly_hours', 'tutoring_subjects', 'outgoing_emails'])
    await owner.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`)
  const scoped = new URL(direct)
  scoped.searchParams.set('options', '-c search_path=' + schema)
  process.env.BOOKING_DATABASE_URL = scoped.toString()
  process.env.EMAIL_DELIVERY_ENABLED = '0'
  delete process.env.STRIPE_TEST_SECRET_KEY
  await writeFile(directory + '/env.mjs', 'export const getSecret = key => process.env[key]')
  await build({ entryPoints: { actions: 'src/server/admin-bookings.ts', database: 'src/server/tutor-hours.ts' },
    outdir: directory + '/build', bundle: true, splitting: true, platform: 'node', format: 'esm', packages: 'external',
    outExtension: { '.js': '.mjs' }, alias: { 'astro:env/server': directory + '/env.mjs' } })
  const { editBooking } = await import(directory + '/build/actions.mjs')
  pool = (await import(directory + '/build/database.mjs')).pool
  db = new pg.Client({ connectionString: scoped.toString() })
  await db.connect()
  globalThis.fetch = async () => { throw new Error('Admin workflow tests cannot call payment or email providers.') }
  await db.query("INSERT INTO tutoring_subjects(name,catalog_name) VALUES('Biology','Biology'),('Chemistry','Chemistry')")
  const starts = JSON.stringify(Array.from({ length: 7 }, () => [540, 600]))
  for (const [id, subjects] of [['workflow-a', ['Biology']], ['workflow-b', ['Biology']], ['workflow-c', ['Chemistry']]]) {
    await db.query('INSERT INTO tutor_profiles(tutor_id,name,subjects) VALUES($1,$1,$2)', [id,subjects])
    await db.query('INSERT INTO tutor_profile_slugs(tutor_id,slug) VALUES($1,$1)', [id])
    await db.query('INSERT INTO tutor_weekly_hours(tutor_id,starts_by_day) VALUES($1,$2)', [id,starts])
  }
  const manual = (extra = {}) => ({ label: 'Workflow family', 'contact-email': 'workflow@example.test', 'contact-phone': '(555) 010-1234',
    subtotal: '6000', discount: '500', 'booking-tutor': 'workflow-a', 'booking-subject': 'Biology', date: '2091-05-01', time: '09:00', 'time-zone': 'America/New_York', ...extra })
  const action = (name, values) => {
    const form = new FormData()
    for (const [key,value] of Object.entries(values)) form.set(key, String(value))
    return editBooking(pool, form, name)
  }
  const row = id => db.query('SELECT * FROM booking_reservations WHERE id=$1', [id]).then(r => r.rows[0])
  const sessions = id => db.query('SELECT *,lower(slot) AS start FROM booking_sessions WHERE reservation_id=$1', [id]).then(r => r.rows)

  await assert.rejects(action('create-booking', manual({ 'contact-email': '', 'contact-phone': '' })), /email.*phone/)
  await assert.rejects(action('create-booking', manual({ 'contact-phone': '' })), /phone/)
  await assert.rejects(action('create-booking', manual({ 'booking-subject': '' })), /subject they teach/)
  await assert.rejects(action('create-booking', manual({ 'booking-tutor': 'unknown' })), /active tutor/)
  await assert.rejects(action('create-booking', manual({ subtotal: '', discount: '0' })), /valid amounts/)
  await assert.rejects(action('create-booking', manual({ time: '09:55' })), /quarter-hour/)
  await action('create-booking', manual())
  const order = (await db.query('SELECT id FROM booking_reservations')).rows[0].id
  const session = (await sessions(order))[0]
  assert.equal((await row(order)).payment_pending, true)
  assert.equal(session.subject, 'Biology')
  await assert.rejects(action('create-booking', manual({ label: 'Competing family' })), /already has a session/)
  assert.equal((await db.query('SELECT count(*)::int AS n FROM booking_reservations')).rows[0].n, 1, 'Conflicting manual order rolls back completely')
  console.log('PASS — manual orders require full contact, amounts, valid time and eligible subject/tutor; conflicting orders roll back')

  await assert.rejects(action('save-session-subject', { session: session.id, 'session-subject': 'Chemistry' }), /does not teach/)
  await assert.rejects(action('move-session', { session: session.id, 'replacement-tutor': 'workflow-c', date: '2091-05-02', time: '09:00' }), /teaches this subject/)
  await assert.rejects(action('move-session', { session: session.id, 'replacement-tutor': 'workflow-b', date: '2091-05-02', time: '00:00' }), /does not offer/)
  await assert.rejects(action('move-session', { session: session.id, date: '2027-03-14', time: '02:00' }), /does not exist/)
  assert.equal((await sessions(order))[0].tutor_id, 'workflow-a')
  await action('move-session', { session: session.id, 'replacement-tutor': 'workflow-b', date: '2091-05-02', time: '09:00' })
  assert.equal((await sessions(order))[0].tutor_id, 'workflow-b')
  // Keeping the current tutor allows a mutually agreed exception to advertised weekly hours.
  await action('move-session', { session: session.id, date: '2091-05-03', time: '17:00', 'time-zone': 'Europe/Amsterdam' })
  assert.ok((await sessions(order))[0].start)
  console.log('PASS — invalid tutor/subject/availability/DST changes preserve the session; valid tutor changes and agreed local-time exceptions save')

  await assert.rejects(action('record-refund', { booking: order, refund: '100', 'refund-reference': 'not-paid' }), /recorded payment/)
  await action('mark-booking-paid', { booking: order })
  assert.equal((await row(order)).payment_pending, false)
  await assert.rejects(action('record-refund', { booking: order, refund: '6000', 'refund-reference': 'too-much' }), /within the recorded payment/)
  await assert.rejects(action('record-refund', { booking: order, refund: '500', 'refund-reference': '' }), /reference/)
  await action('record-refund', { booking: order, refund: '500', 'refund-reference': 'external-refund-123' })
  await action('record-refund', { booking: order, refund: '500', 'refund-reference': 'external-refund-123' })
  assert.equal((await row(order)).refund_cents, 500, 'Repeated form submission is a total, not a second refund')
  await assert.rejects(action('record-refund', { booking: order, refund: '100', 'refund-reference': 'less' }), /cannot reduce/)
  await assert.rejects(action('edit-booking', { ...manual(), booking: order, subtotal: '100', discount: '0' }), /recorded refund/)
  console.log('PASS — invoice payment and externally issued refund records enforce amounts, references and idempotent cumulative totals; no money moves')

  const before = (await sessions(order))[0]
  await db.query("INSERT INTO outgoing_emails(message_key,reservation_id,recipient,reply_to,subject,body) VALUES('cancelled-confirmation',$1,'parent@example.test','admin@example.test','Queued confirmation','Private test body')", [order])
  await action('cancel-booking', { booking: order })
  const cancelled = await row(order)
  assert.ok(cancelled.cancelled_at)
  assert.equal(cancelled.cancelled_sessions.length, 1)
  assert.equal(cancelled.cancelled_sessions[0].subject, 'Biology')
  assert.equal(cancelled.subtotal_cents, 6000)
  assert.equal(cancelled.refund_cents, 500)
  assert.equal((await sessions(order)).length, 0)
  assert.equal((await db.query("SELECT delivery_allowed FROM outgoing_emails WHERE message_key='cancelled-confirmation'")).rows[0].delivery_allowed, false)
  await action('cancel-booking', { booking: order })
  assert.deepEqual((await row(order)).cancelled_sessions, cancelled.cancelled_sessions, 'Repeated cancellation preserves the original session history')
  await assert.rejects(action('move-session', { session: session.id, date: '2091-05-04', time: '09:00' }), /not found/)
  await assert.rejects(action('mark-booking-paid', { booking: order }), /could not be marked paid/)
  await db.query("INSERT INTO booking_sessions(reservation_id,tutor_id,slot,subject) VALUES($1,$2,tstzrange($3,$4,'[)'),$5)", [order,before.tutor_id,before.start,new Date(before.start.getTime()+3600000),'Biology'])
  // This direct insert only proves the exclusion constraint released the old range; normal admin writes reject cancelled orders.
  await db.query('DELETE FROM booking_sessions WHERE reservation_id=$1', [order])
  console.log('PASS — cancellation releases reserved time while retaining payment/refund/session history; repeated cancellation cannot erase it')
} finally {
  globalThis.fetch = originalFetch
  await pool?.end()
  await db?.end()
  await owner.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE')
  await owner.end()
}
