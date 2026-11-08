import {addDays,isCustomized,type Lesson} from './family-planner-model.ts';
export type Session = {kind:'default';original:Lesson}|{kind:'customized';original:Lesson;replacement:Lesson};
export type TutoringPlan = {kind:'oneLesson';session:Lesson}|{kind:'weekly';first:Lesson;sessions:Session[]};
export const actualLessons=(plan:TutoringPlan):Lesson[]=>plan.kind==='oneLesson'?[plan.session]:plan.sessions.map(s=>s.kind==='default'?s.original:s.replacement);
export const defaultFor=(plan:TutoringPlan,id:string):Lesson=>plan.kind==='oneLesson'?plan.session:(plan.sessions.find(s=>s.original.id===id)?.original||plan.first);
export function weeklyPlan(first:Lesson,actual:Lesson[],previous?:TutoringPlan):TutoringPlan {
 return {kind:'weekly',first,sessions:actual.map((l,i)=>{
  const old=previous?.kind==='weekly'?previous.sessions.find(s=>s.original.id===l.id)?.original:undefined;
  const original=old&&!isCustomized(first,previous!.kind==='weekly'?previous!.first:first)?old:{...first,id:l.id,date:addDays(first.date,i*7)};
  return isCustomized(l,original)?{kind:'customized',original,replacement:l}:{kind:'default',original};
 })};
}
export function customizePlan(plan:TutoringPlan,session:Lesson):TutoringPlan {
 if(plan.kind==='oneLesson')return plan.session.id===session.id?{...plan,session}:plan;
 return {...plan,sessions:plan.sessions.map(s=>s.original.id!==session.id?s:isCustomized(session,s.original)?{kind:'customized',original:s.original,replacement:session}:{kind:'default',original:s.original})};
}
