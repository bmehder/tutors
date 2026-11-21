// Isolated database tables; every email provider call is simulated.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pg from 'pg'
import { build } from 'esbuild'

const direct = new URL(process.env.BOOKING_DATABASE_URL)
direct.hostname = direct.hostname.replace('-pooler.', '.')
const admin = new pg.Client({ connectionString: direct.toString() })
await admin.connect()
const schema = 'operations_test_' + randomUUID().replaceAll('-', '')
const directory = resolve('node_modules/.cache/email-operations-tests')
await mkdir(directory, { recursive: true })
await writeFile(directory + '/env.mjs', 'export const getSecret = key => process.env[key]')
let db, pool
const originalFetch = globalThis.fetch
let sends = 0
try {
  await admin.query('CREATE SCHEMA ' + schema)
  for (const table of ['tutor_profiles', 'outgoing_emails'])
    await admin.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`)
  const scoped = new URL(direct)
  scoped.searchParams.set('options', '-c search_path=' + schema)
  process.env.BOOKING_DATABASE_URL = scoped.toString()
  process.env.EMAIL_DELIVERY_ENABLED = '1'
  process.env.RESEND_API_KEY = 'simulated-operations-key'
  process.env.EMAIL_WORKER_SECRET = 'simulated-operations-worker-secret'
  process.env.TUTOR_EMAIL_DELIVERY_ENABLED = '0'
  db = new pg.Client({ connectionString: scoped.toString() })
  await db.connect()
  await build({ entryPoints: { operations: 'src/server/email-operations.ts', worker: 'src/pages/api/deliver-emails.ts', database: 'src/server/tutor-hours.ts' },
    outdir: directory + '/build', bundle: true, splitting: true, platform: 'node', format: 'esm', packages: 'external',
    outExtension: { '.js': '.mjs' }, alias: { 'astro:env/server': directory + '/env.mjs' },
  })
  const { emailOperations, startEmailWorkerCheck, finishEmailWorkerCheck } = await import(directory + '/build/operations.mjs')
  const { POST } = await import(directory + '/build/worker.mjs')
  pool = (await import(directory + '/build/database.mjs')).pool
  globalThis.fetch = async (url, request) => {
    assert.equal(url, 'https://api.resend.com/emails')
    assert.ok(!JSON.parse(request.body).to.includes('tutor@example.test'), 'Tutor email must stay blocked')
    sends++
    return Response.json({ id: 'simulated-' + randomUUID() })
  }
  assert.equal((await emailOperations(pool)).worker.state, 'unavailable', 'Missing migration must not break admin or sending')
  await db.query(await readFile('db/016-email-worker-status.sql', 'utf8'))
  await db.query("INSERT INTO tutor_profiles(tutor_id,name,subjects,contact_email) VALUES('test-tutor','Test tutor','{}','tutor@example.test')")
  const insert = async (key, recipient, extra = {}) => {
    await db.query(`INSERT INTO outgoing_emails(message_key,recipient,reply_to,subject,body,delivery_allowed,sent_at,first_attempt_at,last_error,attempts)
      VALUES($1,$2,'admin@example.test','Example '||$1,'Private body must not appear in status',$3,$4,$5,$6,$7)`,
      [key,recipient,extra.allowed ?? true,extra.sent ?? null,extra.firstAttempt ?? null,extra.error ?? null,extra.attempts ?? 0])
  }
  const hourAgo = new Date(Date.now() - 3600000)
  await insert('accepted', 'parent@example.test', { sent: new Date() })
  await insert('waiting', 'parent@example.test')
  await insert('retrying', 'parent@example.test', { firstAttempt: hourAgo, error: 'Provider unavailable', attempts: 1 })
  await insert('uncertain', 'parent@example.test', { firstAttempt: new Date(Date.now() - 25 * 3600000), attempts: 2 })
  await insert('order-confirmation/paused/tutor/test-tutor', 'tutor@example.test', { firstAttempt: hourAgo, error: 'Old error', attempts: 1 })
  await insert('draft', 'parent@example.test', { allowed: false })
  const before = await emailOperations(pool)
  assert.deepEqual([before.accepted,before.waiting,before.retrying,before.needsReview,before.held,before.drafts], [1,1,1,1,1,1])
  assert.equal(before.worker.state, 'never')
  assert.equal(before.issues.length, 2)
  assert.equal(before.issues[0].state, 'review')
  assert.ok(!JSON.stringify(before).includes('Private body'))
  assert.equal(sends, 0)
  console.log('PASS — read-only operations distinguish queued, retrying, uncertain, held tutor and blocked draft messages without sending or exposing bodies')

  const start = await startEmailWorkerCheck(db)
  assert.equal((await emailOperations(pool)).worker.state, 'running')
  const newer = await startEmailWorkerCheck(db)
  await finishEmailWorkerCheck(db, start, 0, false)
  assert.equal((await emailOperations(pool)).worker.state, 'running', 'Old completion must not overwrite a newer worker')
  await finishEmailWorkerCheck(db, newer, 0, true)
  assert.equal((await emailOperations(pool)).worker.state, 'healthy')
  await db.query("UPDATE email_worker_status SET finished_at=now()-interval '20 minutes'")
  assert.equal((await emailOperations(pool)).worker.state, 'overdue')
  const failed = await startEmailWorkerCheck(db)
  await finishEmailWorkerCheck(db, failed, 0, false)
  assert.equal((await emailOperations(pool)).worker.state, 'failed')
  await startEmailWorkerCheck(db)
  await db.query("UPDATE email_worker_status SET started_at=now()-interval '3 minutes'")
  assert.equal((await emailOperations(pool)).worker.state, 'stalled')
  console.log('PASS — worker health covers first run, active, successful, overdue, failed and stalled checks; concurrent completions are safe')

  const request = token => ({ request: new Request('https://example.test/api/deliver-emails', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: '{}',
  }) })
  assert.equal((await POST(request('invalid'))).status, 401)
  assert.equal(sends, 0)
  const result = await POST(request(process.env.EMAIL_WORKER_SECRET))
  assert.equal(result.status, 200)
  assert.equal(sends, 2, 'Only waiting/retryable messages are sent through the simulated transport')
  const after = await emailOperations(pool)
  assert.equal(after.worker.state, 'healthy')
  assert.deepEqual([after.accepted,after.waiting,after.retrying,after.needsReview,after.held,after.drafts], [3,0,0,1,1,1])
  assert.ok(after.worker.checkedAt.endsWith('Eastern'))
  console.log('PASS — authenticated worker records completion; unauthorized calls, old uncertain messages, tutor holds and drafts cannot send')
} finally {
  globalThis.fetch = originalFetch
  await pool?.end()
  await db?.end()
  await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE')
  await admin.end()
}
