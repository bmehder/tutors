// Browser, catalog, and calendar adapters for the Gleam planner.
import { toArray, toList } from './gleam_lists.mjs'
import { Option$None, Option$Some } from '../gleam_stdlib/gleam/option.mjs'
import {
	Availability$Available,
	Session$Session,
	TimeChoice$TimeChoice,
	Tutor$Tutor,
	TutorAvailability$TutorAvailability,
	Availability$Unavailable,
	Session$Session$date,
	Session$Session$start,
	Session$Session$duration,
	Student$Student$id,
	SubjectAllocation$SubjectAllocation$id,
	SubjectAllocation$SubjectAllocation$subject,
	SubjectAllocation$SubjectAllocation$hours,
	Tutor$Tutor$id,
	Tutor$Tutor$availability,
	TutorAvailability$TutorAvailability$start_minutes,
	WeeklyRoutine$WeeklyRoutine$sessions,
} from './planner/model.mjs'
import {
	SessionTime$AmbiguousTime,
	Calendar$Calendar,
	SessionTime$InvalidTime,
	SessionTime$NonexistentTime,
	SessionTime$Resolved,
	routine_series, series_issue,
} from './planner/scheduling.mjs'
import { SUBJECTS, tutors as sourceCatalog, money } from '@booking/tutoring-data.ts'
import {
	calendarAddDays,
	calendarDate,
	calendarWeekday,
	easternInstant,
	formatDate,
	formatTime,
	instantParts,
	parseTime,
	sessionInterval,
	viewSession,
} from '@booking/session-time.ts'
import { formatCard, formatExpiry, formatSecurityCode } from '@booking/payment-format.ts'

const catalog = toList(sourceCatalog.map(tutor => Tutor$Tutor(
	tutor.id,
	tutor.name,
	toList(tutor.subjects),
	TutorAvailability$TutorAvailability(toList(tutor.days), toList(tutor.times.map(parseTime))),
)))

const booked = schedules =>
	toArray(schedules).flatMap(schedule => toArray(WeeklyRoutine$WeeklyRoutine$sessions(schedule)))

function resolveSession(session) {
	const interval = sessionInterval({ date: Session$Session$date(session), start: Session$Session$start(session), duration: Session$Session$duration(session) })
	switch (interval.kind) {
		case 'resolved': return SessionTime$Resolved(interval.start, interval.end)
		case 'nonexistentTime': return SessionTime$NonexistentTime()
		case 'ambiguousTime': return SessionTime$AmbiguousTime()
		default: return SessionTime$InvalidTime()
	}
}

function endInstant(date, minute) {
	const endDate = calendarAddDays(date, Math.floor(minute / 1440))
	const end = easternInstant(endDate, minute % 1440)
	return end.kind === 'resolved' ? Option$Some(end.instant) : Option$None()
}

export function validDate(date) {
	try {
		calendarDate(date)
		return true
	} catch {
		return false
	}
}

const calendar = Calendar$Calendar(
	resolveSession,
	calendarWeekday,
	endInstant,
	session => `${formatDate(Session$Session$date(session))} at ${formatTime(Session$Session$start(session))}`,
)

// Keep browser time-zone detection, supported-zone search, and local calendar dates here.
const zoneAliases = {
	Boston: 'America/New_York',
	Miami: 'America/New_York',
	Seattle: 'America/Los_Angeles',
	Delhi: 'Asia/Calcutta',
	Mumbai: 'Asia/Calcutta',
	Beijing: 'Asia/Shanghai',
}

export function zone() {
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
	return timeZone ? Option$Some(timeZone) : Option$None()
}
export function zones(query, current) {
	const search = query.trim().toLowerCase()
	const matches = [
		...new Set([current, 'UTC', ...Intl.supportedValuesOf('timeZone')]),
	].filter(
		name =>
			name.replaceAll('_', ' ').toLowerCase().includes(search) ||
			Object.entries(zoneAliases).some(
				([city, target]) => target === name && city.toLowerCase().includes(search),
			),
	)
	return toList(matches.slice(0, search ? 100 : 12))
}
export const tomorrow = zone =>
	calendarAddDays(instantParts(Date.now(), zone).date, 1)
