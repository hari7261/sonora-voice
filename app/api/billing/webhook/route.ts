import {NextRequest} from 'next/server';
import {database} from '../../../../lib/server/db';
import {verifyWebhookSignature} from '../../../../lib/server/razorpay';
export const runtime='nodejs';export const dynamic='force-dynamic';
const S='vachaspati_private';
type Payment={id?:string;order_id?:string;amount?:number;currency?:string;status?:string;captured?:boolean};
type Webhook={event?:string;payload?:{payment?:{entity?:Payment};order?:{entity?:{id?:string;amount?:number;currency?:string}}}};
export async function POST(req:NextRequest){
 if(Number(req.headers.get('content-length')||0)>256_000)return Response.json({error:'Request too large'},{status:413});
 const raw=await req.text();
 if(raw.length>256_000)return Response.json({error:'Request too large'},{status:413});
 const signature=req.headers.get('x-razorpay-signature')||'';
 if(!verifyWebhookSignature(raw,signature))return Response.json({error:'Invalid signature'},{status:401});
 const eventId=req.headers.get('x-razorpay-event-id')||'';
 if(!/^[A-Za-z0-9_-]{6,120}$/.test(eventId))return Response.json({error:'Missing event ID'},{status:400});
 let payload:Webhook;try{payload=JSON.parse(raw)}catch{return Response.json({error:'Invalid JSON'},{status:400});}
 const event=payload.event||'';
 const payment=payload.payload?.payment?.entity;
 const client=await database().connect();
 try{
  await client.query('begin');
  // Store webhook IDs under a database unique constraint for exact-once credit issuance.
  const inserted=await client.query(`insert into ${S}.vachaspati_payment_events(provider,event_id,event_type)
     values('razorpay',$1,$2) on conflict(event_id) do nothing returning id`,[eventId,event]);
  if(!inserted.rowCount){await client.query('commit');return Response.json({ok:true,duplicate:true});}
  if(event==='payment.captured'&&payment?.id&&payment.order_id&&payment.status==='captured'&&payment.captured===true){
   const order=await client.query<{id:string;account_id:string;credits:string;amount_paise:string;currency:string;status:string}>(`
    select id,account_id,credits::text,amount_paise::text,currency,status from ${S}.vachaspati_payment_orders
    where provider='razorpay' and provider_order_id=$1 for update`,[payment.order_id]);
   const o=order.rows[0];
   if(o&&o.status!=='paid'&&Number(o.amount_paise)===payment.amount&&o.currency===payment.currency){
    await client.query(`update ${S}.vachaspati_payment_orders
     set status='paid',provider_payment_id=$2,paid_at=now() where id=$1`,[o.id,payment.id]);
    await client.query(`update ${S}.vachaspati_accounts set wallet_credits=wallet_credits+$2 where id=$1`,[o.account_id,o.credits]);
    await client.query(`insert into ${S}.vachaspati_credit_ledger(account_id,delta,wallet_delta,reason,request_id)
     values($1,$2,$2,'payment_purchase',$3)`,[o.account_id,o.credits,'payment:'+o.id]);
    await client.query(`update ${S}.vachaspati_payment_events set order_id=$2 where event_id=$1`,[eventId,o.id]);
   }
  }else if(event==='payment.failed'&&payment?.order_id){
   await client.query(`update ${S}.vachaspati_payment_orders set status='failed'
    where provider_order_id=$1 and status in ('pending','created')`,[payment.order_id]);
  }else if(event.startsWith('refund.')){
   // Refund accounting must be reconciled against prepaid credit consumption; never silently grant or subtract credits.
   await client.query(`insert into ${S}.vachaspati_service_incidents(title,details,severity)
    values('Razorpay refund review',$1,'high')`,[JSON.stringify({event_id:eventId,type:event}).slice(0,1500)]);
  }
  await client.query('commit');
  return Response.json({ok:true});
 }catch(e){await client.query('rollback');return Response.json({error:'Webhook processing failed'},{status:503});}
 finally{client.release();}
}
