import test from 'node:test';
import assert from 'node:assert/strict';
import {subjectQueue,allocationProblem} from '../src/subject-allocation.ts';
import {conflictReason} from '../src/family-planner-model.ts';
const students=[{id:'emma',name:'Emma',hours:6,subjects:[{id:'emma-math',subject:'Algebra 1',hours:3},{id:'emma-english',subject:'Intermediate Composition',hours:3}]},{id:'jack',name:'Jack',hours:4,subjects:[{id:'jack-math',subject:'Algebra 1',hours:4}]}];
test('six/four allocation creates three subject routines for only two students',()=>{
 assert.equal(allocationProblem(students,10,3),'');
 const queue=subjectQueue(students);
 assert.equal(queue.length,3);assert.equal(new Set(queue.map(a=>a.childId)).size,2);
 assert.deepEqual(queue.map(a=>a.hours),[3,3,4]);
 assert.deepEqual(queue.slice(0,2).map(a=>a.childId),['emma','emma']);
});
test('subject totals must match their student share and respect the package',()=>{
 assert.match(allocationProblem([{...students[0],subjects:[students[0].subjects[0]]}],10,3),/add up/);
 assert.match(allocationProblem(students,5,3),/exceed/);
 assert.match(allocationProblem(students,10,1),/up to 1/);
 assert.equal(allocationProblem([students[0]],10,3),'');
});
test('different subjects for the same child cannot overlap',()=>{
 const base={id:'math',childId:'emma',tutorId:'sarah',subject:'Algebra 1',date:'2030-01-07',start:900,duration:60};
 assert.match(conflictReason({...base,id:'english',subject:'Intermediate Composition',tutorId:'rachel'},[base]),/child/);
 assert.equal(conflictReason({...base,id:'english',subject:'Intermediate Composition',tutorId:'rachel',start:960},[base]),'');
});
