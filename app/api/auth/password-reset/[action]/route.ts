import {NextRequest} from 'next/server';
import {randomBytes} from 'node:crypto';
import {database} from '../../../../../lib/server/db';
import {emailAddress,hashPassword,isLoginRateLimited,passwordAcceptable,recordFailedLogin,sha256} from '../../../../../lib/server/credentials';
import {safeOrigin,readJson,apiError} from '../../../../../lib/server/platform';
import {sendPasswordResetEmail} from '../../../../../lib/server/mail';
export const runtime='nodejs';export const dynamic='force-dynamic';
type P={params:Promise<{action:string}>};
export async function POST(req:NextRequest,{params}:P){
 if(!safeOrigin(req))return apiError('Invalid origin',403);
 const action=(await params).action;
 if(action!=='request'&&action!=='confirm')return apiError('Not found',404);
 const body=await readJson(req,3000);if(!body)return apiError('Invalid input',400);
 if(action==='request'){
  const email=emailAddress(body.email);if(!email)return apiError('Valid email required',400);
  if(!process.env.RESEND_API_KEY||!process.env.MAIL_FROM||!process.env.APP_ORIGIN)
    return apiError('Password recovery is not configured',503);
  const rateKey='reset:'+email;
  try{
   if(await isLoginRateLimited(rateKey))return apiError('Please try again later',429);
   await recordFailedLogin(rateKey);
   const user=await database().query<{id:string}>(`select id from vachaspati_private.vachaspati_users where email=$1 and disabled_at is null limit 1`,[email]);
   if(user.rows[0]){
    const token=randomBytes(32).toString('base64url');
    await database().query(`insert into vachaspati_private.vachaspati_password_resets(user_id,token_hash,expires_at)
    values($1,$2,now()+interval '30 minutes')`,[user.rows[0].id,sha256(token)]);
    try{await sendPasswordResetEmail(email,token);}
    catch{return apiError('Password recovery email service unavailable',503);}
   }
   return Response.json({ok:true,message:'If an account exists, a reset email has been sent.'});
  }catch{return apiError('Password recovery unavailable',503);}
 }
 const token=typeof body.token==='string'?body.token:'';
 const password=body.password;
 if(!/^[A-Za-z0-9_-]{43}$/.test(token)||!passwordAcceptable(password))
    return apiError('Invalid token or password must be 12–128 characters',400);
 const hash=sha256(token);
 try{
  const digest=await hashPassword(password);
  const client=await database().connect();
  try{
   await client.query('begin');
   const found=await client.query<{id:string;user_id:string}>(`
     select id,user_id from vachaspati_private.vachaspati_password_resets
     where token_hash=$1 and used_at is null and expires_at>now() for update`,[hash]);
   if(!found.rows[0]){await client.query('rollback');return apiError('Reset link is invalid or expired',400);}
   await client.query(`update vachaspati_private.vachaspati_users set password_hash=$1,updated_at=now() where id=$2`,
    [digest,found.rows[0].user_id]);
   await client.query(`update vachaspati_private.vachaspati_password_resets set used_at=now() where id=$1`,[found.rows[0].id]);
   await client.query(`update vachaspati_private.vachaspati_sessions set revoked_at=now() where user_id=$1 and revoked_at is null`,[found.rows[0].user_id]);
   await client.query('commit');
   return Response.json({ok:true});
  }catch(e){await client.query('rollback');throw e;}finally{client.release();}
 }catch{return apiError('Password reset failed',503);}
}
