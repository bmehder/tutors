import {useState} from 'react';
import {calendarAddDays,instantParts,easternInstant,viewSession,bookingClock} from './session-time';
import {availabilityReason,parseTime,weeklySeries,type Child,type Lesson,type Tutor} from './family-planner-model';
type Props={zone:string;tutor:Tutor|undefined;child:Child;subject:string;hours:number;existing:Lesson[];onSelect:(date:string,start:number)=>void;onDateChange:()=>void;selected:{date:string;start:number}|null};
export default function WeeklyTimeChoices({zone,tutor,child,subject,hours,existing,onSelect,onDateChange,selected}:Props){
 const today=instantParts(bookingClock().now,zone).date;
 const initial=selected?easternInstant(selected.date,selected.start):null;
 const initialDate=initial?.kind==='resolved'?instantParts(initial.instant,zone).date:calendarAddDays(today,1);
 const [firstDate,setFirstDate]=useState(initialDate);
 const [anchor,setAnchor]=useState(initialDate);
 function options(localDate:string){
  if(!tutor)return [];
  const result:{date:string;start:number;instant:number;issue:string}[]=[];
  for(const delta of [-1,0,1])for(const time of tutor.times){
   const date=calendarAddDays(localDate,delta),start=parseTime(time),resolved=easternInstant(date,start);
   if(resolved.kind!=='resolved'||instantParts(resolved.instant,zone).date!==localDate)continue;
   const first:Lesson={id:'option',childId:child.id,tutorId:tutor.id,subject,date,start,duration:60};
   const issue=weeklySeries(first,hours).map(session=>availabilityReason(session,tutor,child,existing)).find(Boolean)||'';
   result.push({date,start,instant:resolved.instant,issue});
  }
  return result.sort((a,b)=>a.instant-b.instant);
 }
 const choices=options(firstDate);
 return <div className="space-y-4"><label className="planner-label block">First weekly session<input type="date" className="field mt-2" value={firstDate} min={calendarAddDays(today,1)} max={calendarAddDays(today,180)} onChange={e=>{if(!e.target.value)return;setFirstDate(e.target.value);setAnchor(e.target.value);onDateChange()}}/><span className="block text-xs font-normal leading-5 text-ink/60 mt-2">Choose the exact first date in {zone.split('/').pop()?.replaceAll('_',' ')} time. Sessions repeat weekly; clock changes may affect your local time.</span></label>
 {tutor&&<><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{Array.from({length:7},(_,i)=>{const date=calendarAddDays(anchor,i),count=options(date).filter(o=>!o.issue).length;return <button type="button" key={date} aria-pressed={date===firstDate} onClick={()=>{setFirstDate(date);onDateChange()}} className={`border rounded-lg p-3 text-left ${date===firstDate?'border-ink bg-[#edf3ed] ring-1 ring-ink':'border-ink/20'}`}><span className="block text-sm font-semibold">{new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'}).format(new Date(`${date}T12:00Z`))}</span><span className="block text-xs mt-1">{count?`${count} available times`:'No weekly times'}</span></button>})}</div><p className="planner-label">Choose a time for this date</p><div className="flex flex-wrap gap-2">{choices.map(option=><button key={`${option.date}-${option.start}`} type="button" disabled={!!option.issue} title={option.issue} aria-pressed={selected?.date===option.date&&selected.start===option.start} onClick={()=>onSelect(option.date,option.start)} className={`border rounded-lg px-4 py-3 text-xs min-h-11 disabled:opacity-40 ${selected?.date===option.date&&selected.start===option.start?'bg-ink text-white':'border-ink/20'}`}>{viewSession(option.instant,zone)}{option.issue&&<span className="block mt-1">Unavailable</span>}</button>)}</div>{!choices.some(o=>!o.issue)&&<p role="status" className="planner-action">No complete weekly routine is available starting on this date. Choose another date or tutor.</p>}</>}
 </div>
}
