import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';
export function razorpayConfigured(){
 return !!process.env.RAZORPAY_KEY_ID&&!!process.env.RAZORPAY_KEY_SECRET&&!!process.env.RAZORPAY_WEBHOOK_SECRET;
}
export async function createRazorpayOrder(amount:number,receipt:string){
 const key=process.env.RAZORPAY_KEY_ID,secret=process.env.RAZORPAY_KEY_SECRET;
 if(!key||!secret)throw new Error('PAYMENT_NOT_CONFIGURED');
 const auth=Buffer.from(key+':'+secret).toString('base64');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const r=await fetch('https://api.razorpay.com/v1/orders',{
   method:'POST',headers:{'Authorization':'Basic '+auth,'Content-Type':'application/json'},
   body:JSON.stringify({amount,currency:'INR',receipt,payment_capture:1}),signal:controller.signal,cache:'no-store'});
  if(!r.ok)throw new Error('RAZORPAY_ORDER_'+r.status);
  const body=await r.json() as {id?:string;amount?:number;currency?:string;status?:string};
  if(!body.id||body.amount!==amount||body.currency!=='INR')throw new Error('RAZORPAY_ORDER_INVALID');
  return {id:body.id,amount:body.amount,currency:body.currency};
 }finally{clearTimeout(timer);}
}
export function verifyWebhookSignature(raw:string,header:string){
 const secret=process.env.RAZORPAY_WEBHOOK_SECRET;
 if(!secret||!header||! /^[a-f0-9]{64}$/i.test(header))return false;
 const expected=createHmac('sha256',secret).update(raw).digest('hex');
 const a=Buffer.from(expected,'hex'),b=Buffer.from(header,'hex');
 return a.length===b.length&&timingSafeEqual(a,b);
}
