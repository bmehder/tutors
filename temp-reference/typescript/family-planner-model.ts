import {
	formatDate,
	formatTime,
	parseTime,
	calendarAddDays,
	calendarWeekday,
	instantParts,
	sessionInterval,
	easternInstant,
	bookingClock,
	normalizeClock,
	noticeSatisfied,
	intervalsOverlap,
	type BookingClock,
} from '../../src/session-time.ts'
export { formatDate, formatTime, parseTime } from '../../src/session-time.ts'
export { SUBJECTS } from '../../src/tutoring-data.ts'
export type Child = { id: string; name: string; color: number }
export type Lesson = {
	id: string
	childId: string
	tutorId: string
	subject: string
	date: string
	start: number
	duration: number
}
export type Tutor = {
	id: string
	name: string
	subjects: string[]
	days: number[]
	times: string[]
}
export const HOUR = 60
export function todayEastern(now = new Date()): string {
	return instantParts(now.getTime(), 'America/New_York').date
}
export const addDays = calendarAddDays
export function nextSchoolDay(today = todayEastern()): string {
	let date = addDays(today, 1)
	while ([5, 6].includes(calendarWeekday(date))) date = addDays(date, 1)
	return date
}
export function overlaps(
	a: Pick<Lesson, 'date' | 'start' | 'duration'>,
	b: Pick<Lesson, 'date' | 'start' | 'duration'>,
): boolean {
	const first = sessionInterval(a),
		second = sessionInterval(b)
	return (
		first.kind === 'resolved' &&
		second.kind === 'resolved' &&
		intervalsOverlap(first, second)
	)
}
export function conflictReason(
	candidate: Lesson,
	existing: Lesson[],
	ignoreId?: string,
): string {
	const overlapping = existing.filter(
		l => l.id !== ignoreId && overlaps(candidate, l),
	)
	if (overlapping.some(l => l.childId === candidate.childId))
		return 'This child already has a session at this time.'
	if (overlapping.some(l => l.tutorId === candidate.tutorId))
		return 'This tutor is already booked at this time.'
	return ''
}
export function supports(tutor: Tutor, subject: string): boolean {
	return tutor.subjects.includes(subject)
}
export function isSoldOut(tutorId: string, date: string, start: number): boolean {
	const hash = [...`${tutorId}:${date}:${start}`].reduce(
		(value, char) => (value * 31 + char.charCodeAt(0)) >>> 0,
		0,
	)
	return hash % 7 === 0
}
export function availabilityReason(
	candidate: Lesson,
	tutor: Tutor | undefined,
	child: Child | undefined,
	existing: Lesson[],
	ignoreId?: string,
	clock: BookingClock | string = bookingClock(),
): string {
	if (!child) return 'Choose a child first.'
	if (!tutor) return 'Choose a tutor and time.'
	const interval = sessionInterval(candidate)
	if (interval.kind === 'nonexistentTime')
		return 'This local time does not exist because the clocks change. Choose another time.'
	if (interval.kind === 'ambiguousTime')
		return 'This local time occurs twice because the clocks change. Choose another time.'
	if (interval.kind !== 'resolved')
		return 'Choose a valid date and quarter-hour time.'
	if (!noticeSatisfied(interval.start, normalizeClock(clock)))
		return 'Choose a future date and time outside the 24-hour booking notice.'
	if (!supports(tutor, candidate.subject))
		return 'This tutor does not teach this subject for this subject.'
	const weekday = calendarWeekday(candidate.date)
	const hoursIssue = tutorHoursIssue(tutor, candidate.date, weekday, candidate.start, interval.end)
	if (hoursIssue) return hoursIssue
	const conflict = conflictReason(candidate, existing, ignoreId)
	if (conflict) return conflict
	if (isSoldOut(tutor.id, candidate.date, candidate.start))
		return 'This time is sold out.'
	return ''
}
export function tutorHoursIssue(
	tutor: Tutor,
	date: string,
	weekday: number,
	start: number,
	sessionEnd: number,
): string {
	const starts = tutor.times.map(parseTime)
	if (!tutor.days.includes(weekday) || !starts.includes(start))
		return 'This tutor is not available at this time.'
	const lastEnd = Math.max(...starts) + HOUR
	const endDate = addDays(date, Math.floor(lastEnd / 1440))
	const availableEnd = easternInstant(endDate, lastEnd % 1440)
	if (availableEnd.kind !== 'resolved' || sessionEnd > availableEnd.instant)
		return 'The full session does not fit this tutor’s availability.'
	return ''
}
export function plannedHours(sessions: Lesson[]): number {
	return sessions.reduce((hours, l) => hours + l.duration / HOUR, 0)
}
export function validatePlan(
	plan: Lesson[],
	booked: Lesson[],
	children: Child[],
	tutors: Tutor[],
	capacity: number,
	clock: BookingClock | string = bookingClock(),
): string {
	if (!plan.length) return 'Add at least one session to your family plan.'
	if (plannedHours(plan) > capacity)
		return 'Your plan has more sessions than your package can cover.'
	for (let i = 0; i < plan.length; i++) {
		const session = plan[i]
		if (
			![30, 45, 60, 90].includes(session.duration) ||
			!session.id ||
			!session.childId
		)
			return 'Check the session details.'
		const reason = availabilityReason(
			session,
			tutors.find(t => t.id === session.tutorId),
			children.find(c => c.id === session.childId),
			[...booked, ...plan.slice(0, i)],
			undefined,
			clock,
		)
		if (reason)
			return `${formatDate(session.date)} at ${formatTime(session.start)}: ${reason}`
	}
	return ''
}
export function packagePrice(hours: number, rate: number, welcome = false) {
	const subtotal = hours * rate
	const savings = welcome ? Math.round(subtotal * 0.2 * 100) / 100 : 0
	return { subtotal, savings, total: subtotal - savings }
}
export function describeConflict(
	candidate: Lesson,
	existing: Lesson[],
	children: Child[],
	tutors: Tutor[],
	ignoreId?: string,
): string {
	const matches = existing.filter(l => l.id !== ignoreId && overlaps(candidate, l))
	const childMatch = matches.find(l => l.childId === candidate.childId)
	const tutorMatch = matches.find(l => l.tutorId === candidate.tutorId)
	const match = childMatch || tutorMatch
	if (!match) return ''
	const child = children.find(c => c.id === match.childId)?.name || 'Another child'
	const tutor = tutors.find(t => t.id === match.tutorId)?.name || 'This tutor'
	const when = `${formatTime(match.start)}–${formatTime(match.start + match.duration)} ET on ${formatDate(match.date)}`
	return childMatch
		? `${child} already has ${match.subject} with ${tutor}, ${when}. Choose a different time.`
		: `${tutor} is teaching ${child} ${match.subject}, ${when}. Choose another tutor or time.`
}

export function studentLimit(hours: number): number {
	return hours === 5 ? 1 : hours === 10 ? 3 : hours === 20 ? 5 : 0
}
export function weeklySeries(first: Lesson, count: number): Lesson[] {
	return Array.from({ length: count }, (_, i) => ({
		...first,
		id: `${first.id}-${i}`,
		date: addDays(first.date, i * 7),
	}))
}
