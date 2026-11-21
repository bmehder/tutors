import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
const directory = resolve('node_modules/.cache/planner-retry-tests')
await mkdir(directory, { recursive: true })
await build({ stdin: { contents: `
  export * as model from './planner/build/dev/javascript/christian_tutors_planner/planner/model.mjs'
  export { init, update } from './planner/build/dev/javascript/christian_tutors_planner/christian_tutors_planner.mjs'
  export { afterPayment } from './planner/build/dev/javascript/christian_tutors_planner/planner_ffi.mjs'
  export { toList } from './planner/build/dev/javascript/christian_tutors_planner/gleam_lists.mjs'
  export { Option$None, Option$Some$0 } from './planner/build/dev/javascript/gleam_stdlib/gleam/option.mjs'
`, resolveDir: resolve('.') }, outfile: directory + '/app.mjs', bundle: true, platform: 'node', format: 'esm',
  packages: 'external', alias: { '@booking': resolve('src/lib') } })
const { model, init, update, afterPayment, toList, Option$None, Option$Some$0 } = await import(directory + '/app.mjs')

const empty = toList([])
const order = model.Order$Order(5, model.ContactInfo$ContactInfo('Example Family', 'parent@example.test', '(555) 010-1234'), empty, empty, empty, Option$None())

test('temporary checkout failure keeps the accepted order ready to retry; conflicts return to review', () => {
  const original = { ...init()[0], step: model.BookingStep$PayForOrder(order, model.PaymentState$Processing()) }
  const retry = update(original, model.Msg$CheckoutTemporarilyUnavailable('Please try again.'))[0]
  assert.ok(model.BookingStep$isPayForOrder(retry.step))
  assert.equal(model.BookingStep$PayForOrder$0(retry.step), order)
  assert.ok(model.PaymentState$isNotProcessing(model.BookingStep$PayForOrder$1(retry.step)))
  assert.equal(Option$Some$0(retry.error), 'Please try again.')
  const conflict = update(original, model.Msg$DemoReservationFailed('That time was taken.'))[0]
  assert.ok(model.BookingStep$isReviewFamilyPlan(conflict.step))
})

test('browser retry avoids refreshing availability against its own hold and reuses the request identity', async () => {
  const original = { fetch: globalThis.fetch, window: globalThis.window, document: globalThis.document }
  let onRedirect
  let reject = true
  const requests = []
  globalThis.window = {
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { assign: url => onRedirect({ kind: 'redirect', url }) },
  }
  globalThis.document = { getElementById: () => ({ dataset: { stripeSandbox: '1' } }) }
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/reservations', 'A temporary failure must not reload availability and block its own hold')
    requests.push(JSON.parse(options.body))
    return reject ? Response.json({ error: 'Please try again.' }, { status: 503 })
      : Response.json({ checkoutUrl: 'https://checkout.example.test/same-session' }, { status: 201 })
  }
  const attempt = () => new Promise(resolve => {
    onRedirect = resolve
    afterPayment(order, 'Europe/Amsterdam', resolve, { kind: 'complete' },
      issue => ({ kind: 'review', issue }), issue => ({ kind: 'retry', issue }))
  })
  try {
    assert.equal((await attempt()).kind, 'retry')
    reject = false
    assert.equal((await attempt()).kind, 'redirect')
    assert.equal(requests.length, 2)
    assert.equal(requests[0].requestId, requests[1].requestId)
  } finally {
    globalThis.fetch = original.fetch
    globalThis.window = original.window
    globalThis.document = original.document
  }
})
