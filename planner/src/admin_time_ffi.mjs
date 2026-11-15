import { calendarAddDays, easternInstant, instantParts, localInstant, TUTOR_ZONE } from '#booking/session-time'
import { toList } from './gleam_lists.mjs'

const timeZoneLabels = [
	[TUTOR_ZONE, 'Eastern (New York)'],
	['America/Chicago', 'Central (Chicago)'],
	['America/Denver', 'Mountain (Denver)'],
	['America/Los_Angeles', 'Pacific (Los Angeles)'],
	['America/Phoenix', 'Arizona (Phoenix)'],
	['America/Anchorage', 'Alaska (Anchorage)'],
	['Pacific/Honolulu', 'Hawaii (Honolulu)'],
	['Europe/London', 'London'],
	['Europe/Amsterdam', 'Amsterdam'],
	['Asia/Kolkata', 'India (Kolkata)'],
	['Australia/Sydney', 'Sydney'],
	['UTC', 'UTC'],
]

export function adminTimeZones() {
	const local = Intl.DateTimeFormat().resolvedOptions().timeZone
	return toList(timeZoneLabels.some(([zone]) => zone === local)
		? timeZoneLabels
		: [...timeZoneLabels, [local, local.replaceAll('_', ' ') + ' (this device)']])
}

function clockValue(minutes) {
	return [Math.floor(minutes / 60), minutes % 60].map(part => String(part).padStart(2, '0')).join(':')
}

export function formFields(event) {
	const data = new FormData(event.target.form)
	if (event.target.name === 'time-zone' && data.get('date') && data.get('time')) {
		const [hour, minute] = String(data.get('time')).split(':').map(Number)
		const previous = event.target.dataset.previousZone
		const zone = event.target.value
		const instant = localInstant(String(data.get('date')), hour * 60 + minute, previous)
		if (instant.kind === 'resolved') {
			const local = instantParts(instant.instant, zone)
			data.set('date', local.date)
			data.set('time', clockValue(local.start))
		} else {
			// Require an explicit new choice if the previous wall time could not be resolved.
			data.set('time', '')
		}
	}
	return toList(Array.from(data.entries()).filter(([, value]) => typeof value === 'string'))
}

const reference = instantParts(Date.now(), TUTOR_ZONE)
const referenceMonday = calendarAddDays(reference.date, (7 - reference.weekday) % 7)

export function referenceWeek() {
	return referenceMonday
}

const weeklyLabels = new Map()
const weeklyFormatters = new Map()

export function weeklyTimeLabel(zone, day, minute) {
	const key = zone + ':' + day + ':' + minute
	if (weeklyLabels.has(key)) return weeklyLabels.get(key)
	const label = formatWeeklyTime(zone, day, minute)
	weeklyLabels.set(key, label)
	return label
}

function formatWeeklyTime(zone, day, minute) {
	const date = calendarAddDays(referenceMonday, day + Math.floor(minute / 1440))
	const instant = easternInstant(date, minute % 1440)
	if (instant.kind !== 'resolved') return clockValue(minute % 1440) + ' Eastern (clock change)'
	if (!weeklyFormatters.has(zone)) {
		weeklyFormatters.set(zone, new Intl.DateTimeFormat('en-US', {
			timeZone: zone, weekday: 'short', hour: 'numeric', minute: '2-digit',
		}))
	}
	return weeklyFormatters.get(zone).format(instant.instant)
}
