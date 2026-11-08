export type SubjectShare={id:string;subject:string;hours:number};
export type StudentAllocation={id:string;name:string;hours:number;subjects:SubjectShare[]};
export type SubjectAllocation={id:string;childId:string;name:string;subject:string;hours:number};
export const subjectQueue=(students:StudentAllocation[]):SubjectAllocation[]=>students.flatMap(s=>s.subjects.map(a=>({...a,childId:s.id,name:s.name})));
export function allocationProblem(students:StudentAllocation[],capacity:number,limit:number):string {
 if(students.length>limit)return `This package allows up to ${limit} students.`;
 if(students.some(s=>new Set(s.subjects.filter(a=>a.subject).map(a=>a.subject)).size!==s.subjects.filter(a=>a.subject).length))return 'Choose each subject only once per student.';
 if(students.some(s=>!s.name.trim()))return 'Give each student a name.';
 if(students.some(s=>!Number.isInteger(s.hours)||s.hours<1||!s.subjects.length||s.subjects.some(a=>!a.subject||!Number.isInteger(a.hours)||a.hours<1)))return 'Choose whole-hour amounts and a subject for every allocation.';
 if(students.some(s=>s.subjects.reduce((n,a)=>n+a.hours,0)!==s.hours))return 'Each student’s subject hours must add up to their allocated hours.';
 if(students.reduce((n,s)=>n+s.hours,0)>capacity)return 'The allocations exceed your package hours.';
 return '';
}

export function balanceSubjectHours(student:StudentAllocation,shareId:string,hours:number):StudentAllocation {
 const others=student.subjects.filter(s=>s.id!==shareId);
 const selected=others.length?Math.min(hours,student.hours-others.length):hours;
 let remaining=student.hours-selected;
 const balanced=new Map<string,number>();
 others.forEach((share,index)=>{
  const value=index===others.length-1?remaining:Math.min(share.hours,remaining-(others.length-index-1));
  balanced.set(share.id,value);remaining-=value;
 });
 return {...student,subjects:student.subjects.map(s=>({...s,hours:s.id===shareId?selected:balanced.get(s.id)!}))};
}

export function initialAllocations(capacity:number,count:number):StudentAllocation[] {
 return Array.from({length:count},(_,i)=>{
  const hours=Math.floor(capacity/count)+(i<capacity%count?1:0);
  return {id:crypto.randomUUID(),name:'',hours,subjects:[{id:crypto.randomUUID(),subject:'',hours}]};
 });
}

export function removeSubject(student:StudentAllocation,shareId:string):StudentAllocation {

 const removed=student.subjects.find(s=>s.id===shareId);
 if(!removed)return student;
 const remaining=student.subjects.filter(s=>s.id!==shareId);
 return {...student,subjects:remaining.map((s,i)=>i===0?{...s,hours:s.hours+removed.hours}:s)};
}
