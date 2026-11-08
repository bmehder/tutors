import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, availabilityReason, conflictReason, formatDate, HOUR, isSoldOut,
  nextSchoolDay, overlaps, packagePrice, parseTime, plannedHours,
  supports, todayEastern, validatePlan,
} from '../src/family-planner-model.ts';

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
  assert.equal(supports(tutor,{...child,grade:3},'Math'),true);
  assert.equal(supports(tutor,child,'History'),false);
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
  const {describeConflict} = await import('../src/family-planner-model.ts');
  const childConflict=describeConflict({...session,id:'new',tutorId:'daniel',start:930},[session],[child,sibling],[tutor,otherTutor]);
  assert.match(childConflict,/Emma already has Math with Sarah/);
  assert.match(childConflict,/3:00 PM–4:00 PM ET/);
  const tutorConflict=describeConflict({...session,id:'new',childId:'noah'},[session],[child,sibling],[tutor,otherTutor]);
  assert.match(tutorConflict,/Sarah is teaching Emma Math/);
  assert.equal(describeConflict(session,[session],[child],[tutor],session.id),'');
  assert.equal(describeConflict({...session,id:'new',childId:'noah',tutorId:'daniel'},[session],[child,sibling],[tutor,otherTutor]),'');
});

test('package sharing limits are enforced for 5, 10, and 20 hours',async()=>{
 const {studentLimit,validateAllocations}=await import('../src/family-planner-model.ts');
 assert.equal(studentLimit(5),1);assert.equal(studentLimit(10),3);assert.equal(studentLimit(20),5);
 const allocations=n=>Array.from({length:n},(_,i)=>({childId:`child-${i}`,hours:1}));
 assert.equal(validateAllocations(allocations(1),5),'');
 assert.match(validateAllocations(allocations(2),5),/1 student/);
 assert.equal(validateAllocations(allocations(3),10),'');
 assert.match(validateAllocations(allocations(4),10),/3 students/);
 assert.equal(validateAllocations(allocations(5),20),'');
 assert.match(validateAllocations(allocations(6),20),/5 students/);
 assert.match(validateAllocations([{childId:'one',hours:6},{childId:'two',hours:5}],10),/exceed/);
 assert.match(validateAllocations([{childId:'one',hours:0}],10),/positive/);
 assert.match(validateAllocations([{childId:'one',hours:1},{childId:'one',hours:1}],10),/once/);
});
test('a ten-hour allocation creates ten sessions on the same weekday and time',async()=>{
 const {weeklySeries}=await import('../src/family-planner-model.ts');
 const series=weeklySeries(session,10);assert.equal(series.length,10);
 assert.equal(new Set(series.map(l=>l.id)).size,10);
 series.forEach((l,i)=>{assert.equal(l.date,addDays(session.date,i*7));assert.equal(l.start,session.start);assert.equal(l.tutorId,session.tutorId);assert.equal(l.childId,session.childId)});
});
test('skipping unavailable weeks preserves all allocated hours and avoids conflicts',async()=>{
 const {availableWeeklySeries}=await import('../src/family-planner-model.ts');
 const date=availableDate();
 const blocked={...session,date,id:'busy',childId:'noah'};
 const series=availableWeeklySeries({...session,date},10,tutor,child,[blocked],today);
 assert.equal(series.length,10);assert.equal(plannedHours(series),10);
 assert.ok(series.every(l=>l.date!==date));
 assert.equal(validatePlan(series,[blocked],[child,sibling],[tutor],10,today),'');
});

