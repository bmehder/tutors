import {formatCard,formatExpiry,formatSecurityCode} from './payment-format';
import {useState} from 'react';
import {money} from './tutoring-data';
type Props={total:number;onPay:()=>void;onBack:()=>void};
export default function MockPayment({total,onPay,onBack}:Props){
 const [card,setCard]=useState('');const [expiry,setExpiry]=useState('');const [cvc,setCvc]=useState('');const [billing,setBilling]=useState('');const [postal,setPostal]=useState('');
 const [error,setError]=useState('');const [processing,setProcessing]=useState(false);
 async function pay(e:React.FormEvent){e.preventDefault();if(processing)return;
  if(card.replace(/\s/g,'')!=='4242424242424242'){setError('For this demo, use card number 4242 4242 4242 4242.');return}
  const match=/^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry);const now=new Date();
  if(!match||Number(match[1])<1||Number(match[1])>12||2000+Number(match[2])<now.getFullYear()||(2000+Number(match[2])===now.getFullYear()&&Number(match[1])<now.getMonth()+1)){setError('Enter a future expiry date as MM / YY.');return}
  if(!/^\d{3}$/.test(cvc)||!billing.trim()||!postal.trim()){setError('Add the name, a three-digit security code, and a postal code.');return}
  setError('');setProcessing(true);await new Promise(resolve=>setTimeout(resolve,800));onPay();
 }
 return <form onSubmit={pay} className="space-y-5" aria-busy={processing}>
 <div><p className="eyebrow text-ink/55">Demo checkout · Payment</p><h3 className="text-2xl font-semibold mt-2">Pay for your family’s package.</h3><p className="text-sm leading-6 text-ink/65 mt-3">Local preview only. No payment provider is connected and nothing is charged or sent.</p></div>
 <div className="rounded-lg bg-[#edf3ed] p-4 text-xs leading-6">Use sample card <strong>4242 4242 4242 4242</strong>, a future expiry, and any three-digit security code. Use fictional billing details.</div>
 <fieldset disabled={processing} className="space-y-5"><legend className="text-sm font-semibold mb-4">Card details</legend>
 <label className="planner-label block">Card number<input className="field mt-2" required inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" maxLength={19} value={card} onChange={e=>setCard(formatCard(e.target.value))}/></label>
 <div className="grid grid-cols-2 gap-4"><label className="planner-label block">Expiry date<input className="field mt-2" required inputMode="numeric" autoComplete="off" placeholder="MM / YY" maxLength={7} value={expiry} onChange={e=>setExpiry(formatExpiry(e.target.value))}/></label><label className="planner-label block">Security code<input className="field mt-2" required inputMode="numeric" autoComplete="off" placeholder="123" maxLength={3} value={cvc} onChange={e=>setCvc(formatSecurityCode(e.target.value))}/></label></div>
 <label className="planner-label block">Name on card<input className="field mt-2" required autoComplete="off" placeholder="Sample Parent" value={billing} onChange={e=>setBilling(e.target.value)}/></label>
 <label className="planner-label block">Billing ZIP / postal code<input className="field mt-2" required autoComplete="off" placeholder="12345" value={postal} onChange={e=>setPostal(e.target.value)}/></label>
 </fieldset>
 {error&&<p role="alert" className="text-sm leading-6 text-[#843c30]">{error}</p>}
 <button disabled={processing} className="btn w-full disabled:opacity-60">{processing?'Processing demo payment…':`Pay ${money(total)}`}</button>
 <p className="text-xs leading-5 text-ink/60" role="status">{processing?'Please wait while we complete your sample order.':'Demo payment only. Use sample details, never a real card.'}</p>
 <button disabled={processing} type="button" className="text-xs underline underline-offset-4 min-h-11" onClick={onBack}>Back to contact details</button>
 </form>
}
