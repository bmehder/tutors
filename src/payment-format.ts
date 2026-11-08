export const cardDigits=(value:string)=>value.replace(/\D/g,'').slice(0,16);
export const formatCard=(value:string)=>cardDigits(value).replace(/(.{4})(?=.)/g,'$1 ');
export const formatExpiry=(value:string)=>{
 const digits=value.replace(/\D/g,'').slice(0,4);
 return digits.length>2?`${digits.slice(0,2)} / ${digits.slice(2)}`:digits;
};
export const formatSecurityCode=(value:string)=>value.replace(/\D/g,'').slice(0,3);
