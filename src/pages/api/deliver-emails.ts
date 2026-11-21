import type { APIRoute } from 'astro'
import { pool } from '../../server/tutor-hours'
import { startEmailWorkerCheck, finishEmailWorkerCheck } from '../../server/email-operations'
import { getSecret } from 'astro:env/server'
import { timingSafeEqual } from 'node:crypto'
import { deliverQueuedEmails, emailQueueStatus, emailDeliveryEnabled, tutorEmailDeliveryEnabled } from '../../server/email-delivery'

export const prerender = false
export const POST: APIRoute = async ({ request }) => {
  const secret = getSecret('EMAIL_WORKER_SECRET')
  const auth = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (!secret || Buffer.byteLength(auth) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return new Response(null, { status: 401 })
  }
  const runId = pool ? await startEmailWorkerCheck(pool).catch(() => null) : null
  try {
    const sent = await deliverQueuedEmails()
    if (pool) await finishEmailWorkerCheck(pool, runId, sent, true).catch(() => { console.warn('Email worker status could not be recorded.') })
    return Response.json({ sent, ...await emailQueueStatus(), deliveryEnabled: emailDeliveryEnabled, tutorDeliveryEnabled: tutorEmailDeliveryEnabled() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    if (pool) await finishEmailWorkerCheck(pool, runId, 0, false).catch(() => {})
    return new Response(null, { status: 503 })
  }
}
