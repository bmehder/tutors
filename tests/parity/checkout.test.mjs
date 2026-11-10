import assert from 'node:assert/strict'
import test from 'node:test'
import { toArray, toList } from '../../planner/build/dev/javascript/christian_tutors_planner/gleam_lists.mjs'
import { Result$isOk, Result$Ok$0, Result$Error$0 } from '../../planner/build/dev/javascript/prelude.mjs'
import { Option$None, Option$Some } from '../../planner/build/dev/javascript/gleam_stdlib/gleam/option.mjs'
import {
  Order$Order, Discount$Discount,
  ConfirmedSession$ConfirmedSession$session, ConfirmedSession$ConfirmedSession$start_instant,
  ConfirmedSession$ConfirmedSession$end_instant, Order$Order$contact, Order$Order$sessions,
  Session$Session$date, Session$Session$start, Session$Session$duration,
  ContactInfo$ContactInfo$name, ContactInfo$ContactInfo$email, ContactInfo$ContactInfo$phone,
  ContactInfo$ContactInfo,
  DemoPaymentDetails$DemoPaymentDetails,
  Session$Session,
  Student$Student,
  SubjectAllocation$SubjectAllocation,
  Tutor$Tutor,
  TutorAvailability$TutorAvailability,
  WeeklyRoutine$WeeklyRoutine,
} from '../../planner/build/dev/javascript/christian_tutors_planner/planner/model.mjs'
import {
  SessionTime$AmbiguousTime,
  Calendar$Calendar,
  SessionTime$InvalidTime,
  SessionTime$NonexistentTime,
  SessionTime$Resolved,
} from '../../planner/build/dev/javascript/christian_tutors_planner/planner/scheduling.mjs'
import {
  confirm, demo_discount, discount_amount, hourly_rate, order_total, package_total, payment_issue, revalidate,
} from '../../planner/build/dev/javascript/christian_tutors_planner/planner/checkout.mjs'
import { confirmOrder, revalidateOrder } from '../../temp-reference/typescript/booking-domain.ts'
import { formatDate, formatTime, isSoldOut } from '../../temp-reference/typescript/family-planner-model.ts'
import { calendarAddDays, calendarWeekday, easternInstant, sessionInterval } from '../../src/session-time.ts'

const calendar = Calendar$Calendar(
  session => {
    const interval = sessionInterval({ date: Session$Session$date(session), start: Session$Session$start(session), duration: Session$Session$duration(session) })
    if (interval.kind === 'resolved') return SessionTime$Resolved(interval.start, interval.end)
    if (interval.kind === 'ambiguousTime') return SessionTime$AmbiguousTime()
    if (interval.kind === 'nonexistentTime') return SessionTime$NonexistentTime()
    return SessionTime$InvalidTime()
  },
  calendarWeekday,
  (date, minute) => {
    const end = easternInstant(calendarAddDays(date, Math.floor(minute / 1440)), minute % 1440)
    return end.kind === 'resolved' ? Option$Some(end.instant) : Option$None()
  },
  session => `${formatDate(Session$Session$date(session))} at ${formatTime(Session$Session$start(session))}`,
)

