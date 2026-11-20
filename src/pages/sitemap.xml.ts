import type { APIRoute } from 'astro'
import { sitemapXml } from '../lib/seo'
import { tutorHours } from '../server/tutor-hours'

export const prerender = false

export const GET: APIRoute = async () => {
  try {
    const tutors = await tutorHours()
    return new Response(sitemapXml(['/', '/tutors', ...tutors.map(tutor => `/tutors/${encodeURIComponent(tutor.profileSlug)}`)]), {
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  } catch {
    return new Response('Sitemap temporarily unavailable.', { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
