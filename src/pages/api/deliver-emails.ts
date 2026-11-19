import type { APIRoute } from 'astro'
import { getSecret } from 'astro:env/server'
import { timingSafeEqual } from 'node:crypto'
import { deliverQueuedEmails } from '../../server/email-delivery'

export const prerender = false
export const POST: APIRoute = async ({ request }) => {
  const secret = getSecret('EMAIL_WORKER_SECRET')
  const auth = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (!secret || Buffer.byteLength(auth) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return new Response(null, { status: 401 })
  }
  try {
    return Response.json({ sent: await deliverQueuedEmails() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return new Response(null, { status: 503 })
  }
}
