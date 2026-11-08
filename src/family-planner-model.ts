export type Child = { id: string; name: string; color: number };
export type Lesson = {
  id: string; childId: string; tutorId: string; subject: string;
  date: string; start: number; duration: number;
};
export type Tutor = {
  id: string; name: string; subjects: string[]; min: number; max: number;
  days: number[]; times: string[];
};
export const HOUR = 60;
export const SUBJECTS = ['Biology', 'Chemistry', 'Algebra 1', 'Geometry', 'American Literature', 'Intermediate Composition', 'United States History', 'World History', 'Physics', 'Precalculus', 'Algebra 2', 'Elementary Math', 'Reading', 'Spanish 1', 'Spanish 2'];
export function todayEastern(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function nextSchoolDay(today = todayEastern()): string {
  let date = addDays(today, 1);
  while ([0,6].includes(new Date(`${date}T12:00:00Z`).getUTCDay())) date = addDays(date, 1);
  return date;
}
export function formatDate(date: string, long = false): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', weekday: long ? 'long' : 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`));
}
export function parseTime(time: string): number {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(time);
  if (!match) throw new Error('Invalid session time');
  return Number(match[1]) % 12 * 60 + Number(match[2]) + (match[3] === 'PM' ? 720 : 0);
}
export function formatTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}
export function overlaps(a: Pick<Lesson,'date'|'start'|'duration'>, b: Pick<Lesson,'date'|'start'|'duration'>): boolean {
  return a.date === b.date && a.start < b.start + b.duration && b.start < a.start + a.duration;
}
export function conflictReason(candidate: Lesson, existing: Lesson[], ignoreId?: string): string {
  const overlapping = existing.filter(l => l.id !== ignoreId && overlaps(candidate, l));
  if (overlapping.some(l => l.childId === candidate.childId)) return 'This child already has a session at this time.';
  if (overlapping.some(l => l.tutorId === candidate.tutorId)) return 'This tutor is already booked at this time.';
  return '';
}
export function supports(tutor: Tutor, child: Child, subject: string): boolean {
  return tutor.subjects.includes(subject);
}
export function isSoldOut(tutorId: string, date: string, start: number): boolean {
  const hash = [...`${tutorId}:${date}:${start}`].reduce((value, char) => ((value * 31 + char.charCodeAt(0)) >>> 0), 0);
  return hash % 7 === 0;
}
export function availabilityReason(candidate: Lesson, tutor: Tutor | undefined, child: Child | undefined, existing: Lesson[], ignoreId?: string, today = todayEastern()): string {
  if (!child) return 'Choose a child first.';
  if (!tutor) return 'Choose a tutor and time.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate.date) || !Number.isFinite(new Date(`${candidate.date}T12:00:00Z`).getTime()) || new Date(`${candidate.date}T12:00:00Z`).toISOString().slice(0,10)!==candidate.date) return 'Choose a valid date.';
  if (candidate.date <= today) return 'Choose a future date.';
  if(today===todayEastern()){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
    const nowMinutes=Number(parts.find(p=>p.type==='hour')!.value)*60+Number(parts.find(p=>p.type==='minute')!.value);
    const days=(Date.parse(`${candidate.date}T12:00:00Z`)-Date.parse(`${today}T12:00:00Z`))/86400000;
    if(days*1440+candidate.start-nowMinutes<1440)return 'This start is inside the demo 24-hour booking notice.';
  }
  if (!supports(tutor, child, candidate.subject)) return 'This tutor does not teach this subject for this subject.';
  const weekday = (new Date(`${candidate.date}T12:00:00Z`).getUTCDay() + 6) % 7;
  if (!tutor.days.includes(weekday) || !tutor.times.some(time => parseTime(time) === candidate.start)) return 'This tutor is not available at this time.';
  if(candidate.start+candidate.duration>Math.max(...tutor.times.map(parseTime))+60)return 'The full session does not fit this tutor’s availability.';
  const conflict = conflictReason(candidate, existing, ignoreId);
  if (conflict) return conflict;
  if (isSoldOut(tutor.id, candidate.date, candidate.start)) return 'This time is sold out.';
  return '';
}
export function plannedHours(sessions: Lesson[]): number {
  return sessions.reduce((hours,l) => hours + l.duration / HOUR, 0);
}
export function validatePlan(plan: Lesson[], booked: Lesson[], children: Child[], tutors: Tutor[], capacity: number, today = todayEastern()): string {
  if (!plan.length) return 'Add at least one session to your family plan.';
  if (plannedHours(plan) > capacity) return 'Your plan has more sessions than your package can cover.';
  for (let i = 0; i < plan.length; i++) {
    const session = plan[i];
    if (![30,45,60,90].includes(session.duration) || !session.id || !session.childId) return 'Check the session details.';
    const reason = availabilityReason(session, tutors.find(t => t.id === session.tutorId), children.find(c => c.id === session.childId), [...booked,...plan.slice(0,i)], undefined, today);
    if (reason) return `${formatDate(session.date)} at ${formatTime(session.start)}: ${reason}`;
  }
  return '';
}
export function packagePrice(hours: number, rate: number, welcome = false) {
  const subtotal = hours * rate;
  const savings = welcome ? Math.round(subtotal * .2 * 100) / 100 : 0;
  return {subtotal,savings,total:subtotal-savings};
}
export function describeConflict(candidate: Lesson, existing: Lesson[], children: Child[], tutors: Tutor[], ignoreId?: string): string {
  const matches = existing.filter(l => l.id !== ignoreId && overlaps(candidate,l));
  const childMatch = matches.find(l => l.childId === candidate.childId);
  const tutorMatch = matches.find(l => l.tutorId === candidate.tutorId);
  const match = childMatch || tutorMatch;
  if (!match) return '';
  const child = children.find(c=>c.id===match.childId)?.name || 'Another child';
  const tutor = tutors.find(t=>t.id===match.tutorId)?.name || 'This tutor';
  const when = `${formatTime(match.start)}–${formatTime(match.start+match.duration)} ET on ${formatDate(match.date)}`;
  return childMatch ? `${child} already has ${match.subject} with ${tutor}, ${when}. Choose a different time.` : `${tutor} is teaching ${child} ${match.subject}, ${when}. Choose another tutor or time.`;
}