test('available options respect whichever choices the parent keeps',async()=>{
 const {availableAlternatives}=await import('../src/family-planner-model.ts');
 const date=availableDate(['sarah','daniel']);
 const all=availableAlternatives(session,child,[tutor,otherTutor],[],date,14,{},today);
 assert.ok(all.length>0);
 const sameTutor=availableAlternatives(session,child,[tutor,otherTutor],[],date,14,{tutorId:'sarah'},today);
 assert.ok(sameTutor.length>0);assert.ok(sameTutor.every(l=>l.tutorId==='sarah'));
 const sameTime=availableAlternatives(session,child,[tutor,otherTutor],[],date,14,{start:900},today);
 assert.ok(sameTime.some(l=>l.tutorId==='sarah'));assert.ok(sameTime.some(l=>l.tutorId==='daniel'));assert.ok(sameTime.every(l=>l.start===900));
 const sameDay=availableAlternatives(session,child,[tutor,otherTutor],[],date,14,{weekday:0},today);
 assert.ok(sameDay.length>0);assert.ok(sameDay.every(l=>new Date(`${l.date}T12:00:00Z`).getUTCDay()===1));
});
test('suggested alternatives exclude sold out, tutor clashes, student clashes, and partial overlaps',async()=>{
 const {availableAlternatives}=await import('../src/family-planner-model.ts');
 const date=availableDate(['sarah','daniel']);
 const blocked={...session,id:'other',date,start:930};
 const result=availableAlternatives({...session,id:'editing'},child,[tutor,otherTutor],[blocked],date,7,{},today);
 assert.ok(result.length>0);
 result.forEach(l=>assert.equal(availabilityReason(l,l.tutorId==='sarah'?tutor:otherTutor,child,[blocked],'editing',today),''));
 assert.ok(!result.some(l=>l.date===date&&l.start===900));
 assert.ok(!result.some(l=>l.date===date&&l.start===960));
});
test('skipping a week can find the next usual slot beyond an existing weekly routine',async()=>{
 const {availableAlternatives,weeklySeries}=await import('../src/family-planner-model.ts');
 const date=availableDate();const routine=weeklySeries({...session,date},10);
 const original=routine[0];
 const next=availableAlternatives(original,child,[tutor],routine,addDays(date,7),366,{tutorId:tutor.id,weekday:0,start:900},today)[0];
 assert.ok(next);assert.ok(next.date>routine[9].date);assert.equal(next.start,900);
 assert.equal(conflictReason(next,routine,original.id),'');
});

test('unused credit and fractional sessions are valid',()=>{
 const date=availableDate();
 assert.equal(validatePlan([{...session,date,duration:45}],[],[child],[tutor],10,today),'');
 assert.equal(plannedHours([{...session,date,duration:45}]),.75);
});
test('customizing one session does not redefine the default routine',async()=>{
 const {isCustomized,weeklySeries}=await import('../src/family-planner-model.ts');
 const baseline=weeklySeries(session,6);const changed={...baseline[0],date:addDays(baseline[0].date,1)};
 assert.equal(isCustomized(changed,baseline[0]),true);
 assert.equal(isCustomized({...baseline[1],tutorId:'daniel'},baseline[1]),true);
 assert.equal(isCustomized({...baseline[1],subject:'Science'},baseline[1]),true);
 assert.equal(isCustomized({...baseline[1],start:960},baseline[1]),true);
 assert.ok(baseline.slice(1).every(l=>!isCustomized(l,l)));
});

test('prototype plans derive replacements once and normalize restored defaults',async()=>{
 const {weeklyPlan,actualLessons,customizePlan}=await import('../src/tutoring-plan.ts');
 const first={...session,date:'2030-01-07'};
 const originals=Array.from({length:6},(_,i)=>({...first,id:`emma-${i}`,date:addDays(first.date,i*7)}));
 const plan=weeklyPlan(first,originals);
 const moved=customizePlan(plan,{...originals[0],date:addDays(first.date,1)});
 assert.equal(actualLessons(moved).length,6);
 assert.deepEqual(actualLessons(moved).slice(1),originals.slice(1));
 assert.equal(moved.sessions[0].kind,'customized');
 assert.equal(customizePlan(moved,originals[0]).sessions[0].kind,'default');
 assert.equal(plannedHours(actualLessons(moved)),6);
});
