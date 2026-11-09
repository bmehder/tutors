import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, availabilityReason, conflictReason, formatDate, HOUR, isSoldOut,
  nextSchoolDay, overlaps, packagePrice, parseTime, plannedHours,
  supports, todayEastern, validatePlan,
} from '../family-planner-model.ts';

const child = {id:'emma',name:'Emma',grade:8,color:0};
const sibling = {id:'noah',name:'Noah',grade:10,color:1};
const tutor = {id:'sarah',name:'Sarah',subjects:['Math'],min:4,max:12,days:[0,1,2,3,4],times:['3:00 PM','3:30 PM','4:00 PM','5:00 PM']};
const otherTutor = {...tutor,id:'daniel',name:'Daniel'};
const session = {id:'one',childId:'emma',tutorId:'sarah',subject:'Math',date:'2030-01-07',start:900,duration:HOUR};
const today = '2030-01-01';
function availableDate(tutorIds=['sarah']) {
  let date = '2030-01-07';
  while (tutorIds.some(id => isSoldOut(id,date,900))) date = addDays(date,7);
  return date;
}

test('siblings can learn at the same time with different tutors',()=>{
  const second={...session,id:'two',childId:sibling.id,tutorId:'daniel'};
  assert.equal(conflictReason(second,[session]),'');
  const date=availableDate(['sarah','daniel']);
  assert.equal(validatePlan([{...session,date},{...second,date}],[],[child,sibling],[tutor,otherTutor],5,today),'');
});
test('one child cannot overlap even when the tutors differ',()=>{
  assert.match(conflictReason({...session,id:'two',tutorId:'daniel'},[session]),/child/);
});
test('one tutor cannot overlap even when children differ',()=>{
  assert.match(conflictReason({...session,id:'two',childId:'noah'},[session]),/tutor/);
});
test('partial overlaps are blocked, not just identical start times',()=>{
  assert.equal(overlaps(session,{...session,start:930}),true);
  assert.match(conflictReason({...session,id:'two',start:930},[session]),/child/);
  assert.match(conflictReason({...session,id:'two',childId:'noah',start:930},[session]),/tutor/);
});
test('back-to-back sessions and different dates are allowed',()=>{
  assert.equal(conflictReason({...session,id:'two',start:960},[session]),'');
  assert.equal(conflictReason({...session,id:'two',date:addDays(session.date,1)},[session]),'');
});
test('editing a session ignores that original but still checks other sessions',()=>{
  assert.equal(conflictReason(session,[session],session.id),'');
  assert.match(conflictReason(session,[session,{...session,id:'two'}],session.id),/child/);
});
test('confirmed bookings remain unavailable in new plans',()=>{
  const date=availableDate();
  assert.match(validatePlan([{...session,id:'new',date}],[{...session,date}],[child],[tutor],5,today),/child/);
});
test('capacity uses the whole family balance; siblings have no separate cap',()=>{
  const date=availableDate(['sarah','daniel']);
  const family=[{...session,date},{...session,id:'two',date,childId:sibling.id,tutorId:'daniel'}];
  assert.equal(plannedHours(family),2);
  assert.equal(validatePlan(family,[],[child,sibling],[tutor,otherTutor],5,today),'');
  assert.match(validatePlan(family,[],[child,sibling],[tutor,otherTutor],1,today),/package/);
});
test('subject eligibility is enforced without a grade gate',()=>{
  assert.equal(supports(tutor,'Math'),true);
  assert.equal(supports(tutor,'History'),false);
  const date=availableDate();
  assert.match(validatePlan([{...session,date,subject:'History'}],[],[child],[tutor],5,today),/subject/);
});
test('tutor hours and working days are enforced',()=>{
  assert.match(availabilityReason({...session,start:705},tutor,child,[],undefined,today),/available/);
  assert.match(availabilityReason({...session,date:'2030-01-06'},tutor,child,[],undefined,today),/available/);
});
test('sold-out dates are rejected, including in repeating schedules',()=>{
  let date='2030-01-07';while(!isSoldOut('sarah',date,900))date=addDays(date,7);
  assert.match(validatePlan([{...session,date}],[],[child],[tutor],5,today),/sold out/);
});
test('skipping a weekly date uses no hour and keeps other dates unchanged',()=>{
  const dates=Array.from({length:4},(_,i)=>addDays('2030-03-04',7*i));
  const sessions=dates.filter((_,i)=>i!==1).map((date,i)=>({...session,id:`skip-${i}`,date}));
  assert.equal(plannedHours(sessions),3);
  assert.deepEqual(sessions.map(l=>l.date),['2030-03-04','2030-03-18','2030-03-25']);
});
test('date arithmetic preserves the weekday across DST and year boundaries',()=>{
  assert.equal(addDays('2026-10-26',7),'2026-11-02');
  assert.equal(addDays('2026-12-28',7),'2027-01-04');
  assert.equal(nextSchoolDay('2026-11-06'),'2026-11-09');
  assert.equal(todayEastern(new Date('2026-11-09T02:00:00Z')),'2026-11-08');
  assert.match(formatDate('2026-11-09'),/Mon/);
});
test('past dates, unknown children, and empty plans are rejected',()=>{
  assert.match(validatePlan([],[],[child],[tutor],5,today),/at least/);
  assert.match(validatePlan([{...session,date:'2029-12-31'}],[],[child],[tutor],5,today),/future/);
  assert.match(validatePlan([session],[],[],[tutor],5,today),/child/);
});
test('package prices are shared and welcome discount applies once',()=>{
  assert.deepEqual(packagePrice(20,70,true),{subtotal:1400,savings:280,total:1120});
  assert.deepEqual(packagePrice(5,80),{subtotal:400,savings:0,total:400});
});
test('AM/PM times are parsed to intervals correctly',()=>{
  assert.equal(parseTime('12:00 AM'),0);assert.equal(parseTime('12:00 PM'),720);assert.equal(parseTime('3:30 PM'),930);
});

test('live conflict explanations identify the child, tutor, subject, and occupied interval', async()=>{
  const {describeConflict} = await import('../family-planner-model.ts');
  const childConflict=describeConflict({...session,id:'new',tutorId:'daniel',start:930},[session],[child,sibling],[tutor,otherTutor]);
  assert.match(childConflict,/Emma already has Math with Sarah/);
  assert.match(childConflict,/3:00 PM–4:00 PM ET/);
  const tutorConflict=describeConflict({...session,id:'new',childId:'noah'},[session],[child,sibling],[tutor,otherTutor]);
  assert.match(tutorConflict,/Sarah is teaching Emma Math/);
  assert.equal(describeConflict(session,[session],[child],[tutor],session.id),'');
  assert.equal(describeConflict({...session,id:'new',childId:'noah',tutorId:'daniel'},[session],[child,sibling],[tutor,otherTutor]),'');
});

test('a ten-hour allocation creates ten sessions on the same weekday and time',async()=>{
 const {weeklySeries}=await import('../family-planner-model.ts');
 const series=weeklySeries(session,10);assert.equal(series.length,10);
 assert.equal(new Set(series.map(l=>l.id)).size,10);
 series.forEach((l,i)=>{assert.equal(l.date,addDays(session.date,i*7));assert.equal(l.start,session.start);assert.equal(l.tutorId,session.tutorId);assert.equal(l.childId,session.childId)});
});

test('unused credit and fractional sessions are valid',()=>{
 const date=availableDate();
 assert.equal(validatePlan([{...session,date,duration:45}],[],[child],[tutor],10,today),'');
 assert.equal(plannedHours([{...session,date,duration:45}]),.75);
});
