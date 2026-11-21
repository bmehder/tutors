import { createHmac } from 'node:crypto'

export const provider = { sessions: new Map(), keys: new Map(), creates: 0,
  loseResponse: false, unavailable: false, payOnExpire: false }
export default class Stripe {
  webhooks = { constructEvent(body, signature, secret) {
    const expected = createHmac('sha256', secret).update(body).digest('hex')
    if (signature !== expected) throw new Error('Invalid test webhook signature')
    return JSON.parse(body)
  } }

  checkout = { sessions: {
    create: async (params, { idempotencyKey }) => {
      const previous = provider.keys.get(idempotencyKey)
      if (previous && previous.params !== JSON.stringify(params)) throw new Error('Changed idempotent parameters')
      if (!previous) {
        const id = 'cs_test_' + ++provider.creates
        const session = { id, livemode: false, mode: 'payment', status: 'open', payment_status: 'unpaid',
          currency: 'usd', amount_total: params.line_items[0].price_data.unit_amount,
          client_reference_id: params.client_reference_id, url: new URL('/__test-checkout/' + id, params.success_url).toString() }
        provider.sessions.set(id, session)
        provider.keys.set(idempotencyKey, { params: JSON.stringify(params), id })
      }
      if (provider.loseResponse) { provider.loseResponse = false; throw new Error('Response lost after creating checkout') }
      return { ...provider.sessions.get(provider.keys.get(idempotencyKey).id) }
    },
    retrieve: async id => {
      if (provider.unavailable) throw new Error('Stripe temporarily unavailable')
      return { ...provider.sessions.get(id) }
    },
    expire: async id => {
      const session = provider.sessions.get(id)
      if (provider.payOnExpire) {
        provider.payOnExpire = false; session.status = 'complete'; session.payment_status = 'paid'
        throw new Error('Payment completed before expiration')
      }
      if (session.status !== 'open') throw new Error('Checkout no longer open')
      session.status = 'expired'
      return { ...session }
    },
  } }
}
