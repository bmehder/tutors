// Isolated database tables, fake Stripe transport, and email delivery disabled.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pg from 'pg'
import { build } from 'esbuild'

assert.ok(process.env.BOOKING_DATABASE_URL, 'A development database connection is required.')
const direct = new URL(process.env.BOOKING_DATABASE_URL)
direct.hostname = direct.hostname.replace('-pooler.', '.')
const schema = 'checkout_test_' + randomUUID().replaceAll('-', '')
const admin = new pg.Client({ connectionString: direct.toString() })
await admin.connect()
const directory = resolve('node_modules/.cache/checkout-tests')
await mkdir(directory, { recursive: true })
await writeFile(directory + '/env.mjs', 'export const getSecret = key => process.env[key]')

const originalFetch = globalThis.fetch
let testDb
let pool
try {
  await admin.query('CREATE SCHEMA ' + schema)
  const tables = ['tutor_profiles', 'tutor_profile_slugs', 'tutor_weekly_hours', 'tutoring_subjects',
    'booking_reservations', 'booking_sessions', 'outgoing_emails']
  for (const table of tables) await admin.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`)
  const migrated = (await admin.query(`SELECT 1 FROM information_schema.columns WHERE table_schema=$1
    AND table_name='booking_reservations' AND column_name='checkout_request_id'`, [schema])).rowCount
  if (!migrated) await admin.query((await readFile('db/015-checkout-reliability.sql', 'utf8'))
    .replace(/\bbooking_reservations\b/g, schema + '.booking_reservations'))
  for (const table of tables.slice(0, 4))
    await admin.query(`INSERT INTO ${schema}.${table} SELECT * FROM public.${table}`)
  const scoped = new URL(direct)
  scoped.searchParams.set('options', '-c search_path=' + schema + ',public')
  process.env.BOOKING_DATABASE_URL = scoped.toString()
  process.env.STRIPE_TEST_SECRET_KEY = 'sk_test_simulated_no_network'
  process.env.EMAIL_DELIVERY_ENABLED = '0'
  process.env.SANDBOX_ORDER_EMAIL_DELIVERY_ENABLED = '0'
  process.env.TUTOR_EMAIL_DELIVERY_ENABLED = '0'
  process.env.REQUEST_LIMITS_ENABLED = '0'
  process.env.SANDBOX_DISCOUNTS_ENABLED = '0'
  testDb = new pg.Client({ connectionString: scoped.toString() })
  await testDb.connect()
  await build({ entryPoints: {
    reservations: 'src/pages/api/reservations.ts', availability: 'src/pages/api/tutor-hours.ts',
    reservationsService: 'src/server/checkout-reservations.ts', checkout: 'src/server/stripe-sandbox.ts', holds: 'src/server/checkout-holds.ts',
    database: 'src/server/tutor-hours.ts', provider: resolve('tests/support/stripe-fixture.mjs'),
  }, outdir: directory + '/build', bundle: true, splitting: true, platform: 'node', format: 'esm',
    outExtension: { '.js': '.mjs' }, packages: 'external', define: { 'import.meta.env.DEV': 'false' },
    alias: { 'astro:env/server': directory + '/env.mjs', stripe: resolve('tests/support/stripe-fixture.mjs') },
  })
  globalThis.fetch = async () => { throw new Error('Unexpected network call: tests must not send payments or email.') }
  const { POST } = await import(directory + '/build/reservations.mjs')
  const { GET } = await import(directory + '/build/availability.mjs')
  const { confirmSandboxCheckout } = await import(directory + '/build/checkout.mjs')
  const { reconcileExpiredHolds, releaseExpiredSandboxCheckout } = await import(directory + '/build/holds.mjs')
  const { reserveCheckout } = await import(directory + '/build/reservationsService.mjs')
  const { provider } = await import(directory + '/build/provider.mjs')
  pool = (await import(directory + '/build/database.mjs')).pool
  const tutorId = 'heather-barrieau'
  const subject = (await testDb.query('SELECT subjects[1] AS subject FROM tutor_profiles WHERE tutor_id=$1', [tutorId])).rows[0].subject
  assert.ok(subject)
  const available = Array.from({ length: 7 }, () => Array.from({ length: 48 }, (_, i) => i * 15 + 480))
  await testDb.query(`INSERT INTO tutor_weekly_hours(tutor_id,starts_by_day) VALUES($1,$2)
    ON CONFLICT(tutor_id) DO UPDATE SET starts_by_day=excluded.starts_by_day`, [tutorId, JSON.stringify(available)])
  let day = 1
  const plan = (overrides = {}) => ({ requestId: randomUUID(), checkout: 'stripe', familyName: 'Test Family',
    contactEmail: randomUUID() + '@example.test', contactPhone: '(555) 010-1234', timeZone: 'Europe/Amsterdam',
    packageHours: 5, demoDiscount: false,
    sessions: [{ tutorId, studentId: 'student-one', studentName: 'Example Student', subject,
      date: '2091-01-' + String(day++).padStart(2, '0'), start: 900 }], ...overrides })
  const post = async body => {
    const response = await POST({ request: new Request('https://booking.example.test/api/reservations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), clientAddress: '192.0.2.1' })
    return { status: response.status, ...await response.json() }
  }
  const row = async id => (await testDb.query('SELECT * FROM booking_reservations WHERE id=$1', [id])).rows[0]
  const expire = async id => testDb.query("UPDATE booking_reservations SET expires_at=now()-interval '1 minute',checkout_reconcile_after=NULL WHERE id=$1", [id])
  const sessionCount = async id => (await testDb.query('SELECT count(*)::int AS count FROM booking_sessions WHERE reservation_id=$1', [id])).rows[0].count

  const original = plan()
  const [first, duplicate] = await Promise.all([post(original), post(structuredClone(original))])
  assert.equal(first.status, 201); assert.equal(duplicate.status, 201)
  assert.equal(first.id, duplicate.id); assert.equal(first.checkoutUrl, duplicate.checkoutUrl)
  assert.equal(provider.creates, 1); assert.equal(await sessionCount(first.id), 1)
  assert.equal((await post({ ...original, familyName: 'Changed Family' })).code, 'request_mismatch')
  await testDb.query('UPDATE tutor_weekly_hours SET starts_by_day=$2 WHERE tutor_id=$1', [tutorId, JSON.stringify(Array.from({ length: 7 }, () => []))])
  assert.equal((await post(original)).id, first.id, 'An accepted checkout must survive changed tutor hours')
  await testDb.query('UPDATE tutor_weekly_hours SET starts_by_day=$2 WHERE tutor_id=$1', [tutorId, JSON.stringify(available)])
  console.log('PASS — parallel repeated checkout creates one reservation and one Stripe session; changed payload rejected')

  const lost = plan()
  provider.loseResponse = true
  const failed = await post(lost)
  assert.equal(failed.status, 503)
  const held = (await testDb.query('SELECT * FROM booking_reservations WHERE checkout_request_id=$1', [lost.requestId])).rows[0]
  assert.equal(held.stripe_checkout_id, null); assert.ok(held.checkout_creation_at)
  const beforeRetry = provider.creates
  const recovered = await post(lost)
  assert.equal(recovered.status, 201); assert.equal(recovered.id, held.id); assert.equal(provider.creates, beforeRetry)
  console.log('PASS — response lost after Stripe creation recovers the same payment page with identical parameters')

  const competing = plan()
  const competitor = { ...structuredClone(competing), requestId: randomUUID(), contactEmail: 'other@example.test' }
  const race = await Promise.all([post(competing), post(competitor)])
  assert.deepEqual(race.map(r => r.status).sort(), [201, 409])
  assert.equal(race.find(r => r.status === 409).code, 'time_taken')
  console.log('PASS — two families competing for the same tutor time have exactly one winner')

  const expiring = await post(plan())
  await expire(expiring.id)
  const stripeId = (await row(expiring.id)).stripe_checkout_id
  await reconcileExpiredHolds()
  assert.equal(provider.sessions.get(stripeId).status, 'expired')
  assert.ok((await row(expiring.id)).checkout_released_at)
  assert.equal((await row(expiring.id)).contact_email, null)
  assert.equal(await sessionCount(expiring.id), 0)
  const repeatedExpired = await post(original) // Original is still valid, unrelated to expired hold.
  assert.equal(repeatedExpired.id, first.id)
  console.log('PASS — expired unpaid checkout closes at Stripe before releasing times and clears abandoned contact details')

  const pendingPlan = plan()
  const pending = await post(pendingPlan)
  await expire(pending.id)
  provider.unavailable = true
  await reconcileExpiredHolds()
  assert.equal((await row(pending.id)).checkout_released_at, null)
  const availability = await GET({ url: new URL('https://booking.example.test/api/tutor-hours?includeReservations=1') })
  assert.equal(availability.status, 200)
  // Query the saved range instead of assuming a particular local date/UTC offset.
  const startsAt = (await testDb.query('SELECT (extract(epoch from lower(slot))*1000)::float8 AS start FROM booking_sessions WHERE reservation_id=$1', [pending.id])).rows[0].start
  const visible = await GET({ url: new URL('https://booking.example.test/api/tutor-hours?includeReservations=1') })
  const pendingBlock = (await visible.json()).reservations.find(s => s.start === startsAt)
  assert.ok(pendingBlock); assert.equal(pendingBlock.holdUntil, null)
  assert.equal((await post(pendingPlan)).code, 'checkout_pending')
  provider.unavailable = false
  await expire(pending.id)
  await reconcileExpiredHolds()
  assert.equal((await post(pendingPlan)).code, 'checkout_expired')
  console.log('PASS — provider outage keeps expired times blocked; retries cannot resurrect released checkout')

  const paidPlan = plan()
  const paid = await post(paidPlan)
  const paidSession = provider.sessions.get((await row(paid.id)).stripe_checkout_id)
  paidSession.status = 'complete'; paidSession.payment_status = 'paid'
  await expire(paid.id)
  await reconcileExpiredHolds()
  assert.ok((await row(paid.id)).confirmed_at)
  assert.equal(await sessionCount(paid.id), 1)
  assert.equal((await post(paidPlan)).status, 200)
  const emailCount = (await testDb.query('SELECT count(*)::int AS count FROM outgoing_emails')).rows[0].count
  await Promise.all([confirmSandboxCheckout(paidSession), confirmSandboxCheckout(paidSession)])
  assert.equal((await testDb.query('SELECT count(*)::int AS count FROM outgoing_emails')).rows[0].count, emailCount)
  console.log('PASS — late payment is retained; duplicate payment confirmations queue each email once without sending')

  const racingPayment = await post(plan())
  await expire(racingPayment.id)
  provider.payOnExpire = true
  await reconcileExpiredHolds()
  assert.ok((await row(racingPayment.id)).confirmed_at)
  assert.equal(await sessionCount(racingPayment.id), 1)
  console.log('PASS — payment winning the expiration race confirms the order and retains its tutor times')

  const unknownPlan = plan()
  provider.loseResponse = true
  await post(unknownPlan)
  const unknown = (await testDb.query('SELECT id FROM booking_reservations WHERE checkout_request_id=$1', [unknownPlan.requestId])).rows[0]
  await expire(unknown.id)
  const createsBefore = provider.creates
  await reconcileExpiredHolds()
  assert.equal(provider.creates, createsBefore)
  assert.ok((await row(unknown.id)).checkout_released_at)
  console.log('PASS — expired checkout with a lost creation response is recovered then closed without creating another payment')

  const neverStarted = plan()
  const result = await reserveCheckout({ ...neverStarted, discountRequested: false, stripeRequired: true,
    origin: 'https://booking.example.test', sessions: [{ ...neverStarted.sessions[0], startMinute: 900,
      start: Date.parse(neverStarted.sessions[0].date + 'T20:00:00Z'), end: Date.parse(neverStarted.sessions[0].date + 'T21:00:00Z') }] },
    async () => ({ subtotal: 30000, discount: 0 }))
  await expire(result.id)
  await reconcileExpiredHolds()
  assert.ok((await row(result.id)).checkout_released_at)

  const staleUnknown = plan()
  provider.loseResponse = true
  await post(staleUnknown)
  const stale = (await testDb.query('SELECT id FROM booking_reservations WHERE checkout_request_id=$1', [staleUnknown.requestId])).rows[0]
  await expire(stale.id)
  await testDb.query("UPDATE booking_reservations SET checkout_creation_at=now()-interval '25 hours' WHERE id=$1", [stale.id])
  const staleBefore = provider.creates
  await reconcileExpiredHolds()
  assert.equal(provider.creates, staleBefore)
  assert.equal((await row(stale.id)).checkout_released_at, null)
  console.log('PASS — never-started checkout releases safely; old unknown payment requires review instead of unsafe recreation')

  const email = 'limited@example.test'
  for (let index = 0; index < 3; index++) assert.equal((await post(plan({ contactEmail: email }))).status, 201)
  assert.equal((await post(plan({ contactEmail: email }))).code, 'hold_limit')
  const partial = plan({ sessions: [{ ...original.sessions[0], date: '2090-12-01' }, original.sessions[0]] })
  const beforeConflict = (await testDb.query('SELECT count(*)::int AS count FROM booking_sessions')).rows[0].count
  const second = await post(partial)
  assert.equal(second.code, 'time_taken')
  assert.equal((await testDb.query('SELECT count(*)::int AS count FROM booking_sessions')).rows[0].count, beforeConflict)
  assert.equal((await testDb.query('SELECT 1 FROM booking_reservations WHERE checkout_request_id=$1', [partial.requestId])).rowCount, 0)
  console.log('PASS — one family cannot accumulate unlimited holds; conflicting multi-session checkout rolls back')

  const webhookPlan = plan()
  const webhookHold = await post(webhookPlan)
  const webhookSession = provider.sessions.get((await row(webhookHold.id)).stripe_checkout_id)
  await releaseExpiredSandboxCheckout({ ...webhookSession, livemode: true, status: 'expired' })
  assert.equal((await row(webhookHold.id)).checkout_released_at, null)
  webhookSession.status = 'expired'
  await releaseExpiredSandboxCheckout(webhookSession)
  await releaseExpiredSandboxCheckout(webhookSession)
  assert.ok((await row(webhookHold.id)).checkout_released_at)
  assert.equal((await post(webhookPlan)).code, 'checkout_expired')
  const earlyPlan = plan()
  const early = await post(earlyPlan)
  provider.sessions.get((await row(early.id)).stripe_checkout_id).status = 'expired'
  assert.equal((await post(earlyPlan)).code, 'checkout_expired')
  assert.equal(await sessionCount(early.id), 0)
  console.log('PASS — expired Stripe event safely releases once; live event rejected')

  await testDb.query('UPDATE booking_reservations SET cancelled_at=now() WHERE id=$1', [paid.id])
  await testDb.query('DELETE FROM booking_sessions WHERE reservation_id=$1', [paid.id])
  const messagesBeforeReplay = (await testDb.query('SELECT count(*)::int AS count FROM outgoing_emails')).rows[0].count
  assert.equal(await confirmSandboxCheckout(paidSession), paid.id)
  assert.ok((await row(paid.id)).cancelled_at)
  assert.equal(await sessionCount(paid.id), 0)
  assert.equal((await testDb.query('SELECT count(*)::int AS count FROM outgoing_emails')).rows[0].count, messagesBeforeReplay)
  console.log('PASS — replayed Stripe confirmation cannot restore cancelled sessions or create new order emails')
} finally {
  globalThis.fetch = originalFetch
  await pool?.end()
  await testDb?.end()
  await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE')
  await admin.end()
}
