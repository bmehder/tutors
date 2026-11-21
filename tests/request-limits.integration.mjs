import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import pg from 'pg'

const schema = 'request_test_' + randomUUID().replaceAll('-', '')
const url = new URL(process.env.BOOKING_DATABASE_URL)
url.hostname = url.hostname.replace('-pooler.', '.')
const admin = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 8000 })
await admin.connect()
let pool
try {
  await admin.query('CREATE SCHEMA ' + schema)
  await admin.query((await readFile('db/014-request-limits.sql', 'utf8')).replace(/\brequest_limits\b/g, schema + '.request_limits'))
  url.searchParams.set('options', '-c search_path=' + schema + ',public')
  pool = new pg.Pool({ connectionString: url.toString(), max: 20, connectionTimeoutMillis: 8000 })
  const directory = resolve('node_modules/.cache/request-limit-tests')
  await mkdir(directory, { recursive: true })
  await writeFile(directory + '/env.mjs', 'export const getSecret = key => process.env[key]')
  process.env.REQUEST_LIMIT_SIGNING_KEY = 'fake-request-limit-test-key'
  process.env.REQUEST_LIMITS_ENABLED = '1'
  await build({ entryPoints: ['src/server/request-limits.ts'], outfile: directory + '/limits.mjs', bundle: true,
    platform: 'node', format: 'esm', packages: 'external', alias: { 'astro:env/server': directory + '/env.mjs' } })
  const { enforceRequestLimit, RequestLimitError, requestAddress } = await import(directory + '/limits.mjs')
  const attempts = await Promise.allSettled(Array.from({ length: 20 }, () => enforceRequestLimit(pool, 'admin-login', '192.0.2.1')))
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 10)
  for (const attempt of attempts.filter(result => result.status === 'rejected')) {
    assert.ok(attempt.reason instanceof RequestLimitError)
    assert.ok(attempt.reason.retryAfterSeconds > 0 && attempt.reason.retryAfterSeconds <= 900)
  }
  await enforceRequestLimit(pool, 'admin-login', '192.0.2.2')
  await enforceRequestLimit(pool, 'contact', '192.0.2.1')
  const stored = (await pool.query('SELECT identity_hash FROM request_limits')).rows
  assert.ok(stored.every(row => /^[0-9a-f]{64}$/.test(row.identity_hash)))
  assert.ok(!JSON.stringify(stored).includes('192.0.2.'))
  await pool.query("UPDATE request_limits SET window_start=window_start-interval '25 hours'")
  await enforceRequestLimit(pool, 'admin-login', '192.0.2.1')
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM request_limits')).rows[0].count, 1)
  assert.equal(requestAddress({ clientAddress: '192.0.2.9', request: new Request('https://example.test', { headers: { 'x-forwarded-for': 'spoofed' } }) }), '192.0.2.9')
  assert.equal(requestAddress({ get clientAddress() { throw new Error('Unavailable') } }), 'unavailable')
  process.env.REQUEST_LIMITS_ENABLED = '0'
  await enforceRequestLimit({ query() { throw new Error('Disabled limiter must not query a pre-migration database') } }, 'contact', '192.0.2.1')
  console.log('PASS — concurrent request limits, independent clients/scopes, expiry, hashed identities and trusted address source')
} finally {
  if (pool) await pool.end()
  await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE')
  await admin.end()
}
