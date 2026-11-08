import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmOrder,newDraft,changePackage} from '../src/booking-domain.ts';
import {tutors} from '../src/tutoring-data.ts';
const contact={name:'Sample Parent',email:'parent@example.com'};
const draft={kind:'draft',package:{kind:'tenHours'},students:[{id:'emma',name:'Emma',hours:2,subjects:[{id:'math',subject:'Algebra 1',hours:2}]}],routines:[{id:'math',studentId:'emma',subject:'Algebra 1',tutorId:'sarah',firstDate:'2030-01-07',start:915,count:2}]};
test('package change removes all dependent draft data',()=>{
 const changed=changePackage({kind:'fiveHours'},draft);
 assert.deepEqual(changed,newDraft({kind:'fiveHours'}));
 assert.equal(changePackage({kind:'tenHours'},draft),draft);
});
test('confirmation rejects missing contact, unmatched allocations and duplicate subjects',()=>{
 assert.equal(confirmOrder(draft,{name:'',email:''},tutors).kind,'error');
 assert.equal(confirmOrder({...draft,routines:[]},contact,tutors).kind,'error');
 assert.equal(confirmOrder({...draft,students:[{...draft.students[0],subjects:[...draft.students[0].subjects,{id:'second',subject:'Algebra 1',hours:1}]}]},contact,tutors).kind,'error');
});
test('invalid dates and non-quarter-hour starts cannot become orders',()=>{
 for(const patch of [{firstDate:'2030-02-30'},{start:917},{tutorId:''},{count:0}])assert.equal(confirmOrder({...draft,routines:[{...draft.routines[0],...patch}]},contact,tutors).kind,'error');
});

test('successful orders retain contact and names without sharing mutable draft data',()=>{
 let result;
 for(let start=900;start<=1020;start+=15){
  result=confirmOrder({...draft,routines:[{...draft.routines[0],start}]},contact,tutors);
  if(result.kind==='ok')break;
 }
 assert.equal(result.kind,'ok');
 assert.equal(result.value.sessions.length,2);
 assert.equal(result.value.contact.email,contact.email);
 assert.equal(result.value.students[0].name,'Emma');
 assert.ok(Object.isFrozen(result.value));
 assert.ok(Object.isFrozen(result.value.sessions[0]));
 assert.throws(()=>{result.value.sessions[0].duration=90},TypeError);
});
