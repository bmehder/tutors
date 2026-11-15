/// <reference types="astro/client" />
import { getSecret } from 'astro:env/server'
import pg from 'pg'
import { subjectCatalog } from './subjects'
import { tutors } from '../lib/tutoring-data'
import { parseTime } from '../lib/session-time'

const url = getSecret('BOOKING_DATABASE_URL')
export const pool = url ? new pg.Pool({ connectionString: url, connectionTimeoutMillis: 5000 }) : undefined

export async function tutorHours(
  includeArchived = false,
  executor: pg.Pool | pg.PoolClient | undefined = pool,
  subjects?: Awaited<ReturnType<typeof subjectCatalog>>,
) {
  const catalogSubjects = subjects ?? await subjectCatalog(executor)
  const originalNames = new Map(catalogSubjects.map(row => [row.catalog_name, row.name]))
  const activeNames = new Set(catalogSubjects.map(row => row.name))
  const profiles = await executor?.query<{ tutor_id: string; name: string; subjects: string[]; archived: boolean; slug: string }>(
    'SELECT p.*, s.slug FROM tutor_profiles p JOIN tutor_profile_slugs s USING (tutor_id) ORDER BY p.name',
  )
  const catalog = new Map(tutors.map(tutor => [tutor.id, {
    id: tutor.id, profileSlug: tutor.id, name: tutor.name, subjects: tutor.subjects.flatMap(name => {
      const current = originalNames.get(name)
      return current ? [current] : []
    }), archived: false,
    days: tutor.days, times: tutor.times,
  }]))
  for (const profile of profiles?.rows ?? []) {
    const existing = catalog.get(profile.tutor_id)
    catalog.set(profile.tutor_id, {
      id: profile.tutor_id, profileSlug: profile.slug, name: profile.name, subjects: profile.subjects.filter(name => activeNames.has(name)),
      archived: profile.archived, days: existing?.days ?? [], times: existing?.times ?? [],
    })
  }
  const result = await executor?.query<{ tutor_id: string; starts_by_day: number[][] }>(
    'SELECT tutor_id, starts_by_day FROM tutor_weekly_hours',
  )
  const overrides = new Map(result?.rows.map(row => [row.tutor_id, row.starts_by_day]))
  return [...catalog.values()].filter(tutor => includeArchived || !tutor.archived).map(tutor => ({
    ...tutor,
    startsByDay: overrides.get(tutor.id) ?? Array.from({ length: 7 }, (_, day) =>
      tutor.days.includes(day) ? tutor.times.map(parseTime) : [],
    ),
  }))
}
