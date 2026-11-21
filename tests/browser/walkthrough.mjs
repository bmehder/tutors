// Runs the real Astro/Lustre UI against disposable database tables and fake Stripe.
// Stops the local server during the test and restores it on the same port afterward.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { once } from 'node:events'
import { spawn, execFileSync } from 'node:child_process'
import pg from 'pg'
import { chromium } from 'playwright'

const origin = 'http://127.0.0.1:5200'
const directory = resolve('node_modules/.cache/browser-walkthrough')
await mkdir(directory, { recursive: true })
const schema = 'browser_test_' + randomUUID().replaceAll('-', '')
const direct = new URL(process.env.BOOKING_DATABASE_URL)
direct.hostname = direct.hostname.replace('-pooler.', '.')
const db = new pg.Client({ connectionString: direct.toString() })
await db.connect()
let browser, server
let replacedServer = false
const serverErrors = []
const pageErrors = []
const originalEnv = { ...process.env }
const executablePath = process.env.CHROME_EXECUTABLE ?? (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined)
async function buildSite(config, env) {
  const child = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build', ...(config ? ['--config', relative(resolve('.'), config)] : [])],
    { cwd: resolve('.'), env, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', data => { output += data })
  child.stderr.on('data', data => { output += data })
  const [code] = await once(child, 'exit')
  if (code) throw new Error('Browser test build failed: ' + output.slice(-3500))
}
function startServer(env) {
  const child = spawn(process.execPath, [directory + '/server.mjs'],
    { cwd: resolve('.'), env, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', () => {})
  child.stderr.on('data', data => serverErrors.push(String(data)))
  return child
}
async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(origin + '/admin')).status === 200) return } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('Test server did not become ready. ' + serverErrors.join('\n').slice(-2500))
}
async function stopServer(child) {
  if (!child || child.exitCode !== null) return
  await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM') })
}
function monitor(page) {
  page.on('pageerror', error => pageErrors.push(error.message))
}
async function noOverflow(page, label) {
  const widths = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }))
  assert.ok(widths.content <= widths.viewport + 1, label + ': horizontal overflow ' + JSON.stringify(widths))
}
async function capture(page, name) {
  await page.screenshot({ path: directory + '/' + name + '.png', fullPage: true })
  if (await page.locator('#family-planner').count()) await page.locator('#family-planner').screenshot({ path: directory + '/' + name + '-planner.png' })
}
try {
  await db.query('CREATE SCHEMA ' + schema)
  const tables = ['tutor_profiles', 'tutor_profile_slugs', 'tutor_weekly_hours', 'tutoring_subjects',
    'booking_reservations', 'booking_sessions', 'outgoing_emails']
  for (const table of tables) await db.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`)
  const workerTable = await db.query("SELECT to_regclass('public.email_worker_status') AS table_name")
  if (workerTable.rows[0].table_name) await db.query(`CREATE TABLE ${schema}.email_worker_status (LIKE public.email_worker_status INCLUDING ALL)`)
  for (const table of tables.slice(0, 4)) await db.query(`INSERT INTO ${schema}.${table} SELECT * FROM public.${table}`)
  // Synthetic availability exists only in this test schema.
  const starts = Array.from({ length: 7 }, () => Array.from({ length: 41 }, (_, i) => 540 + i * 15))
  for (const id of ['heather-barrieau', 'chris-leingang', 'melissa-lopez'])
    await db.query(`INSERT INTO ${schema}.tutor_weekly_hours(tutor_id,starts_by_day) VALUES($1,$2)
      ON CONFLICT(tutor_id) DO UPDATE SET starts_by_day=excluded.starts_by_day`, [id, JSON.stringify(starts)])
  await db.query(`UPDATE ${schema}.tutor_profiles SET meeting_instructions='Test meeting room: https://meeting.example.test/room. Bring your textbook.'`)
  const scoped = new URL(direct)
  scoped.searchParams.set('options', '-c search_path=' + schema + ',public')
  const env = { ...process.env, BOOKING_DATABASE_URL: scoped.toString(), STRIPE_TEST_SECRET_KEY: 'sk_test_browser_fixture',
    STRIPE_TEST_WEBHOOK_SECRET: 'browser-webhook-fixture', EMAIL_DELIVERY_ENABLED: '0', TUTOR_EMAIL_DELIVERY_ENABLED: '0',
    SANDBOX_ORDER_EMAIL_DELIVERY_ENABLED: '0', REQUEST_LIMITS_ENABLED: '0', SANDBOX_DISCOUNTS_ENABLED: '0',
    BOOKING_DEV_ADMIN_EMAIL: 'browser-admin@example.test', BOOKING_DEV_ADMIN_PASSWORD: randomUUID(),
    BOOKING_ADMIN_SIGNING_KEY: randomUUID() }
  env.BOOKING_ADMIN_EMAIL = env.BOOKING_DEV_ADMIN_EMAIL
  env.BOOKING_ADMIN_PASSWORD = env.BOOKING_DEV_ADMIN_PASSWORD
  await writeFile(directory + '/config.mjs', `
import base from ${JSON.stringify(resolve('astro.config.mjs'))}
export default { ...base, outDir: ${JSON.stringify(directory + '/dist/')}, integrations: [...(base.integrations ?? []), {
  name: 'isolated-browser-checkout', hooks: { 'astro:config:setup': ({ injectRoute }) => {
    injectRoute({ pattern: '/__test-checkout/[id]', entrypoint: ${JSON.stringify(directory + '/checkout.ts')}, prerender: false })
  } },
}], vite: { ...base.vite, cacheDir: ${JSON.stringify(directory + '/vite')}, resolve: { ...base.vite.resolve, alias: {
  ...base.vite.resolve.alias, stripe: ${JSON.stringify(resolve('tests/support/stripe-fixture.mjs'))},
} } } }
`)
  await writeFile(directory + '/checkout.ts', `
import { provider } from ${JSON.stringify(resolve('tests/support/stripe-fixture.mjs'))}
import { createHmac } from 'node:crypto'
export const prerender = false
export async function ALL({ params, request, url }) {
  const session = provider.sessions.get(params.id)
  if (!session) return new Response('Test checkout not found', { status:404 })
  if (request.method === 'POST') {
    const form = await request.formData()
    if (String(form.get('card')).replace(/\\D/g,'').endsWith('0002'))
      return new Response('<h1>Payment declined</h1><p>No payment was recorded.</p><a href="' + url.pathname + '">Try again</a>', { headers:{'Content-Type':'text/html'} })
    session.status='complete';session.payment_status='paid'
    const body=JSON.stringify({ type:'checkout.session.completed',livemode:false,data:{object:session} })
    const signature=createHmac('sha256','browser-webhook-fixture').update(body).digest('hex')
    const webhook=await fetch(url.origin+'/api/stripe-webhook',{ method:'POST',headers:{'Content-Type':'application/json','stripe-signature':signature},body })
    if (!webhook.ok) return new Response('Test webhook failed', {status:503})
    return Response.redirect(url.origin+'/checkout/stripe?session_id='+session.id,303)
  }
  return new Response('<h1>Simulated Stripe checkout</h1><p>Total $'+(session.amount_total/100).toFixed(2)+'</p><form method="post"><label>Card number<input name="card" required></label><button>Pay test order</button></form>', { headers:{'Content-Type':'text/html'} })
}
`)
  // Reuse the user's single local port, and never terminate an unrelated process.
  let listeners = []
  try { listeners = execFileSync('lsof', ['-t', '-iTCP:5200', '-sTCP:LISTEN'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean) } catch (error) { if (error.status !== 1) throw error }
  for (const pid of listeners) {
    const command = execFileSync('ps', ['-p', pid, '-o', 'command='], { encoding: 'utf8' })
    assert.ok(command.includes('astro') && command.includes('5200'), 'Port 5200 belongs to another process; refusing to stop it.')
    process.kill(Number(pid), 'SIGTERM')
  }
  replacedServer = true
  await buildSite(directory + '/config.mjs', env)
  await writeFile(directory + '/server.mjs', `
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import app from ${JSON.stringify(resolve('.vercel/output/_functions/entry.mjs'))}
const root = ${JSON.stringify(resolve('.vercel/output/static'))}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.txt':'text/plain'}
http.createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,${JSON.stringify(origin)})
  const file=resolve(root,'.'+decodeURIComponent(url.pathname))
  if(file.startsWith(root+'/') && req.method==='GET') {
   for(const candidate of [file,resolve(file,'index.html'),file+'.html']) {
    try { const contents=await readFile(candidate);res.setHeader('Content-Type',types[extname(candidate)]??'application/octet-stream');res.end(contents);return } catch {}
   }
  }
  const chunks=[];for await(const chunk of req) chunks.push(chunk)
  const request=new Request(url,{method:req.method,headers:{...req.headers,'x-forwarded-for':'127.0.0.1'},...(chunks.length?{body:Buffer.concat(chunks)}:{})})
  const response=await app.fetch(request)
  res.statusCode=response.status
  response.headers.forEach((value,key)=>{if(key!=='set-cookie')res.setHeader(key,value)})
  const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies)
  res.end(Buffer.from(await response.arrayBuffer()))
 } catch(error){console.error(error);res.statusCode=500;res.end('Browser test request failed')}
}).listen(5200,'127.0.0.1')
`)
  server = startServer(env)
  await waitForServer()
  browser = await chromium.launch({ executablePath, headless: true })
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/New_York' })
  const page = await desktop.newPage()
  monitor(page)
  await page.goto(origin + '/#booking')
  await page.locator('#family-planner[aria-busy="false"]').waitFor()
  await capture(page, 'desktop-start')
  await noOverflow(page, 'Desktop homepage')
  // Walkthrough steps are kept below, with assertions on each screen.
  await writeFile(directory + '/ready.json', JSON.stringify({ schema }))
  const runner = process.env.MCT_BROWSER_STEPS ?? 'tests/browser/steps.mjs'
  if (runner) {
    const steps = await import(resolve(runner))
    try { await steps.run({ page, desktop, browser, origin, directory, db, schema, env, monitor, noOverflow, capture, pageErrors }) }
    catch (error) {
      for (const [index, context] of browser.contexts().entries()) for (const [pageIndex, current] of context.pages().entries()) {
        console.error('FAILED SCREEN', current.url(), (await current.locator('body').innerText()).slice(-5500))
        await capture(current, 'failure-' + index + '-' + pageIndex).catch(() => {})
      }
      console.error('SERVER ERRORS', serverErrors.join('\n').slice(-1800))
      throw error
    }
  }
  assert.deepEqual(pageErrors, [], 'Browser JavaScript errors')
  const sent = await db.query(`SELECT count(*)::int AS count FROM ${schema}.outgoing_emails WHERE sent_at IS NOT NULL OR attempts>0`)
  assert.equal(sent.rows[0].count, 0, 'No test should attempt to send an email')
  console.log('PASS — browser walkthrough finished without JavaScript errors, real payments, or attempted email delivery')
} finally {
  await browser?.close()
  await stopServer(server)
  await db.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE')
  await db.end()
  if (replacedServer) {
    await buildSite(undefined, originalEnv)
    const restored = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'dev', '--host', '127.0.0.1', '--port', '5200'], { cwd: resolve('.'), env: originalEnv, stdio: 'ignore', detached: true })
    restored.unref()
    console.log('Restored the normal local server on port 5200.')
  }
}
