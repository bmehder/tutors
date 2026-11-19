// Run with npm run test:email. Uses an isolated schema and replaces email transport.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pg from 'pg'
import { build } from 'esbuild'

assert.ok(process.env.BOOKING_DATABASE_URL, 'A development database connection is required.')
const originalUrl = process.env.BOOKING_DATABASE_URL
const schema = 'email_test_' + randomUUID().replaceAll('-', '')
const admin = new pg.Client({ connectionString: originalUrl })
await admin.connect()
const directory = resolve('node_modules/.cache/email-tests')
await mkdir(directory, { recursive: true })
await writeFile(directory + '/env.mjs', 'export const getSecret = key => process.env[key]')
await writeFile(directory + '/astro-actions-stub.mjs', `
export const defineAction = action => action
export class ActionError extends Error {
  constructor(options) { super(options.message); this.code = options.code }
}
`)
const tables = ['tutor_profiles', 'tutor_profile_slugs', 'tutor_weekly_hours', 'tutoring_subjects',
  'booking_reservations', 'booking_sessions', 'outgoing_emails']
let testDb
let pool
let calls = []
let rejectNext = false
const originalFetch = globalThis.fetch
try {
  await admin.query('CREATE SCHEMA ' + schema)
  for (const table of tables)
    await admin.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`)
  for (const table of tables.slice(0, 4))
    await admin.query(`INSERT INTO ${schema}.${table} SELECT * FROM public.${table}`)

  const url = new URL(originalUrl)
  url.searchParams.set('options', '-c search_path=' + schema + ',public')
  process.env.BOOKING_DATABASE_URL = url.toString()
  process.env.EMAIL_DELIVERY_ENABLED = '1'
  process.env.RESEND_API_KEY = 'fake-key-for-simulated-email-tests'
  testDb = new pg.Client({ connectionString: url.toString() })
  await testDb.connect()
  await build({
    entryPoints: { actions: 'src/actions/index.ts', delivery: 'src/server/email-delivery.ts',
      confirmation: 'src/server/stripe-sandbox.ts', database: 'src/server/tutor-hours.ts' },
    outdir: directory, bundle: true, splitting: true, platform: 'node', format: 'esm',
    outExtension: { '.js': '.mjs' }, packages: 'external',
    define: { 'import.meta.env.DEV': 'false' },
    alias: { 'astro:env/server': directory + '/env.mjs',
      'astro:actions': directory + '/astro-actions-stub.mjs', 'astro/zod': 'zod' },
  })
  globalThis.fetch = async (url, request) => {
    assert.equal(url, 'https://api.resend.com/emails', 'Unexpected network request')
    const message = JSON.parse(request.body)
    calls.push({ ...message, key: request.headers['Idempotency-Key'] })
    if (rejectNext) { rejectNext = false; return new Response(null, { status: 503 }) }
    return Response.json({ id: 'simulated-' + randomUUID() })
  }
  await testDb.query("UPDATE tutor_profiles SET contact_email='tutor@example.test' WHERE tutor_id='heather-barrieau'")
  const { server } = await import(directory + '/actions.mjs')
  const { deliverQueuedEmails, queueEmail } = await import(directory + '/delivery.mjs')
  const { confirmSandboxCheckout } = await import(directory + '/confirmation.mjs')
  pool = (await import(directory + '/database.mjs')).pool
  const action = server.previewContact
  const submit = async input => action.handler(action.input.parse(input))
  const parentEmail = 'parent@example.test'
  const base = { 'first-name': 'Example', 'last-name': 'Parent', email: parentEmail,
    phone: '(555) 010-1234', message: 'Example question' }
  const requestId = randomUUID()
  await submit({ ...base, 'contact-type': 'family', 'request-id': requestId })
  await submit({ ...base, 'contact-type': 'family', 'request-id': requestId })
  assert.equal(calls.length, 1, 'Repeated form submission should send once')
  assert.deepEqual(calls[0].to, ['admin@mychristiantutors.com'])
  await submit({ ...base, 'contact-type': 'tutor-inquiry', 'tutor-id': 'heather-barrieau',
    'request-id': randomUUID() })
  assert.deepEqual(calls[1].to, ['tutor@example.test'])
  assert.equal(calls[1].reply_to, parentEmail)
  await submit({ ...base, 'contact-type': 'tutor', 'request-id': randomUUID(), subjects: 'Biology',
    grades: 'High school', experience: 'Classroom teaching', availability: 'Weekdays',
    approach: 'Christian worldview' })
  assert.deepEqual(calls[2].to, ['admin@mychristiantutors.com'])
  await assert.rejects(() => submit({ ...base, 'contact-type': 'family', website: 'spam' }))
  console.log('PASS — contact, tutor inquiry and application routing; duplicate submission; spam field')

  const key = 'retry/' + randomUUID()
  rejectNext = true
  await queueEmail(testDb, { key, to: 'retry@example.test', subject: 'Retry', text: 'Example' })
  await Promise.all([deliverQueuedEmails(), deliverQueuedEmails()])
  let row = (await testDb.query('SELECT * FROM outgoing_emails WHERE message_key=$1', [key])).rows[0]
  assert.equal(row.attempts, 1)
  assert.ok(row.first_attempt_at)
  assert.equal(row.sent_at, null)
  await testDb.query("UPDATE outgoing_emails SET attempted_at=now()-interval '6 minutes' WHERE message_key=$1", [key])
  await Promise.all([deliverQueuedEmails(), deliverQueuedEmails()])
  row = (await testDb.query('SELECT * FROM outgoing_emails WHERE message_key=$1', [key])).rows[0]
  assert.equal(row.attempts, 2)
  assert.ok(row.sent_at)
  assert.ok(row.resend_id)
  const callsBeforeExpiry = calls.length
  await testDb.query("UPDATE outgoing_emails SET sent_at=NULL,attempted_at=now()-interval '6 minutes',first_attempt_at=now()-interval '25 hours' WHERE message_key=$1", [key])
  await deliverQueuedEmails()
  assert.equal(calls.length, callsBeforeExpiry)
  console.log('PASS — failure recovery, concurrent workers, delivery record and expired retry protection')

  const id = randomUUID()
  const sessionId = 'cs_test_' + randomUUID().replaceAll('-', '')
  await testDb.query("UPDATE tutor_profiles SET meeting_instructions='Join the room. Bring a notebook.' WHERE tutor_id='heather-barrieau'")
  await testDb.query(`INSERT INTO booking_reservations
    (id,expires_at,package_hours,label,subtotal_cents,discount_cents,stripe_checkout_required,
     stripe_checkout_id,contact_email,contact_phone,requires_contact,display_time_zone)
    VALUES($1,now()+interval '5 minutes',5,'Example Parent',30000,0,true,$2,
      'parent@example.test','5550101234',true,'Europe/Amsterdam')`, [id, sessionId])
  await testDb.query(`INSERT INTO booking_sessions(reservation_id,tutor_id,slot,subject,student_name)
    VALUES($1,'heather-barrieau',tstzrange('2091-01-02T18:00:00Z','2091-01-02T19:00:00Z','[)'),'Biology','Emma')`, [id])
  const paid = { id: sessionId, livemode: false, mode: 'payment', status: 'complete',
    payment_status: 'paid', currency: 'usd', amount_total: 30000, client_reference_id: id }
  await Promise.all([confirmSandboxCheckout(paid), confirmSandboxCheckout(paid)])
  const messages = (await testDb.query('SELECT * FROM outgoing_emails WHERE reservation_id=$1', [id])).rows
  assert.equal(messages.length, 3)
  assert.ok(messages.every(message => !message.delivery_allowed && !message.sent_at))
  assert.match(messages.find(message => message.recipient === parentEmail).body, /Bring a notebook/)
  assert.match(messages.find(message => message.recipient === 'tutor@example.test').body, /Emma/)
  assert.equal(await confirmSandboxCheckout({ ...paid, amount_total: 1 }), null)
  console.log('PASS — paid-order customer/admin/tutor drafts, meeting instructions and payment validation')
  console.log('All email transport was simulated. No emails were sent.')
} finally {
  globalThis.fetch = originalFetch
  if (pool) await pool.end()
  if (testDb) await testDb.end()
  await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE')
  await admin.end()
}
