import {useState} from 'react';
import {ArrowRight,Check,CheckCircle2,ChevronLeft,ChevronRight} from 'lucide-react';
import {tutors} from './tutoring-data';
import {addDays,availableAlternatives,availabilityReason,formatDate,formatTime,parseTime,SUBJECTS,supports,todayEastern,type Child,type Lesson} from './family-planner-model';
const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday'];
type Props={original:Lesson;child:Child;existing:Lesson[];onSave:(session:Lesson)=>void};
export default function LessonOptions({original,child,existing,onSave}:Props){
 const [subject,setSubject]=useState(original.subject);
 const [lessonDuration,setLessonDuration]=useState(original.duration);
 const [tutor,setTutor]=useState(original.tutorId);
 const [day,setDay]=useState('any');const [time,setTime]=useState('any');
 const [from,setFrom]=useState(original.date>todayEastern()?original.date:addDays(todayEastern(),1));
 const [selected,setSelected]=useState<Lesson|null>(original);
 const filters={tutorId:tutor==='any'?undefined:tutor,weekday:day==='any'?undefined:Number(day),start:time==='any'?undefined:Number(time)};
 const base={...original,subject,duration:lessonDuration};
 const options=availableAlternatives(base,child,tutors,existing,from,14,filters);
 const dates=[...new Set(options.map(l=>l.date))];
 const selectedIssue=selected?availabilityReason(selected,tutors.find(t=>t.id===selected.tutorId),child,existing,original.id):'';
 // Suggest one relaxed choice at a time; never change the parent's filters silently.
 const relaxations=options.length?[]:[
  ...(tutor!=='any'?[{label:'Show other tutors',apply:()=>setTutor('any'),filters:{...filters,tutorId:undefined}}]:[]),
  ...(day!=='any'?[{label:'Show other weekdays',apply:()=>setDay('any'),filters:{...filters,weekday:undefined}}]:[]),
  ...(time!=='any'?[{label:'Show other times',apply:()=>setTime('any'),filters:{...filters,start:undefined}}]:[])
 ].filter(item=>availableAlternatives(base,child,tutors,existing,from,14,item.filters).length>0);
 function move(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return;setFrom(value);setSelected(null)}
 return <form onSubmit={e=>{e.preventDefault();if(selected&&!selectedIssue)onSave(selected)}} className="space-y-5 mt-5">
  <div className="bg-[#edf3ed] rounded-lg p-4 text-xs leading-6"><strong>{child.name} · {lessonDuration}-minute session</strong><p>Keep what matters, change what doesn’t. The options below always match your choices and have no scheduling conflicts.</p></div>
<label className="planner-label block">Subject<select className="field mt-2" value={subject} onChange={e=>{setSubject(e.target.value);setTutor('any');setSelected(null)}}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></label>
  <div className="grid sm:grid-cols-2 gap-4"><label className="planner-label">Tutor<select value={tutor} onChange={e=>{setTutor(e.target.value);setSelected(null)}} className="field mt-2"><option value="any">Any suitable tutor</option>{tutors.filter(t=>supports(t,child,subject)).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label className="planner-label">Day<select value={day} onChange={e=>{setDay(e.target.value);setSelected(null)}} className="field mt-2"><option value="any">Any weekday</option>{DAYS.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label></div>
  <div className="grid sm:grid-cols-2 gap-4"><label className="planner-label">Time · Eastern<select value={time} onChange={e=>{setTime(e.target.value);setSelected(null)}} className="field mt-2"><option value="any">Any time</option>{[...new Set(tutors.flatMap(t=>t.times.map(parseTime)))].sort((a,b)=>a-b).map(t=><option key={t} value={t}>{formatTime(t)}</option>)}</select></label><label className="planner-label">Look from<input type="date" min={addDays(todayEastern(),1)} max={addDays(todayEastern(),365)} value={from} onChange={e=>move(e.target.value)} className="field mt-2"/></label></div>
  <button type="button" className="planner-outline w-full" onClick={()=>{move(addDays(original.date,7));setDay(String((new Date(`${original.date}T12:00:00Z`).getUTCDay()+6)%7));setTime(String(original.start));setTutor(original.tutorId)}}>Skip this week · find my usual day & time<ArrowRight size={14}/></button>
  <div className="flex gap-3 justify-between items-center"><button type="button" disabled={addDays(from,-14)<=todayEastern()} onClick={()=>move(addDays(from,-14))} className="planner-small disabled:opacity-30"><ChevronLeft size={14}/>Earlier</button><span className="text-[10px] text-center text-ink/60">{formatDate(from)} – {formatDate(addDays(from,13))}</span><button type="button" disabled={addDays(from,14)>addDays(todayEastern(),365)} onClick={()=>move(addDays(from,14))} className="planner-small disabled:opacity-30">Later<ChevronRight size={14}/></button></div>
  <p role="status" aria-live="polite" className="text-xs font-semibold text-[#35573d]">{options.length} available {options.length===1?'option':'options'} match your choices.</p>
  {!options.length&&<div className="bg-cream p-4 rounded-lg text-xs leading-6"><p>No matches in these two weeks. Keep your choices and look later, or change one of them:</p><div className="flex flex-wrap gap-2 mt-3">{relaxations.map(item=><button key={item.label} type="button" onClick={()=>{item.apply();setSelected(null)}} className="planner-outline">{item.label}</button>)}</div><button type="button" onClick={()=>{const next=availableAlternatives(base,child,tutors,existing,from,366,filters).find(l=>l.date>addDays(from,13));if(next){setFrom(next.date);setSelected(null)}}} disabled={!availableAlternatives(base,child,tutors,existing,from,366,filters).some(l=>l.date>addDays(from,13))} className="text-xs underline underline-offset-4 mt-3 min-h-10 disabled:opacity-40">Find the next matching date</button><p className="text-[10px] text-ink/55 mt-2">Other planned sessions stay in place. If your usual slot is already planned for later weeks, the next free date may be after that routine.</p></div>}
  <div className="space-y-4 pr-1">{dates.map(date=><div key={date}><p className="text-xs font-semibold mb-2">{formatDate(date,true)}</p><div className="grid sm:grid-cols-2 gap-2">{options.filter(l=>l.date===date).map(l=>{const chosen=selected?.date===l.date&&selected.tutorId===l.tutorId&&selected.start===l.start;return <button key={`${l.tutorId}-${l.start}`} type="button" aria-pressed={chosen} onClick={()=>setSelected(l)} className={`text-left p-3 min-h-14 border rounded-lg text-xs ${chosen?'bg-ink text-white border-ink':'border-ink/20 hover:border-ink'}`}><strong>{formatTime(l.start)}–{formatTime(l.start+l.duration)} ET</strong><span className="block mt-1">{tutors.find(t=>t.id===l.tutorId)?.name}{chosen&&<Check size={12} className="inline ml-2"/>}</span></button>})}</div></div>)}</div>
  {selected&&<div role="status" className={`rounded-lg p-4 text-xs leading-6 ${selectedIssue?'bg-[#fff4ef] text-[#843c30]':'bg-[#edf3ed] text-[#35573d]'}`}>{selectedIssue||<><CheckCircle2 size={14} className="inline mr-2"/>Selected: {formatDate(selected.date)} · {formatTime(selected.start)} · {tutors.find(t=>t.id===selected.tutorId)?.name}</>}</div>}
  <button disabled={!selected||!!selectedIssue} className="btn w-full disabled:opacity-40">Save this available session<Check size={16}/></button>
 </form>
}
