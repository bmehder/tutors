import type { APIRoute } from 'astro'
import { tutorHours } from '../../server/tutor-hours'

export const prerender = false
export const GET: APIRoute = async () => {
  const headers = { 'Cache-Control': 'no-store' }
  try {
    return Response.json(await tutorHours(), { headers })
  } catch {
    return Response.json({ error: 'Tutor schedules are temporarily unavailable.' }, { status: 503, headers })
  }
}
