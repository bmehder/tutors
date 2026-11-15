import type pg from 'pg'
import { tutorHours } from './tutor-hours'
import { subjectCatalog } from './subjects'

export async function editSubject(database: pg.Pool, action: string, form: FormData) {
  const original = String(form.get('original-subject') ?? '')
  const name = String(form.get('subject-name') ?? '').trim()
  if (action !== 'delete-subject' && (!name || name.length > 120))
    throw new Error('Enter a subject name between 1 and 120 characters.')

  const client = await database.connect()
  try {
    await client.query('BEGIN')
    const catalog = await subjectCatalog(client)
    if (action === 'create-subject') {
      await client.query('INSERT INTO tutoring_subjects (name) VALUES ($1)', [name])
    } else {
      const current = await client.query('SELECT id FROM tutoring_subjects WHERE name=$1 FOR UPDATE', [original])
      if (!current.rowCount) throw new Error('That subject has changed. Reload and try again.')
      if (action === 'delete-subject') {
        const tutors = await tutorHours(true, client, catalog)
        const sessions = await client.query('SELECT 1 FROM booking_sessions WHERE subject=$1 LIMIT 1', [original])
        if (sessions.rowCount || tutors.some(tutor => tutor.subjects.includes(original)))
          throw new Error('This subject is assigned to a tutor or session. Rename it or remove those assignments first.')
        await client.query('DELETE FROM tutoring_subjects WHERE name=$1', [original])
      } else if (original !== name) {
        await client.query('UPDATE tutoring_subjects SET name=$2 WHERE name=$1', [original, name])
        await client.query('UPDATE tutor_profiles SET subjects=array_replace(subjects,$1,$2) WHERE $1=ANY(subjects)', [original, name])
        await client.query('UPDATE booking_sessions SET subject=$2 WHERE subject=$1', [original, name])
      }
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    if ((error as pg.DatabaseError).code === '23505') throw new Error('A subject with that name already exists.')
    throw error
  } finally {
    client.release()
  }
}
