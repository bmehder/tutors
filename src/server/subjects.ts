import type pg from 'pg'
import { SUBJECTS } from '../lib/tutoring-data'

export async function subjectCatalog(executor: pg.Pool | pg.PoolClient | undefined) {
  if (!executor) return SUBJECTS.map(name => ({ name, catalog_name: name }))
  const result = await executor.query<{ name: string; catalog_name: string | null }>(
    'SELECT name, catalog_name FROM tutoring_subjects ORDER BY name',
  )
  return result.rows
}

