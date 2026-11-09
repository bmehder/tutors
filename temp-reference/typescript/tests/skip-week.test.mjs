import test from 'node:test';
import assert from 'node:assert/strict';
import {skipWeek,skippedWeeks,weeklyDates} from '../skip-week.ts';
import {weeklySeries,isSoldOut} from '../family-planner-model.ts';
import {confirmOrder} from '../booking-domain.ts';
const child={id:'emma',name:'Emma',color:0};
const tutor={id:'sarah',name:'Sarah',subjects:['Biology'],min:1,max:12,days:[0],times:['3:00 PM']};
const first={id:'bio',childId:'emma',tutorId:'sarah',subject:'Biology',date:'2030-01-07',start:900,duration:60};
test('skipping a middle week preserves all other sessions, tutor, time, and hours',()=>{
 const original=weeklySeries(first,3);const result=skipWeek(original,original[1].id,tutor,child,[]);
 assert.equal(result.kind,'updated');assert.equal(result.sessions.length,3);
 assert.ok(result.to>original.at(-1).date);
 assert.ok(!result.sessions.some(s=>s.date===original[1].date));
 assert.ok(result.sessions.every(s=>s.tutorId===tutor.id&&s.start===900));
 assert.deepEqual(result.sessions.find(s=>s.id===original[0].id),original[0]);
 assert.deepEqual(weeklyDates(first.date,3,skippedWeeks(first.date,result.sessions)),result.sessions.map(s=>s.date));
});
test('consecutive skipped weeks reconstruct the same exact session dates',()=>{
 const original=weeklySeries(first,4);
 const once=skipWeek(original,original[1].id,tutor,child,[]);assert.equal(once.kind,'updated');
 const twice=skipWeek(once.sessions,original[2].id,tutor,child,[]);assert.equal(twice.kind,'updated');
 assert.deepEqual(weeklyDates(first.date,4,skippedWeeks(first.date,twice.sessions)),twice.sessions.map(s=>s.date));
});
test('no future tutor availability leaves the original plan intact',()=>{
 const original=weeklySeries(first,3);const snapshot=structuredClone(original);
 assert.equal(skipWeek(original,original[1].id,{...tutor,days:[]},child,[]).kind,'unavailable');
 assert.deepEqual(original,snapshot);
});
test('confirmation preserves skipped dates and exact replacement instants',()=>{
 let original=weeklySeries(first,3);
 while(original.some(s=>isSoldOut(tutor.id,s.date,s.start)))original=weeklySeries({...first,date:weeklyDates(original[0].date,2)[1]},3);
 const result=skipWeek(original,original[1].id,tutor,child,[]);assert.equal(result.kind,'updated');
 const draft={kind:'draft',package:{kind:'fiveHours'},students:[{id:'emma',name:'Emma',hours:3,subjects:[{id:'bio',subject:'Biology',hours:3}]}],routines:[{id:'bio',studentId:'emma',subject:'Biology',tutorId:'sarah',firstDate:original[0].date,start:900,count:3,skippedDates:skippedWeeks(original[0].date,result.sessions)}]};
 const order=confirmOrder(draft,{name:'Parent',email:'parent@example.com'},[tutor]);
 assert.equal(order.kind,'ok');assert.deepEqual(order.value.sessions.map(s=>s.date),result.sessions.map(s=>s.date));
 assert.ok(order.value.sessions.every(s=>s.endInstant-s.startInstant===3600000));
});
