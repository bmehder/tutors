import assert from 'node:assert/strict'
import test from 'node:test'
import { toArray, toList } from '../../planner/build/dev/javascript/christian_tutors_planner/gleam_lists.mjs'
import { Result$isOk, Result$Ok$0, Result$Error$0 } from '../../planner/build/dev/javascript/prelude.mjs'
import {
  replace_week, skipped_dates, weekly_dates, weekly_series,
} from '../../planner/build/dev/javascript/christian_tutors_planner/planner/scheduling.mjs'
import { availabilityReason, weeklySeries } from '../../temp-reference/typescript/family-planner-model.ts'
import { calendarAddDays, calendarWeekday } from '../../src/session-time.ts'
import { skipWeek, skippedWeeks, weeklyDates } from '../../temp-reference/typescript/skip-week.ts'

const first = { id: 'bio', childId: 'emma', tutorId: 'sarah', subject: 'Biology', date: '2030-01-07', start: 900, duration: 60 }
const child = { id: 'emma', name: 'Emma', color: 0 }
const tutor = { id: 'sarah', name: 'Sarah', subjects: ['Biology'], days: [calendarWeekday(first.date)], times: ['3:00 PM'] }
const dateInWeek = week => calendarAddDays(first.date, 7 * week)

test('Gleam reconstructs the same weekly dates and rejects invalid skips', () => {
  const original = toArray(weekly_series(4, week => ({ ...first, id: `bio-${week}`, date: dateInWeek(week) })))
  assert.deepEqual(original, weeklySeries(first, 4))
  for (const skipped of [[], [dateInWeek(0)], [dateInWeek(0), dateInWeek(2)]]) {
    const dates = weekly_dates(4, toList(skipped), dateInWeek)
    assert.ok(Result$isOk(dates))
    assert.deepEqual(toArray(Result$Ok$0(dates)), weeklyDates(first.date, 4, skipped))
    assert.deepEqual(toArray(skipped_dates(first.date, Result$Ok$0(dates), date => calendarAddDays(date, 7))), skipped)
  }
  for (const skipped of [[dateInWeek(0), dateInWeek(0)], [dateInWeek(5)], ['2030-01-08']]) {
    assert.throws(() => weeklyDates(first.date, 4, skipped))
    assert.ok(!(Result$isOk(weekly_dates(4, toList(skipped), dateInWeek))))
  }
})

test('Gleam skips weeks in the same order, including a blocked replacement and repeated skips', () => {
  let sessions = weeklySeries(first, 4)
  const blocked = [{ ...first, id: 'blocked', date: dateInWeek(4) }]
  for (const id of [sessions[0].id, sessions[2].id, 'missing']) {
    const actual = replace_week(
      toList(sessions), id, session => session.id, session => session.date,
      (session, date, week) => ({ ...session, date: calendarAddDays(date, week * 7) }),
      (candidate, kept) => !availabilityReason(candidate, tutor, child, [...blocked, ...toArray(kept)]),
    )
    const expected = skipWeek(sessions, id, tutor, child, blocked)
    if (expected.kind === 'updated') {
      assert.ok(Result$isOk(actual))
      assert.deepEqual(toArray(Result$Ok$0(actual)), expected.sessions)
      const dates = toList(expected.sessions.map(session => session.date))
      assert.deepEqual(toArray(skipped_dates(first.date, dates, date => calendarAddDays(date, 7))), skippedWeeks(first.date, expected.sessions))
      sessions = expected.sessions
    } else {
      assert.ok(!(Result$isOk(actual)))
      assert.equal(Result$Error$0(actual), expected.message)
    }
  }
})
