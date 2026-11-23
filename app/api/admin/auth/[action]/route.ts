import {NextRequest,NextResponse} from 'next/server';
import {database} from '../../../../../lib/server/db';
import {emailAddress,isLoginRateLimited,recordFailedLogin,sha256} from '../../../../../lib/server/credentials';
import {ADMIN_COOKIE,adminCookieOptions,adminFromSession,audit,decryptTotp,eligibleEnrollment,encryptTotp,mfaUrl,newMfaSecret,startAdminSession,verifyAdminPassword,verifyTotp} from '../../../../../lib/server/admin';
import {apiError,readJson,safeOrigin} from '../../../../../lib/server/platform';
export const runtime='nodejs';export const dynamic='force-dynamic';
const S='vachaspati_private';type P={params:Promise<{action:string}>};
export async function GET(req:NextRequest,{params}:P){
 if((await params).action!=='me')return apiError('Not found',404);
 try{const admin=await adminFromSession(req);return Response.json({authenticated:!!admin,admin},{headers:{'Cache-Control':'no-store'}});}
 catch{return apiError('Admin service unavailable',503);}
}
export async function POST(req:NextRequest,{params}:P){
 const action=(await params).action;if(!['login','logout','enroll','confirm'].includes(action))return apiError('Not found',404);
 if(!safeOrigin(req))return apiError('Invalid origin',403);
 if(action==='logout'){
  const token=req.cookies.get(ADMIN_COOKIE)?.value;
  try{if(token)await database().query(`update ${S}.vachaspati_admin_sessions set revoked_at=now() where token_hash=$1`,[sha256(token)]);
  const r=NextResponse.json({ok:true});r.cookies.set(ADMIN_COOKIE,'',{...adminCookieOptions(),maxAge:0});return r;
  }catch{return apiError('Unable to sign out',503);}
 }
 const body=await readJson(req,4000);if(!body)return apiError('Invalid request',400);
 try{
  if(action==='enroll'){
   const a=await eligibleEnrollment(req);if(!a)return apiError('Forbidden',403);
   const password=typeof body.password==='string'?body.password:'';
   if(!password)return apiError('Password confirmation required');
   const user=await verifyAdminPassword(a.email,password);
   if(!user||user.id!==a.user_id)return apiError('Invalid password',401);
   const prior=await database().query<{confirmed_at:string|null}>(`select confirmed_at from ${S}.vachaspati_admin_mfa where user_id=$1`,[a.user_id]);
   if(prior.rows[0]?.confirmed_at)return apiError('MFA is already enrolled',409);
   const secret=newMfaSecret();
   await database().query(`insert into ${S}.vachaspati_admin_mfa(user_id,secret_encrypted) values($1,$2)
    on conflict(user_id) do update set secret_encrypted=excluded.secret_encrypted,created_at=now(),last_counter=-1
    where ${S}.vachaspati_admin_mfa.confirmed_at is null`,[a.user_id,encryptTotp(secret)]);
   await audit(a.user_id,'mfa.enroll.started','admin',a.user_id);
   return Response.json({secret,otpauth:mfaUrl(a.email,secret),notice:'Keep this secret private. Add it to an authenticator app and enter its 6-digit code.'},{headers:{'Cache-Control':'no-store'}});
  }
  if(action==='confirm'){
   const a=await eligibleEnrollment(req);if(!a)return apiError('Forbidden',403);
   const code=typeof body.code==='string'?body.code:'';
   const r=await database().query<{secret_encrypted:string;last_counter:string;confirmed_at:string|null}>(`select secret_encrypted,last_counter::text,confirmed_at from ${S}.vachaspati_admin_mfa where user_id=$1`,[a.user_id]);
   const value=r.rows[0];if(!value||value.confirmed_at)return apiError('MFA enrollment is unavailable',409);
   const counter=verifyTotp(decryptTotp(value.secret_encrypted),code,Number(value.last_counter));
   if(counter===null)return apiError('Invalid authenticator code',401);
   const updated=await database().query(`update ${S}.vachaspati_admin_mfa set confirmed_at=now(),last_counter=$2
     where user_id=$1 and confirmed_at is null and last_counter<$2 returning user_id`,[a.user_id,counter]);
   if(!updated.rowCount)return apiError('Code already used',409);
   const token=await startAdminSession(a.user_id);
   await audit(a.user_id,'mfa.enroll.confirmed','admin',a.user_id);
   const response=NextResponse.json({ok:true});response.cookies.set(ADMIN_COOKIE,token,adminCookieOptions());return response;
  }
  const email=emailAddress(body.email),password=typeof body.password==='string'?body.password:'',code=typeof body.code==='string'?body.code:'';
  if(!email||!password||!/^\d{6}$/.test(code))return apiError('Email, password and 6-digit authenticator code required',400);
  const limit='admin-login:'+email;
  if(await isLoginRateLimited(limit))return apiError('Too many attempts',429);
  const user=await verifyAdminPassword(email,password);
  if(!user||!user.secret_encrypted||!user.confirmed_at){
   await recordFailedLogin(limit);return apiError('Invalid administrator credentials',401);
  }
  const counter=verifyTotp(decryptTotp(user.secret_encrypted),code,Number(user.last_counter));
  if(counter===null){await recordFailedLogin(limit);return apiError('Invalid administrator credentials',401);}
  const updated=await database().query(`update ${S}.vachaspati_admin_mfa set last_counter=$2
    where user_id=$1 and last_counter<$2 and confirmed_at is not null returning user_id`,[user.id,counter]);
  if(!updated.rowCount){await recordFailedLogin(limit);return apiError('Authenticator code already used',401);}
  const token=await startAdminSession(user.id);
  await audit(user.id,'admin.login','admin',user.id);
  const response=NextResponse.json({ok:true,role:user.role});
  response.cookies.set(ADMIN_COOKIE,token,adminCookieOptions());
  return response;
 }catch{return apiError('Administrator authentication unavailable',503);}
}