export function studentLimit(hours:number):number { return hours===5?1:hours===10?3:hours===20?5:0; }
export function validateAllocations(allocations:{childId:string;hours:number}[],capacity:number):string {
  if(allocations.some(a=>!Number.isFinite(a.hours)||a.hours<=0))return 'Choose a positive amount of tutoring time.';
  if(new Set(allocations.map(a=>a.childId)).size!==allocations.length)return 'Each student should appear once.';
  if(allocations.length>studentLimit(capacity))return `This package allows up to ${studentLimit(capacity)} ${studentLimit(capacity)===1?'student':'students'}.`;
  if(allocations.reduce((sum,a)=>sum+a.hours,0)>capacity)return 'The assigned hours exceed the package balance.';
  return '';
}
export function weeklySeries(first:Lesson,count:number):Lesson[] {
  return Array.from({length:count},(_,i)=>({...first,id:`${first.id}-${i}`,date:addDays(first.date,i*7)}));
}
export function availableWeeklySeries(first:Lesson,count:number,tutor:Tutor,child:Child,existing:Lesson[],today=todayEastern()):Lesson[] {
  const result:Lesson[]=[];
  for(let week=0;week<52&&result.length<count;week++){
    const candidate={...first,id:`${first.id}-${week}`,date:addDays(first.date,week*7)};
    if(candidate.date>addDays(today,365))break;
    if(!availabilityReason(candidate,tutor,child,[...existing,...result],undefined,today))result.push(candidate);
  }
  return result;
}

export function availableAlternatives(original:Lesson,child:Child,tutors:Tutor[],existing:Lesson[],from:string,days=14,filters:{tutorId?:string;weekday?:number;start?:number}={},today=todayEastern()):Lesson[]{
 const result:Lesson[]=[];
 for(let i=0;i<days;i++){
  const date=addDays(from,i);
  if(date<=today||date>addDays(today,365))continue;
  if(filters.weekday!==undefined&&(new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7!==filters.weekday)continue;
  for(const tutor of tutors){
   if(filters.tutorId&&tutor.id!==filters.tutorId)continue;
   for(const time of tutor.times){const start=parseTime(time);if(filters.start!==undefined&&start!==filters.start)continue;
    const candidate={...original,date,tutorId:tutor.id,start};
    if(!availabilityReason(candidate,tutor,child,existing,original.id,today))result.push(candidate);
   }
  }
 }
 return result.sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start||a.tutorId.localeCompare(b.tutorId));
}

export function isCustomized(session:Lesson,standard:Lesson):boolean {
 return session.date!==standard.date||session.start!==standard.start||session.tutorId!==standard.tutorId||session.subject!==standard.subject||session.duration!==standard.duration;
}
export function validateCompleteFamily(allocations:{childId:string;hours:number}[],plan:Lesson[],capacity:number):string {
 const issue=validateAllocations(allocations,capacity);if(issue)return issue;
 const assigned=allocations.reduce((n,a)=>n+a.hours,0);
 if(assigned!==capacity)return `Assign all ${capacity} package hours before checkout. ${capacity-assigned} hours still need a student and routine.`;
 if(allocations.some(a=>plan.filter(l=>l.childId===a.childId).length!==a.hours)||plannedHours(plan)!==capacity)return 'Every assigned hour needs a scheduled session before checkout.';
 return '';
}
