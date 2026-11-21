type StudentSession = { studentId: string; studentName: string | null }

// Enforce family rules again on the server; browser state is not authoritative.
export function familyBookingIssue(packageHours: number, sessions: readonly StudentSession[]): string | null {
  const limit = new Map([[5, 1], [10, 3], [20, 5]]).get(packageHours)
  if (!limit) return 'Choose a supported tutoring package.'
  if (!sessions.length || sessions.length > packageHours) return 'Choose sessions within your package hours.'
  const students = new Map<string, string>()
  for (const session of sessions) {
    const name = session.studentName?.trim()
    if (!session.studentId.trim() || !name) return 'Give each scheduled student a name.'
    const previous = students.get(session.studentId)
    if (previous && previous !== name) return 'Use the same student name throughout their sessions.'
    students.set(session.studentId, name)
  }
  return students.size > limit
    ? `The ${packageHours}-hour package supports ${limit === 1 ? '1 student' : `up to ${limit} students`}. Choose a larger package or review your students.`
    : null
}
