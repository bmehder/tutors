// Calendar recurrence is anchored to Eastern, not the viewing zone or a UTC week.
export const TUTOR_ZONE='America/New_York';
export type TimeResult={kind:'resolved';instant:number}|{kind:'invalidDate'}|{kind:'nonexistentTime'}|{kind:'ambiguousTime'};
const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:TUTOR_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function easternInstant(date:string,start:number):TimeResult{
 const parsed=Date.parse(`${date}T00:00:00Z`);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==date||!Number.isInteger(start)||start<0||start>=1440||start%15)return {kind:'invalidDate'};
 const matches:number[]=[];
 // Eastern uses UTC-4 or UTC-5 for the supported modern booking calendar.
 for(const offset of [4,5]){
  const instant=parsed+(start+offset*60)*60000;
  const parts=formatter.formatToParts(instant);const part=(key:string)=>parts.find(p=>p.type===key)!.value;
  if(`${part('year')}-${part('month')}-${part('day')}`===date&&Number(part('hour'))*60+Number(part('minute'))===start)matches.push(instant);
 }
 return matches.length===1?{kind:'resolved',instant:matches[0]}:matches.length?{kind:'ambiguousTime'}:{kind:'nonexistentTime'};
}
export function weeklyInstants(firstDate:string,start:number,count:number):TimeResult[]{
 if(!Number.isInteger(count)||count<1)return [{kind:'invalidDate'}];
 const first=easternInstant(firstDate,start);if(first.kind==='invalidDate')return [first];
 return Array.from({length:count},(_,i)=>{const d=new Date(`${firstDate}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+7*i);return easternInstant(d.toISOString().slice(0,10),start)});
}
export function viewSession(instant:number,timeZone:string):string{
 return new Intl.DateTimeFormat('en-US',{timeZone,weekday:'short',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(instant);
}
