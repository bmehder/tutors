import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarAddDays,calendarWeekday,easternInstant,localInstant,weeklyInstants,sessionInterval,instantParts,viewSession} from '../src/session-time.ts';
import {availabilityReason,validatePlan,isSoldOut,overlaps,weeklySeries} from '../temp-reference/typescript/family-planner-model.ts';
import {confirmOrder,revalidateOrder} from '../temp-reference/typescript/booking-domain.ts';
const hour=3600000;
const child={id:'emma',name:'Emma',color:0};
const tutor={id:'sarah',name:'Sarah',subjects:['Biology'],min:1,max:12,days:[0,1,2,3,4,5,6],times:['12:00 AM','1:00 AM','1:30 AM','2:00 AM','2:30 AM','3:00 AM','3:30 AM','4:00 AM','3:00 PM','4:00 PM','11:00 PM','11:30 PM']};
const base={id:'bio',childId:'emma',tutorId:'sarah',subject:'Biology',date:'2028-02-29',start:900,duration:60};
const instant=(date,start)=>{const r=easternInstant(date,start);assert.equal(r.kind,'resolved');return r.instant};
const early={now:Date.parse('2026-01-01T00:00:00Z'),noticeMs:24*hour};

test('Gregorian leap years include 2000/2028, exclude 2100; recurrence crosses leap day/year',()=>{
 assert.equal(calendarAddDays('2028-02-28',1),'2028-02-29');
 assert.equal(calendarAddDays('2000-02-28',1),'2000-02-29');
 assert.equal(calendarAddDays('2100-02-28',1),'2100-03-01');
 assert.throws(()=>calendarAddDays('2100-02-29',1));
 assert.deepEqual(weeklySeries({...base,date:'2028-02-22'},3).map(s=>s.date),['2028-02-22','2028-02-29','2028-03-07']);
 assert.equal(calendarAddDays('2028-12-29',7),'2029-01-05');
 assert.equal(calendarWeekday('2028-02-29'),1);
});
test('spring notice uses 23 elapsed hours, fall notice uses 25, exact deadline accepted',()=>{
 const spring={...base,date:'2027-03-14'};
 const springClock={now:instant('2027-03-13',900),noticeMs:24*hour};
 assert.match(availabilityReason(spring,tutor,child,[],undefined,springClock),/notice/);
 const fall={...base,date:'2027-11-07'};
 const fallClock={now:instant('2027-11-06',900),noticeMs:24*hour};
 assert.doesNotMatch(availabilityReason(fall,tutor,child,[],undefined,fallClock),/notice/);
 const start=instant(base.date,base.start);
 assert.doesNotMatch(availabilityReason(base,tutor,child,[],undefined,{now:start-24*hour,noticeMs:24*hour}),/notice/);
 assert.match(availabilityReason(base,tutor,child,[],undefined,{now:start-24*hour+1,noticeMs:24*hour}),/notice/);
});
test('availability and whole-plan validation reject nonexistent and repeated Eastern hours',()=>{
 for(const [date,start,pattern] of [['2027-03-14',150,/does not exist/],['2027-11-07',90,/occurs twice/]]){
  const session={...base,date,start};
  assert.match(availabilityReason(session,tutor,child,[],undefined,early),pattern);
  assert.match(validatePlan([session],[],[child],[tutor],5,early),pattern);
 }
});
test('elapsed session intervals cross midnight and spring clock jump correctly',()=>{
 const beforeMidnight={...base,start:1410};
 assert.equal(overlaps(beforeMidnight,{...base,date:'2028-03-01',start:0}),true);
 assert.equal(overlaps(beforeMidnight,{...base,date:'2028-03-01',start:30}),false);
 const spring={...base,date:'2027-03-14',start:90};
 const range=sessionInterval(spring);assert.equal(range.kind,'resolved');
 assert.equal(instantParts(range.end,'America/New_York').start,210);
 assert.equal(overlaps(spring,{...spring,start:180}),true);
});
test('Amsterdam DST changes differ from Eastern; local date rollovers preserve the instant',()=>{
 const dates=weeklyInstants('2027-03-07',900,5);assert.ok(dates.every(d=>d.kind==='resolved'));
 assert.deepEqual(dates.map(d=>instantParts(d.instant,'Europe/Amsterdam').start),[1260,1200,1200,1260,1260]);
 const late=instant('2027-01-04',1380);
 assert.equal(instantParts(late,'Asia/Tokyo').date,'2027-01-05');
 assert.equal(instantParts(late,'Pacific/Honolulu').date,'2027-01-04');
 assert.match(viewSession(late,'Europe/Amsterdam'),/Amsterdam time/);
});
test('worldwide resolution handles half-hour clock changes and invalid zones explicitly',()=>{
 assert.equal(localInstant('2027-10-03',135,'Australia/Lord_Howe').kind,'nonexistentTime');
 assert.equal(localInstant('2027-04-04',105,'Australia/Lord_Howe').kind,'ambiguousTime');
 assert.equal(localInstant('2027-01-01',900,'Not/AZone').kind,'invalidZone');
});
test('confirmation persists instants, rejects clock-change routines, rechecks expired checkout',()=>{
 let first='2027-03-07';while([0,1].some(i=>isSoldOut('sarah',calendarAddDays(first,i*7),900)))first=calendarAddDays(first,7);
 const draft={kind:'draft',package:{kind:'fiveHours'},students:[{id:'emma',name:'Emma',hours:2,subjects:[{id:'bio',subject:'Biology',hours:2}]}],routines:[{id:'bio',studentId:'emma',subject:'Biology',tutorId:'sarah',firstDate:first,start:900,count:2}]};
 const result=confirmOrder(draft,{name:'Sample Parent',email:'parent@example.com'},[tutor],early);
 assert.equal(result.kind,'ok');
 for(const session of result.value.sessions){assert.equal(session.endInstant-session.startInstant,hour);assert.equal(session.startInstant,instant(session.date,session.start))}
 assert.match(revalidateOrder(result.value,[tutor],{now:result.value.sessions[0].startInstant-24*hour+1,noticeMs:24*hour}),/notice/);
 for(const [date,start] of [['2027-03-14',150],['2027-11-07',90]])assert.equal(confirmOrder({...draft,routines:[{...draft.routines[0],firstDate:date,start}]},{name:'Sample Parent',email:'parent@example.com'},[tutor],early).kind,'error');
});
