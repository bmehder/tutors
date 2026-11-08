import test from 'node:test';
import assert from 'node:assert/strict';
import {Ledger} from '../src/reservation-domain.ts';
import {easternInstant,weeklyInstants,viewSession} from '../src/session-time.ts';
const hour=3600000;
const policy={now:0,noticeMs:hour,availability:['sarah','daniel'].map(tutorId=>({tutorId,subjectIds:['math'],interval:{start:0,end:100*hour}}))};
const session=(id,start=hour,tutorId='sarah',studentId='emma')=>({id,studentId,tutorId,subjectId:'math',interval:{start,end:start+hour}});
const request=(key,sessions,customerId='family')=>({key,customerId,sessions});
test('racing snapshots must be serialized: second family loses tutor slot',()=>{
 const a=Ledger.reserve(Ledger.empty(),request('a',[session('a')]),policy);
 assert.equal(a.kind,'reserved');
 const b=Ledger.reserve(a.ledger,request('b',[session('b')],'other'),policy);
 assert.deepEqual(b.error,{kind:'conflict',sessionId:'b',resource:'tutor'});
});
test('all sessions reserve or none do; original ledger stays unchanged',()=>{
 const ledger=Ledger.empty();
 const failed=Ledger.reserve(ledger,request('a',[session('a'),session('b',hour,'daniel')]),policy);
 assert.equal(failed.kind,'rejected');assert.equal(failed.error.resource,'student');assert.equal(ledger.bookings.length,0);
});
test('siblings can overlap; back-to-back tutor sessions are allowed',()=>{
 assert.equal(Ledger.reserve(Ledger.empty(),request('a',[session('a'),session('b',hour,'daniel','jack')]),policy).kind,'reserved');
 assert.equal(Ledger.reserve(Ledger.empty(),request('b',[session('a'),session('b',2*hour)]),policy).kind,'reserved');
});
test('retry returns original booking even after notice expires; changed payload rejected',()=>{
 const req=request('a',[session('a')]);const a=Ledger.reserve(Ledger.empty(),req,policy);
 assert.equal(Ledger.reserve(a.ledger,req,{...policy,now:hour}).replayed,true);
 assert.equal(Ledger.reserve(a.ledger,request('a',[session('a',2*hour)]),policy).error.kind,'retryMismatch');
});
test('notice uses exact instants and entire duration must fit availability',()=>{
 assert.equal(Ledger.reserve(Ledger.empty(),request('a',[session('a')]),policy).kind,'reserved');
 assert.equal(Ledger.reserve(Ledger.empty(),request('a',[session('a')]),{...policy,now:1}).error.kind,'tooSoon');
 assert.equal(Ledger.reserve(Ledger.empty(),request('a',[session('a',99.5*hour)]),policy).error.kind,'unavailable');
});
test('Eastern DST gaps and repeated times require explicit resolution',()=>{
 assert.equal(easternInstant('2027-03-14',150).kind,'nonexistentTime');
 assert.equal(easternInstant('2027-11-07',90).kind,'ambiguousTime');
 assert.equal(easternInstant('2027-02-30',900).kind,'invalidDate');
});
test('weekly Eastern time stays fixed while UTC spacing changes at DST',()=>{
 const spring=weeklyInstants('2027-03-07',900,2);assert.ok(spring.every(r=>r.kind==='resolved'));
 assert.equal(spring[1].instant-spring[0].instant,167*hour);
 const fall=weeklyInstants('2027-10-31',900,2);assert.equal(fall[1].instant-fall[0].instant,169*hour);
});
test('family viewing zone changes date and time, never the reserved instant',()=>{
 const result=easternInstant('2027-01-04',1380);assert.equal(result.kind,'resolved');
 assert.match(viewSession(result.instant,'Asia/Tokyo'),/Jan 5/);
 assert.match(viewSession(result.instant,'America/Los_Angeles'),/8:00 PM/);
});

test('Amsterdam display uses a familiar city label without GMT or Eastern',()=>{
 const result=easternInstant('2026-11-10',900);
 const label=viewSession(result.instant,'Europe/Amsterdam');
 assert.match(label,/9:00 PM/);assert.match(label,/Amsterdam time/);
 assert.doesNotMatch(label,/GMT|Eastern/);
});
