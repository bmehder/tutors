import type { APIRoute } from 'astro'
import { pool, tutorHours } from '../../server/tutor-hours'

export const prerender = false
export const GET: APIRoute = async ({ url }) => {
  const headers = { 'Cache-Control': 'no-store' }
  try {
    if (url.searchParams.get('includeReservations') !== '1') {
      return Response.json(await tutorHours(), { headers })
    }
    const [tutors, reservations] = await Promise.all([
      tutorHours(),
      pool?.query<{ tutorId: string; start: number; end: number; holdUntil: number | null }>(`
        SELECT s.tutor_id AS "tutorId",
               (EXTRACT(EPOCH FROM lower(s.slot)) * 1000)::float8 AS start,
               (EXTRACT(EPOCH FROM upper(s.slot)) * 1000)::float8 AS "end",
               CASE WHEN r.confirmed_at IS NULL
                 THEN (EXTRACT(EPOCH FROM r.expires_at) * 1000)::float8
               END AS "holdUntil"
        FROM booking_sessions s
        JOIN booking_reservations r ON r.id = s.reservation_id
        WHERE upper(s.slot) > now()
          AND (r.confirmed_at IS NOT NULL OR r.expires_at > now())
        ORDER BY s.tutor_id, lower(s.slot), upper(s.slot)
      `),
    ])
    return Response.json({ tutors, reservations: reservations?.rows ?? null }, { headers })
  } catch {
    return Response.json({ error: 'Tutor schedules are temporarily unavailable.' }, { status: 503, headers })
  }
}
