import assert from 'node:assert/strict'
import test from 'node:test'
import { orderEmails, sendWithResend } from '../src/server/order-email.ts'

test('prepares separate order emails and uses a stable Resend key per recipient', async () => {
  const [customer, admin] = orderEmails({
    id: 'test-reference', familyName: 'Example Parent', customerEmail: 'parent@example.test',
    customerPhone: '(555) 010-1234', packageHours: 5, totalCents: 32000,
    timeZone: 'Europe/Amsterdam',
    sessions: [{ student: 'Emma', subject: 'Biology', tutor: 'Example Tutor',
      meetingInstructions: 'Join https://example.test/room\nBring a notebook.',
      start: new Date('2027-01-05T18:00:00Z') }],
  }, 'admin@example.test')

  assert.equal(customer.to, 'parent@example.test')
  assert.equal(admin.to, 'admin@example.test')
  assert.match(customer.text, /7:00 PM · Emma · Biology with Example Tutor/)
  assert.match(customer.text, /\$320\.00 paid/)
  assert.doesNotMatch(customer.text, /555/)
  assert.match(admin.text, /555/)
  assert.match(customer.text, /How to join\nExample Tutor\nJoin https:\/\/example.test\/room/)
  assert.match(admin.text, /Bring a notebook/)
  assert.notEqual(customer.key, admin.key)

  const id = await sendWithResend(
    { apiKey: 'fake', from: 'bookings@example.test', replyTo: 'support@example.test' },
    customer,
    async (url, request) => {
      assert.equal(url, 'https://api.resend.com/emails')
      assert.equal(request.headers['Idempotency-Key'], customer.key)
      assert.deepEqual(JSON.parse(request.body).to, ['parent@example.test'])
      return Response.json({ id: 'fake-message-id' })
    },
  )
  assert.equal(id, 'fake-message-id')
})

test('provider rejection and missing message IDs fail explicitly', async () => {
  const config = { apiKey: 'fake', from: 'admin@example.test', replyTo: 'admin@example.test' }
  const message = { to: 'tutor@example.test', key: 'contact/one', subject: 'Inquiry', text: 'Question', replyTo: 'parent@example.test' }
  await assert.rejects(sendWithResend(config, message, async () => new Response(null, { status: 429 })), /HTTP 429/)
  await assert.rejects(sendWithResend(config, message, async () => Response.json({})), /email ID/)
  await sendWithResend(config, message, async (_url, request) => {
    assert.equal(JSON.parse(request.body).reply_to, 'parent@example.test')
    return Response.json({ id: 'fake-id' })
  })
})
