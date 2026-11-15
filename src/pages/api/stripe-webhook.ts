/// <reference types="astro/client" />
import type { APIRoute } from 'astro'
import { getSecret } from 'astro:env/server'
import { confirmSandboxCheckout, stripe } from '../../server/stripe-sandbox'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const secret = getSecret('STRIPE_TEST_WEBHOOK_SECRET')
  const signature = request.headers.get('stripe-signature')
  if (!stripe || !secret) return new Response(null, { status: 404 })
  if (!signature) return new Response(null, { status: 400 })

  let event
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret)
  } catch {
    return new Response(null, { status: 400 })
  }
  if (event.livemode) return new Response(null, { status: 400 })
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    if (session.payment_status === 'paid' && !(await confirmSandboxCheckout(session)))
      return new Response(null, { status: 503 })
  }
  return new Response(null, { status: 204 })
}
