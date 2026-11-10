// US/Canada contact numbers; accept a pasted +1 country prefix.
export function formatPhone(value:string):string {
 let digits=value.replace(/\D/g,'');
 if(digits.length===11&&digits.startsWith('1'))digits=digits.slice(1);
 digits=digits.slice(0,10);
 if(digits.length<=3)return digits;
 if(digits.length<=6)return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
 return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
}

// Leave explicit international numbers intact while applying the domestic mask.
export function formatCheckoutPhone(value: string): string {
 const digits = value.replace(/\D/g, '');
 if (value.trimStart().startsWith('+') && !(digits.length === 11 && digits.startsWith('1'))) {
  return value;
 }
 return formatPhone(value);
}
