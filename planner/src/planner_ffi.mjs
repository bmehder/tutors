// Browser, catalog, and calendar adapters for the Gleam planner.
import { toArray, toList } from './gleam_lists.mjs'
import { Option$None, Option$Some, Option$isSome } from '../gleam_stdlib/gleam/option.mjs'
import {
	TutorAvailability$DailyAvailability,
	TutorAvailability$DailyAvailability$start_minutes,
	TutorAvailability$isDailyAvailability,
	Order$Order$sessions,
	Order$Order$contact,
	ContactInfo$ContactInfo$name,
	Order$Order$package_hours,
	Order$Order$discount,
	ConfirmedSession$ConfirmedSession$session,
	Session$Session$tutor_id,
	Session$Session$student_id,
	Session$Session$subject,
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
	routine_series,
	series_issue,
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
import {
	formatCard,
	formatExpiry,
	formatSecurityCode,
} from '@booking/payment-format.ts'
import { formatCheckoutPhone } from '@booking/phone.ts'

let catalog = toList(
	sourceCatalog.map(tutor =>
		Tutor$Tutor(
			tutor.id,
			tutor.name,
			toList(tutor.subjects),
			TutorAvailability$TutorAvailability(
				toList(tutor.days),
				toList(tutor.times.map(parseTime)),
			),
		),
	),
)

let subjectsCatalog = SUBJECTS
let reservations = null
let availabilitySignature

let loadingAvailability
export function loadTutorHours() {
	loadingAvailability ??= fetchTutorHours().finally(() => { loadingAvailability = undefined })
	return loadingAvailability
}

async function fetchTutorHours() {
	const response = await fetch('/api/tutor-hours?includeReservations=1', {
		signal: AbortSignal.timeout(8000),
	})
	if (!response.ok) throw new Error('Tutor schedules could not be loaded.')
	const { tutors, reservations: slots, subjects = SUBJECTS } = await response.json()
	const signature = JSON.stringify([tutors, slots, subjects])
	if (signature === availabilitySignature) return false
	const byTutor = slots === null ? null : Map.groupBy(slots, slot => slot.tutorId)

	catalog = toList(tutors.map(tutor => Tutor$Tutor(
		tutor.id,
		tutor.name,
		toList(tutor.subjects),
		TutorAvailability$DailyAvailability(
			toList(tutor.startsByDay.map(toList)),
			toList([...new Set(tutor.startsByDay.flat())].sort((a, b) => a - b)),
		),
	)))
	reservations = byTutor
	subjectsCatalog = subjects
	availabilitySignature = signature
	return true
}

export function watchTutorHours(notify) {
	let refreshing = false
	async function refresh() {
		if (refreshing || document.hidden) return
		refreshing = true
		try {
			if (await loadTutorHours()) notify()
		} catch {
			// Keep the last snapshot when offline. Checkout still checks the database.
		} finally {
			refreshing = false
		}
	}
	document.addEventListener('visibilitychange', refresh)
	window.setInterval(refresh, 15000)
}

const booked = schedules =>
	toArray(schedules).flatMap(schedule =>
		toArray(WeeklyRoutine$WeeklyRoutine$sessions(schedule)),
	)

function resolveSession(session) {
	const interval = sessionInterval({
		date: Session$Session$date(session),
		start: Session$Session$start(session),
		duration: Session$Session$duration(session),
	})
	switch (interval.kind) {
		case 'resolved':
			return SessionTime$Resolved(interval.start, interval.end)
		case 'nonexistentTime':
			return SessionTime$NonexistentTime()
		case 'ambiguousTime':
			return SessionTime$AmbiguousTime()
		default:
			return SessionTime$InvalidTime()
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
	session =>
		`${formatDate(Session$Session$date(session))} at ${formatTime(Session$Session$start(session))}`,
	(tutorId, start, end, now) => reservations === null
		? Option$None()
		: Option$Some((reservations.get(tutorId) ?? []).some(slot =>
			(slot.holdUntil === null || slot.holdUntil > now) && start < slot.end && slot.start < end,
		)),
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
export const randomUuid = () => crypto.randomUUID()
export const subjects = () => toList(subjectsCatalog)
export const allTutors = () => catalog

// Match candidate Eastern instants to the family's local date and format the labels.
// Gleam builds and checks each weekly series.
export function choices(tutor, student, allocation, date, zone, schedules) {
	const existing = toList(booked(schedules))
	const now = Date.now()
	const availability = Tutor$Tutor$availability(tutor)
	const starts = TutorAvailability$isDailyAvailability(availability)
		? TutorAvailability$DailyAvailability$start_minutes(availability)
		: TutorAvailability$TutorAvailability$start_minutes(availability)
	const options = []
	for (const delta of [-1, 0, 1]) {
		const easternDate = calendarAddDays(date, delta)
		for (const start of toArray(starts)) {
			const resolved = easternInstant(easternDate, start)
			if (
				resolved.kind !== 'resolved' ||
				instantParts(resolved.instant, zone).date !== date
			)
				continue
			const first = Session$Session(
				SubjectAllocation$SubjectAllocation$id(allocation),
				Student$Student$id(student),
				Tutor$Tutor$id(tutor),
				SubjectAllocation$SubjectAllocation$subject(allocation),
				easternDate,
				start,
				60,
			)
			const sessions = routine_series(
				first,
				SubjectAllocation$SubjectAllocation$hours(allocation),
				calendarAddDays,
			)
			const issue = series_issue(sessions, tutor, existing, now, calendar)
			const availability = issue
				? Availability$Unavailable(issue)
				: Availability$Available()
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
	const resolved = easternInstant(
		Session$Session$date(session),
		Session$Session$start(session),
	)
	return resolved.kind === 'resolved'
		? viewSession(resolved.instant, zone)
		: 'Choose a different time'
}

export function sessionDate(session, zone) {
	const resolved = easternInstant(
		Session$Session$date(session),
		Session$Session$start(session),
	)
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

// Keep browser effects here, including mock checkout, scrolling, printing,
// Astro tutor-card events, and payment input masks.
export function afterPayment(order, dispatch, success, failed) {
	const sessions = toArray(Order$Order$sessions(order)).map(confirmed => {
		const session = ConfirmedSession$ConfirmedSession$session(confirmed)
		return {
			tutorId: Session$Session$tutor_id(session),
			studentId: Session$Session$student_id(session),
			subject: Session$Session$subject(session),
			date: Session$Session$date(session),
			start: Session$Session$start(session),
		}
	})
	async function reserve(body) {
		const response = await fetch('/api/reservations', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		})
		const result = await response.json()
		if (!response.ok) throw new Error(result.error)
		return result.id
	}
	reserve({ sessions, familyName: ContactInfo$ContactInfo$name(Order$Order$contact(order)), packageHours: Order$Order$package_hours(order), demoDiscount: Option$isSome(Order$Order$discount(order)) })
		.then(id => reserve({ id }))
		.then(() => dispatch(success))
		.catch(async error => {
			await loadTutorHours().catch(() => {})
			dispatch(failed(error.message || 'Could not reserve your sessions.'))
		})
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

export function installInputMasks() {
	document.getElementById('family-planner').addEventListener('input', event => {
		const input = event.target
		if (!(input instanceof HTMLInputElement)) return
		if (input.name === 'phone' && input.type === 'tel') {
			const formatted = formatCheckoutPhone(input.value)
			if (formatted !== input.value) input.value = formatted
			return
		}
		if (!input.closest('[data-payment]')) return
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
