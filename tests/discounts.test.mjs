import assert from 'node:assert/strict'
import test from 'node:test'
import { checkoutDiscount } from '../src/server/discounts.ts'

test('test discounts require a sandbox payment and explicit server permission', () => {
  for (const subtotal of [30000, 55000, 100000]) {
    assert.deepEqual(checkoutDiscount(subtotal, true, { paymentMode: 'sandbox', sandboxDiscountsEnabled: true }), { kind: 'accepted', amountCents: subtotal / 5 })
    assert.equal(checkoutDiscount(subtotal, true, { paymentMode: 'sandbox', sandboxDiscountsEnabled: false }).kind, 'unavailable')
    for (const paymentMode of ['live', 'mock'])
      assert.equal(checkoutDiscount(subtotal, true, { paymentMode, sandboxDiscountsEnabled: true }).kind, 'unavailable')
  }
})

test('ordinary checkout never acquires a discount from a server setting alone', () => {
  assert.deepEqual(checkoutDiscount(30000, false, { paymentMode: 'sandbox', sandboxDiscountsEnabled: true }), { kind: 'accepted', amountCents: 0 })
  assert.deepEqual(checkoutDiscount(30000, false, { paymentMode: 'live', sandboxDiscountsEnabled: false }), { kind: 'accepted', amountCents: 0 })
})