test('Gleam checkout matches TypeScript for skipped weeks, validation, and expiry', () => {
  let first = '2030-01-07'
  while ([7, 14, 21].some(days => isSoldOut('tutor', calendarAddDays(first, days), 900))) {
    first = calendarAddDays(first, 7)
  }
  const now = easternInstant(calendarAddDays(first, -7), 900).instant
  const clock = { now, noticeMs: 86_400_000 }
  const subject = { id: 'bio', subject: 'Biology', hours: 3 }
  const parent = { name: ' Sample Parent ', email: ' parent@example.com ', phone: ' +44 20 7946 0958 ' }
  const sourceStudent = { id: 'emma', name: 'Emma', hours: 3, subjects: [subject] }
  const sourceTutor = { id: 'tutor', name: 'Tutor', days: [0], times: ['3:00 PM'], subjects: ['Biology'] }
  const allocation = SubjectAllocation$SubjectAllocation(subject.id, subject.subject, subject.hours)
  const student = Student$Student('emma', 'Emma', 3, toList([allocation]))
  const tutor = Tutor$Tutor('tutor', 'Tutor', toList(['Biology']), TutorAvailability$TutorAvailability(toList([0]), toList([900])))
  const session = date => Session$Session('bio', 'emma', 'tutor', 'Biology', date, 900, 60)
  const routines = toList([WeeklyRoutine$WeeklyRoutine(student, allocation, tutor,
    toList([7, 14, 21].map(days => session(calendarAddDays(first, days)))), session(first))])
  const draft = { kind: 'draft', package: { kind: 'fiveHours' }, students: [sourceStudent],
    routines: [{ id: 'bio', studentId: 'emma', subject: 'Biology', tutorId: 'tutor', firstDate: first, start: 900, count: 3, skippedDates: [first] }] }
  const run = contact => confirm(5, toList([student]), routines, ContactInfo$ContactInfo(contact.name, contact.email, contact.phone),
    toList([tutor]), now, calendar, calendarAddDays, () => true)

  const actual = run(parent)
  const expected = confirmOrder(draft, parent, [sourceTutor], clock)
  assert.ok(Result$isOk(actual))
  assert.equal(expected.kind, 'ok')
  const order = Result$Ok$0(actual)
  const contact = Order$Order$contact(order)
  const sessions = toArray(Order$Order$sessions(order))
  assert.deepEqual({ name: ContactInfo$ContactInfo$name(contact), email: ContactInfo$ContactInfo$email(contact) }, expected.value.contact)
  assert.equal(ContactInfo$ContactInfo$phone(contact), '+44 20 7946 0958')
  assert.equal(Result$Error$0(run({ ...parent, phone: ' ' })), 'Enter a contact phone number.')
  assert.deepEqual(sessions.map(entry => [Session$Session$date(ConfirmedSession$ConfirmedSession$session(entry)), ConfirmedSession$ConfirmedSession$start_instant(entry), ConfirmedSession$ConfirmedSession$end_instant(entry)]),
    expected.value.sessions.map(entry => [entry.date, entry.startInstant, entry.endInstant]))

  for (const invalid of [{ ...parent, name: ' ' }, { ...parent, email: 'a@b.' }]) {
    assert.equal(Result$Error$0(run(invalid)), confirmOrder(draft, invalid, [sourceTutor], clock).message)
  }
  const expired = ConfirmedSession$ConfirmedSession$start_instant(sessions[0])
  assert.equal(revalidate(order, toList([tutor]), now, calendar), '')
  assert.equal(revalidate(order, toList([tutor]), expired, calendar),
    revalidateOrder(expected.value, [sourceTutor], { ...clock, now: expired }))
})

test('Gleam owns demo payment validation and package prices', () => {
  const details = (card = '4242 4242 4242 4242', expiry = '11 / 30', cvc = '003') =>
    DemoPaymentDetails$DemoPaymentDetails(card, expiry, cvc, 'Sample Parent', '01234')
  assert.equal(payment_issue(details(), 2030, 11), '')
  assert.match(payment_issue(details('1234'), 2030, 11), /sample|demo/)
  assert.match(payment_issue(details(undefined, '10 / 30'), 2030, 11), /expiry/)
  assert.match(payment_issue(details(undefined, '1 / 30'), 2030, 11), /expiry/)
  assert.match(payment_issue(details(undefined, undefined, '12'), 2030, 11), /security code/)
  for (const [hours, rate, total] of [[5, 80, 400], [10, 75, 750], [20, 70, 1400]]) {
    assert.equal(hourly_rate(hours), rate)
    assert.equal(package_total(hours), total)
  }
})


test('demo discount reduces the order total and can be removed', () => {
  const order = discount => Order$Order(10, ContactInfo$ContactInfo('Parent', 'parent@example.com', '+44 20 7946 0958'), toList([]), toList([]), toList([]), discount)
  assert.equal(order_total(order(Option$None())), 750)
  assert.equal(order_total(order(Option$Some(demo_discount(10)))), 600)
  assert.equal(discount_amount(10, Option$Some(Discount$Discount(-10))), 0)
  assert.equal(order_total(order(Option$Some(Discount$Discount(800)))), 0)
})
