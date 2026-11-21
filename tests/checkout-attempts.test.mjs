import test from 'node:test'
import assert from 'node:assert/strict'
import { checkoutAttempts } from '../planner/src/checkout_request.mjs'

test('reconstructed plans retry the same checkout; changed and expired plans start a new attempt', async () => {
  let sequence = 0
  const attempts = checkoutAttempts(() => String(++sequence))
  const plan = { packageHours: 5, sessions: [{ tutorId: 'example', start: 900 }] }
  const first = await attempts.forPlan(plan)
  assert.equal((await attempts.forPlan(structuredClone(plan))).requestId, first.requestId)
  const changed = await attempts.forPlan({ ...plan, packageHours: 10 })
  assert.notEqual(changed.requestId, first.requestId)
  attempts.expired(first.requestId) // A late error must not discard the newer plan.
  assert.equal((await attempts.forPlan({ ...plan, packageHours: 10 })).requestId, changed.requestId)
  attempts.expired(changed.requestId)
  assert.notEqual((await attempts.forPlan({ ...plan, packageHours: 10 })).requestId, changed.requestId)
})


test('returning from Stripe reuses a saved attempt without storing contact details', async () => {
  const saved = new Map()
  const storage = { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) }
  const plan = { contactEmail: 'example@example.test', familyName: 'Example Family', sessions: [] }
  const first = await checkoutAttempts(() => 'first-id', storage).forPlan(plan)
  const restored = checkoutAttempts(() => 'should-not-be-used', storage)
  assert.equal((await restored.forPlan(plan)).requestId, first.requestId)
  const stored = [...saved.values()][0]
  assert.ok(!stored.includes(plan.contactEmail) && !stored.includes(plan.familyName))
  restored.expired(first.requestId)
  assert.equal(saved.size, 0)
})
