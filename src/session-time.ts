import {Temporal} from '@js-temporal/polyfill';

export const TUTOR_ZONE='America/New_York';
export const MINUTE_MS=60_000;
export type TimeResult={kind:'resolved';instant:number}|{kind:'invalidDate'}|{kind:'invalidZone'}|{kind:'nonexistentTime'}|{kind:'ambiguousTime'};
export type BookingClock=Readonly<{now:number;noticeMs:number}>;
export const bookingClock=():BookingClock=>({now:Temporal.Now.instant().epochMilliseconds,noticeMs:24*60*MINUTE_MS});
export function calendarDate(value:string):Temporal.PlainDate{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new RangeError('Use an ISO calendar date.');
 return Temporal.PlainDate.from(value,{overflow:'reject'});
}
export const calendarAddDays=(date:string,days:number)=>calendarDate(date).add({days}).toString();
export const calendarWeekday=(date:string)=>calendarDate(date).dayOfWeek-1;
export function localInstant(date:string,start:number,timeZone=TUTOR_ZONE):TimeResult{
 let local:Temporal.PlainDateTime;
 try{
  if(!Number.isInteger(start)||start<0||start>=1440||start%15!==0)return {kind:'invalidDate'};
  local=calendarDate(date).toPlainDateTime({hour:Math.floor(start/60),minute:start%60});
 }catch{return {kind:'invalidDate'}}
 try{
  return {kind:'resolved',instant:local.toZonedDateTime(timeZone,{disambiguation:'reject'}).epochMilliseconds};
 }catch{
  try{
   const earlier=local.toZonedDateTime(timeZone,{disambiguation:'earlier'});
   const later=local.toZonedDateTime(timeZone,{disambiguation:'later'});
   return earlier.toPlainDateTime().equals(local)&&later.toPlainDateTime().equals(local)?{kind:'ambiguousTime'}:{kind:'nonexistentTime'};
  }catch{return {kind:'invalidZone'}}
 }
}
export const easternInstant=(date:string,start:number)=>localInstant(date,start,TUTOR_ZONE);
export function sessionInterval(session:{date:string;start:number;duration:number}):{kind:'resolved';start:number;end:number}|Exclude<TimeResult,{kind:'resolved'}>{
 if(!Number.isInteger(session.duration)||session.duration<=0)return {kind:'invalidDate'};
 const result=easternInstant(session.date,session.start);
 return result.kind==='resolved'?{kind:'resolved',start:result.instant,end:result.instant+session.duration*MINUTE_MS}:result;
}
export function weeklyInstants(firstDate:string,start:number,count:number):TimeResult[]{
 if(!Number.isInteger(count)||count<1)return [{kind:'invalidDate'}];
 try{return Array.from({length:count},(_,i)=>easternInstant(calendarAddDays(firstDate,7*i),start))}catch{return [{kind:'invalidDate'}]}
}
export function instantParts(instant:number,timeZone:string){
 const local=Temporal.Instant.fromEpochMilliseconds(instant).toZonedDateTimeISO(timeZone);
 return {date:local.toPlainDate().toString(),start:local.hour*60+local.minute,weekday:local.dayOfWeek-1};
}
export function viewSession(instant:number,timeZone:string):string{
 // Validate the zone with the same rules used for calculations.
 instantParts(instant,timeZone);
 return new Intl.DateTimeFormat('en-US',{timeZone,weekday:'short',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(instant)+` (${timeZone.split('/').pop()!.replaceAll('_',' ')} time)`;
}
export function noticeSatisfied(start:number,clock:BookingClock):boolean{
 return Number.isFinite(start)&&Number.isFinite(clock.now)&&Number.isFinite(clock.noticeMs)&&clock.noticeMs>=0&&start>=clock.now+clock.noticeMs;
}
export function intervalsOverlap(a:{start:number;end:number},b:{start:number;end:number}):boolean{return a.start<b.end&&b.start<a.end;}
// Legacy tests pass an explicit fixture calendar date. Never infer fixture mode
// by comparing it to today's date. Runtime callers supply the real instant clock.
export function normalizeClock(input:BookingClock|string):BookingClock{
 if(typeof input!=='string')return input;
 const instant=localInstant(input,0);
 if(instant.kind!=='resolved')return {now:NaN,noticeMs:NaN};
 return {now:instant.instant,noticeMs:24*60*MINUTE_MS};
}
