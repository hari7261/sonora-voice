import {NextRequest} from 'next/server';
import {database} from '../../../../../lib/server/db';
import {emailAddress,isLoginRateLimited,recordFailedLogin,sha256,verifyPassword} from '../../../../../lib/server/credentials';
import {apiError,readJson,safeOrigin} from '../../../../../lib/server/platform';
import {sendVerification} from '../../../../../lib/server/email-verification';
export const runtime='nodejs';export const dynamic='force-dynamic';
const S='vachaspati_private';type P={params:Promise<{action:string}>};
export async function POST(req:NextRequest,{params}:P){
 const action=(await params).action;if(!['request','confirm'].includes(action))return apiError('Not found',404);
 if(!safeOrigin(req))return apiError('Invalid origin',403);
 const b=await readJson(req,3000);if(!b)return apiError('Invalid request');
 try{
  if(action==='request'){
   const email=emailAddress(b.email),password=typeof b.password==='string'?b.password:'';
   if(!email||!password)return apiError('Email and password are required');
   if(!process.env.RESEND_API_KEY||!process.env.MAIL_FROM)return apiError('Email verification provider is unavailable',503);
   const key='email-verify:'+email;
   if(await isLoginRateLimited(key))return apiError('Too many email requests',429);
   await recordFailedLogin(key);
   const r=await database().query<{id:string;password_hash:string;email_verified_at:string|null}>(`
    select id,password_hash,email_verified_at from ${S}.vachaspati_users where email=$1 and disabled_at is null`,[email]);
   const user=r.rows[0];
   if(user&&await verifyPassword(password,user.password_hash)&&!user.email_verified_at)
    await sendVerification(email,user.id);
   return Response.json({ok:true,message:'If the account is eligible, a verification email has been sent.'},{headers:{'Cache-Control':'no-store'}});
  }
  const token=typeof b.token==='string'?b.token:'';
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))return apiError('Invalid verification token',400);
  const client=await database().connect();
  try{
   await client.query('begin');
   const r=await client.query<{id:string;user_id:string}>(`
    select id,user_id from ${S}.vachaspati_email_verifications where token_hash=$1
     and used_at is null and expires_at>now() for update`,[sha256(token)]);
   if(!r.rows[0]){await client.query('rollback');return apiError('Verification token is invalid or expired',400);}
   const userId=r.rows[0].user_id;
   await client.query(`update ${S}.vachaspati_users set email_verified_at=coalesce(email_verified_at,now()),updated_at=now() where id=$1`,[userId]);
   await client.query(`update ${S}.vachaspati_email_verifications set used_at=now() where user_id=$1 and used_at is null`,[userId]);
   await client.query('commit');
   return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  }catch(e){await client.query('rollback');throw e;}finally{client.release();}
 }catch{return apiError('Verification service unavailable',503);}
}
