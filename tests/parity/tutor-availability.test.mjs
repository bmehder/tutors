import assert from 'node:assert/strict'
import test from 'node:test'
import { toList } from '../../planner/build/dev/javascript/christian_tutors_planner/gleam_lists.mjs'
import { Option$None, Option$Some } from '../../planner/build/dev/javascript/gleam_stdlib/gleam/option.mjs'
import { TutorAvailability$TutorAvailability } from '../../planner/build/dev/javascript/christian_tutors_planner/planner/model.mjs'
import { BookingInterval$BookingInterval, booking_notice_satisfied, conflict_issue, tutor_hours_issue } from '../../planner/build/dev/javascript/christian_tutors_planner/planner/scheduling.mjs'
import { conflictReason, parseTime, tutorHoursIssue } from '../../temp-reference/typescript/family-planner-model.ts'
import { calendarAddDays, calendarWeekday, easternInstant, noticeSatisfied, sessionInterval } from '../../src/session-time.ts'

test('Gleam tutor hours agree with TypeScript for closed days, exact starts, and elapsed ends', () => {
  const scenarios = [
    ['2026-11-10', [1], ['4:00 PM', '3:00 PM'], 900, 90],
    ['2026-11-10', [1], ['3:00 PM'], 900, 60],
    ['2026-11-10', [1], ['3:00 PM'], 900, 90],
    ['2026-11-10', [1], ['3:00 PM'], 915, 60],
    ['2026-11-10', [0], ['3:00 PM'], 900, 60],
    ['2026-11-10', [1], [], 900, 60],
    ['2026-11-10', [1], ['11:30 PM'], 1410, 60],
    ['2026-03-08', [6], ['1:00 AM'], 60, 60],
    ['2026-11-01', [6], ['12:00 AM'], 0, 60],
    ['2026-11-01', [6], ['12:00 AM', '2:00 AM'], 0, 90],
  ]

  for (const [date, days, times, start, duration] of scenarios) {
    const weekday = calendarWeekday(date)
    const tutor = { id: 'demo', name: 'Demo tutor', subjects: [], days, times }
    const first = easternInstant(date, start)
    assert.equal(first.kind, 'resolved')
    const sessionEnd = first.instant + duration * 60_000
    const availability = TutorAvailability$TutorAvailability(toList(days), toList(times.map(parseTime)))
    const issue = tutor_hours_issue(availability, weekday, start, sessionEnd, minute => {
      const end = easternInstant(calendarAddDays(date, Math.floor(minute / 1440)), minute % 1440)
      return end.kind === 'resolved' ? Option$Some(end.instant) : Option$None()
    })
    assert.equal(issue, tutorHoursIssue(tutor, date, weekday, start, sessionEnd), JSON.stringify([date, days, times, start, duration]))
  }
})

test('Gleam booking notice matches TypeScript at the deadline', () => {
  const clock = { now: 1_800_000_000_000, noticeMs: 86_400_000 }
  const deadline = clock.now + clock.noticeMs
  for (const start of [deadline - 1, deadline, deadline + 1]) {
    assert.equal(booking_notice_satisfied(start, clock.now, clock.noticeMs), noticeSatisfied(start, clock))
  }
  assert.equal(booking_notice_satisfied(deadline, clock.now, -1), false)
})

test('Gleam conflicts match TypeScript across midnight and honor ignored sessions', () => {
  const requested = {
    id: 'requested', childId: 'emma', tutorId: 'tutor', date: '2026-11-10', start: 1410, duration: 60,
  }
  const studentConflict = { ...requested, id: 'student', tutorId: 'other', date: '2026-11-11', start: 0 }
  const tutorConflict = { ...requested, id: 'tutor', childId: 'jack' }
  const adjacent = { ...requested, id: 'adjacent', date: '2026-11-11', start: 30 }
  const unrelated = { ...requested, id: 'unrelated', childId: 'jack', tutorId: 'other' }
  const interval = session => {
    const resolved = sessionInterval(session)
    assert.equal(resolved.kind, 'resolved')
    return BookingInterval$BookingInterval(session.id, session.childId, session.tutorId, resolved.start, resolved.end)
  }
  for (const [existing, ignoreId] of [
    [[adjacent, unrelated], undefined],
    [[tutorConflict], undefined],
    [[tutorConflict, studentConflict], undefined],
    [[tutorConflict, studentConflict], 'student'],
  ]) {
    const ignored = ignoreId === undefined ? Option$None() : Option$Some(ignoreId)
    assert.equal(
      conflict_issue(interval(requested), toList(existing.map(interval)), ignored),
      conflictReason(requested, existing, ignoreId),
    )
  }
})