// Keep browser-generated IDs and catalog conversion here.
export const id = () => crypto.randomUUID()
export const subjects = () => toList(SUBJECTS)
export const tutors = () => catalog

// Match candidate Eastern instants to the family's local date and format the labels.
// Gleam builds and checks each weekly series.
export function choices(tutor, student, allocation, date, zone, schedules) {
	const existing = toList(booked(schedules))
	const now = Date.now()
	const options = []
	for (const delta of [-1, 0, 1]) {
		const easternDate = calendarAddDays(date, delta)
		for (const start of toArray(TutorAvailability$TutorAvailability$start_minutes(Tutor$Tutor$availability(tutor)))) {
			const resolved = easternInstant(easternDate, start)
			if (
				resolved.kind !== 'resolved' ||
				instantParts(resolved.instant, zone).date !== date
			)
				continue
			const first = Session$Session(SubjectAllocation$SubjectAllocation$id(allocation), Student$Student$id(student), Tutor$Tutor$id(tutor), SubjectAllocation$SubjectAllocation$subject(allocation), easternDate, start, 60)
			const sessions = routine_series(first, SubjectAllocation$SubjectAllocation$hours(allocation), calendarAddDays)
			const issue = series_issue(sessions, tutor, existing, now, calendar)
			const availability = issue ? Availability$Unavailable(issue) : Availability$Available()
			options.push({
				instant: resolved.instant,
				choice: TimeChoice$TimeChoice(
					viewSession(resolved.instant, zone),
					availability,
					sessions,
				),
			})
		}
	}
	return toList(
		options.sort((a, b) => a.instant - b.instant).map(option => option.choice),
	)
}

// Keep session display and local date conversion here.
export function sessionLabel(session, zone) {
	const resolved = easternInstant(Session$Session$date(session), Session$Session$start(session))
	return resolved.kind === 'resolved'
		? viewSession(resolved.instant, zone)
		: 'Choose a different time'
}
export function sessionDate(session, zone) {
	const resolved = easternInstant(Session$Session$date(session), Session$Session$start(session))
	return resolved.kind === 'resolved'
		? instantParts(resolved.instant, zone).date
		: tomorrow(zone)
}
// Calendar, clock, and formatting inputs for the Gleam rules.
export const bookingCalendar = () => calendar
export const now = () => Date.now()
export const addDays = calendarAddDays
export const formatMoney = money
export const instantLabel = viewSession

export function billingMonth() {
	const now = new Date()
	return [now.getFullYear(), now.getMonth() + 1]
}

// Keep browser effects here, including the demo timer, scrolling, printing,
// Astro tutor-card events, and payment input masks.
export function afterPayment(dispatch, message) {
	setTimeout(() => dispatch(message), 800)
}
export function scroll() {
	requestAnimationFrame(() =>
		document
			.getElementById('family-planner')
			?.scrollIntoView({ behavior: 'smooth' }),
	)
}
export function print() {
	window.print()
}
export function listenForTutorCardClicks(dispatch, message) {
	document.querySelectorAll('[data-preferred-tutor]').forEach(link => {
		link.addEventListener('click', () =>
			dispatch(message(link.dataset.preferredTutor)),
		)
	})
}

export function installPaymentMasks() {
	document.getElementById('family-planner').addEventListener('input', event => {
		const input = event.target
		if (!(input instanceof HTMLInputElement) || !input.closest('[data-payment]'))
			return
		const format = {
			card: formatCard,
			expiry: formatExpiry,
			cvc: formatSecurityCode,
		}[input.name]
		if (format) input.value = format(input.value)
	})
}

// Keep calendar arithmetic and date formatting here.
export const weekDates = first =>
	toList(
		Array.from({ length: 7 }, (_, index) => {
			const date = calendarAddDays(first, index)
			return [date, formatDate(date)]
		}),
	)
