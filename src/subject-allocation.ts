export type SubjectShare={id:string;subject:string;hours:number};
export type StudentAllocation={id:string;name:string;hours:number;subjects:SubjectShare[]};
export type SubjectAllocation={id:string;childId:string;name:string;subject:string;hours:number};
export const subjectQueue=(students:StudentAllocation[]):SubjectAllocation[]=>students.flatMap(s=>s.subjects.map(a=>({...a,childId:s.id,name:s.name})));
export function allocationProblem(students:StudentAllocation[],capacity:number,limit:number):string {
 if(students.length>limit)return `This package allows up to ${limit} students.`;
 if(students.some(s=>!s.name.trim()))return 'Give each student a name.';
 if(students.some(s=>!Number.isInteger(s.hours)||s.hours<1||!s.subjects.length||s.subjects.some(a=>!a.subject||!Number.isInteger(a.hours)||a.hours<1)))return 'Choose whole-hour amounts and a subject for every allocation.';
 if(students.some(s=>s.subjects.reduce((n,a)=>n+a.hours,0)!==s.hours))return 'Each student’s subject hours must add up to their allocated hours.';
 if(students.reduce((n,s)=>n+s.hours,0)>capacity)return 'The allocations exceed your package hours.';
 return '';
}
