import {addDays,availabilityReason,type Lesson,type Tutor,type Child} from './family-planner-model.ts';
import {calendarDate} from '../../src/session-time.ts';
export function skippedWeeks(firstDate:string,sessions:readonly Lesson[]):string[]{
 const dates=new Set(sessions.map(s=>s.date));const last=[...dates].sort().at(-1);const skipped:string[]=[];
 if(!last)return skipped;
 for(let date=firstDate;date<last;date=addDays(date,7)){if(!dates.has(date))skipped.push(date)}
 return skipped;
}
export function weeklyDates(firstDate:string,count:number,skipped:readonly string[]=[]):string[]{
 const first=calendarDate(firstDate);
 if(!Number.isInteger(count)||count<1||count>20||skipped.length>52||new Set(skipped).size!==skipped.length)throw new RangeError('Invalid weekly routine.');
 for(const date of skipped){const days=first.until(calendarDate(date)).days;if(days<0||days%7||days>7*72)throw new RangeError('Skipped date is outside this weekly routine.');}
 const result:string[]=[];
 for(let week=0;result.length<count&&week<73;week++){const date=addDays(firstDate,week*7);if(!skipped.includes(date))result.push(date)}
 if(result.length!==count||skipped.some(date=>date>result.at(-1)!))throw new RangeError('Unused skipped date.');
 return result;
}
export function skipWeek(sessions:readonly Lesson[],id:string,tutor:Tutor,child:Child,otherSessions:Lesson[]):{kind:'updated';sessions:Lesson[];from:string;to:string}|{kind:'unavailable';message:string}{
 const target=sessions.find(s=>s.id===id);if(!target)return {kind:'unavailable',message:'Choose a session to skip.'};
 const last=[...sessions].sort((a,b)=>a.date.localeCompare(b.date)).at(-1)!;
 const kept=sessions.filter(s=>s.id!==id);
 for(let week=1;week<=52;week++){
  const replacement={...target,date:addDays(last.date,week*7)};
  if(!availabilityReason(replacement,tutor,child,[...otherSessions,...kept]))return {kind:'updated',sessions:[...kept,replacement].sort((a,b)=>a.date.localeCompare(b.date)),from:target.date,to:replacement.date};
 }
 return {kind:'unavailable',message:'No matching week is available after this routine within the next 52 weeks. Contact support for help.'};
}
