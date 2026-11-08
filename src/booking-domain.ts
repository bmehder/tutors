import {addDays,studentLimit,validatePlan,type Child,type Lesson,type Tutor} from './family-planner-model.ts';
import {allocationProblem,type StudentAllocation} from './subject-allocation.ts';

export type Package = {kind:'fiveHours'}|{kind:'tenHours'}|{kind:'twentyHours'};
export const packageHours=(p:Package):5|10|20=>p.kind==='fiveHours'?5:p.kind==='tenHours'?10:20;
export type Result<T>={kind:'ok';value:T}|{kind:'error';message:string};
export type RoutineInput={id:string;studentId:string;subject:string;tutorId:string;firstDate:string;start:number;count:number};
export type ContactInput={name:string;email:string};
export type BookingDraft={kind:'draft';package:Package;students:StudentAllocation[];routines:RoutineInput[]};
const confirmedBrand:unique symbol=Symbol('confirmedOrder');
export type ConfirmedOrder=Readonly<{kind:'confirmed';[confirmedBrand]:true;package:Readonly<Package>;contact:Readonly<ContactInput>;students:readonly Readonly<{id:string;name:string}>[];sessions:readonly Readonly<Lesson>[]}>;
export const newDraft=(p:Package):BookingDraft=>({kind:'draft',package:p,students:[],routines:[]});
export const changePackage=(p:Package,draft:BookingDraft):BookingDraft=>p.kind===draft.package.kind?draft:newDraft(p);

// The only constructor of a confirmed order. Copy and freeze validated data so
// later form edits cannot mutate the accepted order through shared references.
export function confirmOrder(draft:BookingDraft,contact:ContactInput,tutors:Tutor[]):Result<ConfirmedOrder>{
 const fail=(message:string):Result<ConfirmedOrder>=>({kind:'error',message});
 if(!['fiveHours','tenHours','twentyHours'].includes(draft.package.kind))return fail('Choose a supported package.');
 if(new Set(tutors.map(t=>t.id)).size!==tutors.length)return fail('Tutor identifiers must be unique.');
 const capacity=packageHours(draft.package);
 const issue=allocationProblem(draft.students,capacity,studentLimit(capacity));
 if(issue)return fail(issue);
 if(!draft.students.length)return fail('Add a student.');
 if(!contact.name.trim()||!/^\S+@\S+\.\S+$/.test(contact.email.trim()))return fail('Enter a contact name and valid email.');
 if(new Set(draft.students.map(s=>s.id)).size!==draft.students.length)return fail('Student identifiers must be unique.');
 const shares=draft.students.flatMap(s=>s.subjects.map(a=>({...a,studentId:s.id})));
 if(new Set(shares.map(s=>s.id)).size!==shares.length)return fail('Subject allocation identifiers must be unique.');
 if(draft.routines.length!==shares.length||new Set(draft.routines.map(r=>r.id)).size!==shares.length)return fail('Choose one weekly routine for each subject.');
 const sessions:Lesson[]=[];
 for(const routine of draft.routines){
  const share=shares.find(s=>s.id===routine.id);
  if(!share||share.studentId!==routine.studentId||share.subject!==routine.subject||share.hours!==routine.count)return fail('The weekly routine must match its student and subject allocation.');
  if(!routine.tutorId||!Number.isInteger(routine.count)||routine.count<1||!Number.isInteger(routine.start)||routine.start<0||routine.start>=1440||routine.start%15!==0)return fail('Choose a tutor, quarter-hour time, and positive session count.');
  const parsed=new Date(`${routine.firstDate}T12:00:00Z`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(routine.firstDate)||Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==routine.firstDate)return fail('Choose a valid first date.');
  for(let i=0;i<routine.count;i++)sessions.push({id:`${routine.id}-${i}`,childId:routine.studentId,subject:routine.subject,tutorId:routine.tutorId,date:addDays(routine.firstDate,i*7),start:routine.start,duration:60});
 }
 const children:Child[]=draft.students.map((s,i)=>({id:s.id,name:s.name.trim(),color:i}));
 const scheduleIssue=validatePlan(sessions,[],children,tutors,capacity);
 if(scheduleIssue)return fail(scheduleIssue);
 return {kind:'ok',value:Object.freeze({kind:'confirmed', [confirmedBrand]:true as const,package:Object.freeze({...draft.package}),contact:Object.freeze({name:contact.name.trim(),email:contact.email.trim()}),students:Object.freeze(children.map(c=>Object.freeze({id:c.id,name:c.name}))),sessions:Object.freeze(sessions.map(s=>Object.freeze({...s})))})};
}
