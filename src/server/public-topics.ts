import { tutoringTopics } from '../lib/tutoring-topics'
import { subjectCatalog } from './subjects'
import { pool, tutorHours } from './tutor-hours'

export async function publicTutoringTopics() {
  const catalog = await subjectCatalog(pool)
  const tutors = await tutorHours(false, pool, catalog)
  return tutoringTopics.map(topic => {
    // catalog_name preserves the mapping when Anna renames a subject.
    const subjects = catalog.filter(subject =>
      topic.catalogNames.some(name => name === subject.catalog_name),
    ).map(subject => subject.name)
    return { ...topic, subjects, tutors: tutors.filter(tutor => tutor.subjects.some(subject => subjects.includes(subject))) }
  })
}
