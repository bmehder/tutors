import assert from 'node:assert/strict';
import test from 'node:test';
import { toArray, toList } from '../../planner/build/dev/javascript/christian_tutors_planner/gleam_lists.mjs'
import {
  SubjectAllocation$SubjectAllocation, SubjectAllocation$SubjectAllocation$id,
  SubjectAllocation$SubjectAllocation$subject, SubjectAllocation$SubjectAllocation$hours,
  Student$Student, Student$Student$id, Student$Student$name,
  Student$Student$allocated_hours, Student$Student$subject_allocations,
} from '../../planner/build/dev/javascript/christian_tutors_planner/planner/model.mjs';
import { allocation_issue, set_subject_hours, student_limit, initialize_allocations, remove_subject_allocation } from '../../planner/build/dev/javascript/christian_tutors_planner/planner/allocation.mjs';
import { allocationProblem, balanceSubjectHours, initialAllocations, removeSubject } from '../../temp-reference/typescript/subject-allocation.ts';
import { studentLimit } from '../../temp-reference/typescript/family-planner-model.ts';

import { Option$isSome, Option$Some$0 } from '../../planner/build/dev/javascript/gleam_stdlib/gleam/option.mjs';

const gleamStudent = ({ id, name, hours, subjects }) => Student$Student(id, name, hours,
  toList(subjects.map(share => SubjectAllocation$SubjectAllocation(share.id, share.subject, share.hours))));
const plainStudent = student => ({
  id: Student$Student$id(student),
  name: Student$Student$name(student),
  hours: Student$Student$allocated_hours(student),
  subjects: toArray(Student$Student$subject_allocations(student)).map(allocation => ({
    id: SubjectAllocation$SubjectAllocation$id(allocation),
    subject: SubjectAllocation$SubjectAllocation$subject(allocation),
    hours: SubjectAllocation$SubjectAllocation$hours(allocation),
  })),
});
const shares = hours => hours.map((amount, index) => ({ id: `subject-${index}`, subject: `Subject ${index}`, hours: amount }));
const student = (hours, split) => ({ id: 'emma', name: 'Emma', hours, subjects: shares(split) });
const allocationShape = ({ name, hours, subjects }) => ({ name, hours, subjects: subjects.map(({ subject, hours }) => ({ subject, hours })) });

test('Gleam initializes the same hours and subject rows for every supported family size', () => {
  for (const capacity of [5, 10, 20]) {
    assert.equal(student_limit(capacity), studentLimit(capacity));
    for (let count = 1; count <= student_limit(capacity); count++) {
      let nextId = 0;
      const roster = toArray(initialize_allocations(capacity, count, () => String(nextId++))).map(plainStudent);
      assert.deepEqual(roster.map(allocationShape), initialAllocations(capacity, count).map(allocationShape));
      const ids = roster.flatMap(member => [member.id, ...member.subjects.map(share => share.id)]);
      assert.equal(new Set(ids).size, ids.length);
    }
  }
});

test('allocation validation preserves errors and their priority', () => {
  const emma = student(6, [3, 3]);
  const jack = { ...student(4, [4]), id: 'jack', name: 'Jack' };
  const cases = [
    [5, [emma, jack]],
    [10, [emma, jack]],
    [10, [emma]],
    [10, [student(11, [11])]],
    [10, [{ ...emma, name: '  ' }]],
    [10, [{ ...emma, name: '', subjects: emma.subjects.map(share => ({ ...share, subject: 'Biology' })) }]],
    [10, [student(6, [3])]],
    [10, [student(6, [])]],
    [10, [student(0, [0])]],
    [10, [{ ...emma, subjects: emma.subjects.map(share => ({ ...share, subject: '' })) }]],
  ];
  for (const [capacity, roster] of cases) {
    const issue = allocation_issue(toList(roster.map(gleamStudent)), capacity);
    assert.equal(Option$isSome(issue) ? Option$Some$0(issue) : '', allocationProblem(roster, capacity, studentLimit(capacity)));
  }
});

test('editing or removing subject hours gives the same allocation in both implementations', () => {
  for (const total of [1, 5, 6, 10, 20]) {
    for (let count = 1; count <= total; count++) {
      const emma = student(total, [total - count + 1, ...Array(count - 1).fill(1)]);
      const gleam = gleamStudent(emma);
      for (const share of emma.subjects) {
        for (let hours = 1; hours <= total; hours++) {
          assert.deepEqual(plainStudent(set_subject_hours(gleam, share.id, hours)), balanceSubjectHours(emma, share.id, hours));
        }
        assert.deepEqual(plainStudent(remove_subject_allocation(gleam, share.id)), removeSubject(emma, share.id));
      }
    }
  }
});
