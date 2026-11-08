import {noticeSatisfied,intervalsOverlap} from './session-time.ts';
// Pure reference model. A production adapter must execute reserve atomically
// against shared storage; this in-memory value is NOT a concurrency guarantee.
export type Interval=Readonly<{start:number;end:number}>; // epoch milliseconds
export type RequestedSession=Readonly<{id:string;studentId:string;tutorId:string;subjectId:string;interval:Interval}>;
export type BookingRequest=Readonly<{key:string;customerId:string;sessions:readonly RequestedSession[]}>;
export type ReservationError={kind:'invalidRequest'}|{kind:'tooSoon';sessionId:string}|{kind:'unavailable';sessionId:string}|{kind:'conflict';sessionId:string;resource:'student'|'tutor'}|{kind:'retryMismatch'};
export type ReservationResult={kind:'reserved';ledger:Ledger;booking:BookingRequest;replayed:boolean}|{kind:'rejected';error:ReservationError};
export type Policy=Readonly<{now:number;noticeMs:number;availability:readonly Readonly<{tutorId:string;subjectIds:readonly string[];interval:Interval}>[]}>;
export class Ledger {
 readonly bookings:readonly BookingRequest[];
 private constructor(bookings:readonly BookingRequest[]){this.bookings=bookings;Object.freeze(this);}
 static empty():Ledger{return new Ledger(Object.freeze([]));}
 static reserve(ledger:Ledger,request:BookingRequest,policy:Policy):ReservationResult{
  const reject=(error:ReservationError):ReservationResult=>({kind:'rejected',error});
  if(!request.key||!request.customerId||!request.sessions.length||!Number.isFinite(policy.now)||!Number.isFinite(policy.noticeMs)||policy.noticeMs<0)return reject({kind:'invalidRequest'});
  const existing=ledger.bookings.find(b=>b.customerId===request.customerId&&b.key===request.key);
  if(existing)return JSON.stringify(existing)===JSON.stringify(request)?{kind:'reserved',ledger,booking:existing,replayed:true}:reject({kind:'retryMismatch'});
  if(new Set(request.sessions.map(s=>s.id)).size!==request.sessions.length)return reject({kind:'invalidRequest'});
  const accepted:RequestedSession[]=[];
  for(const session of request.sessions){
   const {start,end}=session.interval;
   if(!session.id||!session.studentId||!session.tutorId||!session.subjectId||!Number.isFinite(start)||end-start!==3600000)return reject({kind:'invalidRequest'});
   if(!noticeSatisfied(start,policy))return reject({kind:'tooSoon',sessionId:session.id});
   if(!policy.availability.some(w=>w.tutorId===session.tutorId&&w.subjectIds.includes(session.subjectId)&&w.interval.start<=start&&end<=w.interval.end))return reject({kind:'unavailable',sessionId:session.id});
   const clashes=ledger.bookings.flatMap(b=>b.sessions.map(s=>({session:s,customerId:b.customerId}))).concat(accepted.map(s=>({session:s,customerId:request.customerId}))).filter(other=>intervalsOverlap(session.interval,other.session.interval));
   if(clashes.some(o=>o.session.tutorId===session.tutorId))return reject({kind:'conflict',sessionId:session.id,resource:'tutor'});
   // Local student IDs are scoped to the customer, never compared globally.
   if(clashes.some(o=>o.customerId===request.customerId&&o.session.studentId===session.studentId))return reject({kind:'conflict',sessionId:session.id,resource:'student'});
   accepted.push(session);
  }
  const booking=Object.freeze({...request,sessions:Object.freeze(request.sessions.map(s=>Object.freeze({...s,interval:Object.freeze({...s.interval})})))});
  return {kind:'reserved',ledger:new Ledger(Object.freeze([...ledger.bookings,booking])),booking,replayed:false};
 }
}
