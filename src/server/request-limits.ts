import { createHmac } from 'node:crypto'
import { getSecret } from 'astro:env/server'
import type pg from 'pg'

export class RequestLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    const minutes = Math.ceil(retryAfterSeconds / 60)
    super(`Too many attempts. Please try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`)
  }
}

// Read the adapter's address, never a caller-supplied forwarding header.
export function requestAddress(context: { clientAddress: string }) {
  try { return context.clientAddress || 'unavailable' } catch { return 'unavailable' }
}

export async function enforceRequestLimit(
  db: pg.Pool | pg.PoolClient,
  scope: 'admin-login' | 'contact' | 'reservation',
  identity: string,
) {
  // Enable after migration 014 has been applied to that environment.
  if (getSecret('REQUEST_LIMITS_ENABLED') !== '1') return
  const settings = {
    'admin-login': { attempts: 10, seconds: 900 },
    contact: { attempts: 20, seconds: 600 },
    reservation: { attempts: 10, seconds: 900 },
  }[scope]
  const secret = getSecret('REQUEST_LIMIT_SIGNING_KEY') || getSecret('BOOKING_ADMIN_SIGNING_KEY')
  if (!secret) throw new Error('Request protection is not configured.')
  const hash = createHmac('sha256', secret).update(`request-limit:${scope}:${identity}`).digest('hex')
  const result = await db.query<{ attempts: number; retry_after: number }>(
    `WITH expired AS (DELETE FROM request_limits WHERE window_start < now()-interval '24 hours')
     INSERT INTO request_limits(scope,identity_hash,window_start,attempts)
     VALUES ($1,$2,to_timestamp(floor(extract(epoch FROM now())/$3)*$3),1)
     ON CONFLICT (scope,identity_hash,window_start)
     DO UPDATE SET attempts=LEAST(request_limits.attempts+1,$4+1)
     RETURNING attempts,GREATEST(1,ceil(extract(epoch FROM (window_start+($3*interval '1 second')-now()))))::int AS retry_after`,
    [scope, hash, settings.seconds, settings.attempts],
  )
  if (result.rows[0].attempts > settings.attempts) throw new RequestLimitError(result.rows[0].retry_after)
}
