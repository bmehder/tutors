/// <reference types="astro/client" />
import { getSecret } from 'astro:env/server'
import pg from 'pg'
import { tutors } from '../lib/tutoring-data'
import { parseTime } from '../lib/session-time'

const url = getSecret('BOOKING_DATABASE_URL')
export const pool = url ? new pg.Pool({ connectionString: url, connectionTimeoutMillis: 5000 }) : undefined

export async function tutorHours(includeArchived = false) {
  const profiles = await pool?.query<{ tutor_id: string; name: string; subjects: string[]; archived: boolean }>(
    'SELECT * FROM tutor_profiles ORDER BY name',
  )
  const catalog = new Map(tutors.map(tutor => [tutor.id, {
    id: tutor.id, name: tutor.name, subjects: tutor.subjects, archived: false,
    days: tutor.days, times: tutor.times,
  }]))
  for (const profile of profiles?.rows ?? []) {
    const existing = catalog.get(profile.tutor_id)
    catalog.set(profile.tutor_id, {
      id: profile.tutor_id, name: profile.name, subjects: profile.subjects,
      archived: profile.archived, days: existing?.days ?? [], times: existing?.times ?? [],
    })
  }
  const result = await pool?.query<{ tutor_id: string; starts_by_day: number[][] }>(
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
