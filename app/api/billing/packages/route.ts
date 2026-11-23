import {database} from '../../../../lib/server/db';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){
 try{
  const r=await database().query(`select id,name,description,credits,price_paise,currency from vachaspati_private.vachaspati_credit_packages
   where enabled=true order by price_paise asc`);
  return Response.json({packages:r.rows,checkout_available:!!process.env.RAZORPAY_KEY_ID&&!!process.env.RAZORPAY_KEY_SECRET&&!!process.env.RAZORPAY_WEBHOOK_SECRET},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Packages temporarily unavailable'},{status:503});}
}
