import assert from 'node:assert/strict'
import test from 'node:test'
import { familyBookingIssue } from '../src/server/booking-validation.ts'

const students = count => Array.from({ length: count }, (_, index) => ({ studentId: `student-${index}`, studentName: `Student ${index}` }))

test('server enforces each package student limit independently of the browser', () => {
  for (const [hours, limit] of [[5, 1], [10, 3], [20, 5]]) {
    assert.equal(familyBookingIssue(hours, students(limit)), null)
    assert.match(familyBookingIssue(hours, students(limit + 1)), /supports/)
  }
})

test('repeated sessions and equal names do not confuse student identity', () => {
  const emma = { studentId: 'emma', studentName: 'Emma' }
  assert.equal(familyBookingIssue(5, [emma, emma, emma]), null)
  assert.equal(familyBookingIssue(10, [emma, { studentId: 'another-emma', studentName: 'Emma' }]), null)
  assert.match(familyBookingIssue(10, [emma, { ...emma, studentName: 'Jack' }]), /same student name/)
})

test('invalid names, empty plans and excess hours cannot create a public booking', () => {
  assert.match(familyBookingIssue(5, [{ studentId: 'emma', studentName: null }]), /name/)
  assert.match(familyBookingIssue(5, [{ studentId: ' ', studentName: 'Emma' }]), /name/)
  assert.match(familyBookingIssue(5, []), /sessions/)
  assert.match(familyBookingIssue(5, Array(6).fill(students(1)[0])), /package hours/)
  assert.match(familyBookingIssue(7, students(1)), /supported/)
  assert.equal(familyBookingIssue(5, students(1)), null, 'Unused package hours remain allowed')
})
