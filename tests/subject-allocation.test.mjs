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

test('changing either subject balances the other within the student share',async()=>{
 const {balanceSubjectHours}=await import('../src/subject-allocation.ts');
 const emma={id:'emma',name:'Emma',hours:6,subjects:[{id:'math',subject:'Math',hours:5},{id:'english',subject:'English',hours:1}]};
 assert.deepEqual(balanceSubjectHours(emma,'english',3).subjects.map(s=>s.hours),[3,3]);
 assert.deepEqual(balanceSubjectHours(emma,'math',2).subjects.map(s=>s.hours),[2,4]);
});

test('fresh allocations follow the selected package rather than a previous package',async()=>{
 const {initialAllocations}=await import('../src/subject-allocation.ts');
 assert.equal(initialAllocations(10,1)[0].hours,10);
 const smaller=initialAllocations(5,1);
 assert.equal(smaller[0].hours,5);
 assert.equal(smaller[0].subjects[0].hours,5);
 assert.equal(allocationProblem(smaller.map(s=>({...s,name:'Emma'})),5,1),'');
});

test('allocation matrix: every package, student count, split, and subject edit preserves totals',async()=>{
 const {initialAllocations,balanceSubjectHours}=await import('../src/subject-allocation.ts');
 for(const [capacity,limit] of [[5,1],[10,3],[20,5]])for(let count=1;count<=limit;count++){
  const roster=initialAllocations(capacity,count).map((s,i)=>({...s,name:`Student ${i}`}));
  assert.equal(roster.reduce((n,s)=>n+s.hours,0),capacity);
  assert.equal(allocationProblem(roster,capacity,limit),'');
  for(const student of roster)for(let shares=1;shares<=student.hours;shares++){
   const split={...student,subjects:Array.from({length:shares},(_,i)=>({id:`share-${i}`,subject:`Subject ${i}`,hours:i===0?student.hours-shares+1:1}))};
   for(const subject of split.subjects)for(let value=1;value<=student.hours;value++){
    const adjusted=balanceSubjectHours(split,subject.id,value);
    assert.equal(adjusted.subjects.reduce((n,s)=>n+s.hours,0),student.hours,JSON.stringify({capacity,count,shares,value}));
    assert.ok(adjusted.subjects.every(s=>s.hours>=1));
   }
  }
 }
});

test('duplicate subjects are rejected within a student, allowed across siblings',()=>{
 const duplicate={...students[0],subjects:students[0].subjects.map(a=>({...a,subject:'Algebra 1'}))};
 assert.match(allocationProblem([duplicate],10,3),/only once/);
 assert.equal(allocationProblem(students,10,3),'');
});
