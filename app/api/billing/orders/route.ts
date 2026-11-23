import {NextRequest} from 'next/server';
import {database} from '../../../../lib/server/db';
import {apiError,readJson,safeOrigin,userWorkspace,validUuid} from '../../../../lib/server/platform';
import {createRazorpayOrder,razorpayConfigured} from '../../../../lib/server/razorpay';
export const runtime='nodejs';export const dynamic='force-dynamic';
const S='vachaspati_private';
export async function GET(req:NextRequest){
 try{
  const who=await userWorkspace(req);if(!who)return apiError('Unauthorized',401);
  const r=await database().query(`select id,package_id,credits,amount_paise,currency,status,created_at,paid_at
   from ${S}.vachaspati_payment_orders where account_id=$1 order by created_at desc limit 30`,[who.account_id]);
  return Response.json({orders:r.rows},{headers:{'Cache-Control':'no-store'}});
 }catch{return apiError('Payment records unavailable',503);}
}
export async function POST(req:NextRequest){
 if(!safeOrigin(req))return apiError('Invalid origin',403);
 if(!razorpayConfigured())return apiError('Payment provider is not configured',503);
 const b=await readJson(req,2000);
 if(!validUuid(b?.package_id))return apiError('Valid credit package required',400);
 try{
  const who=await userWorkspace(req,['owner','admin']);if(!who)return apiError('Unauthorized',401);
  const packageResult=await database().query<{id:string;credits:string;price_paise:string;currency:string}>(`select id,credits::text,price_paise::text,currency from ${S}.vachaspati_credit_packages where id=$1 and enabled=true`,[b.package_id]);
  const pkg=packageResult.rows[0];if(!pkg)return apiError('Package unavailable',404);
  const recent=await database().query<{count:string}>(`select count(*)::text as count from ${S}.vachaspati_payment_orders where account_id=$1 and created_at>now()-interval '1 hour'`,[who.account_id]);
  if(Number(recent.rows[0]?.count||0)>=10)return apiError('Too many new payment orders',429);
  const local=await database().query<{id:string}>(`insert into ${S}.vachaspati_payment_orders(account_id,user_id,package_id,credits,amount_paise,currency,provider)
     values($1,$2,$3,$4,$5,$6,'razorpay') returning id`,[who.account_id,who.user_id,pkg.id,pkg.credits,pkg.price_paise,pkg.currency]);
  const id=local.rows[0].id;
  try{
   const remote=await createRazorpayOrder(Number(pkg.price_paise),id);
   await database().query(`update ${S}.vachaspati_payment_orders set provider_order_id=$2,status='created' where id=$1`,[id,remote.id]);
   return Response.json({order_id:remote.id,local_order_id:id,key_id:process.env.RAZORPAY_KEY_ID,amount:remote.amount,currency:remote.currency},{status:201,headers:{'Cache-Control':'no-store'}});
  }catch(e){
   await database().query(`update ${S}.vachaspati_payment_orders set status='failed' where id=$1 and status='pending'`,[id]);
   return apiError('Unable to initialize checkout',503);
  }
 }catch{return apiError('Payment creation unavailable',503);}
}
