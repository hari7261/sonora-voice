import 'server-only';
import {createHash,randomBytes,scrypt as nodeScrypt,timingSafeEqual} from 'node:crypto';
import {cookies} from 'next/headers';
import {database} from './db';

export const SESSION_COOKIE = 'vachaspati_session';
const SESSION_DAYS = 7;
const SCRYPT_OPTIONS = {N: 32768,r: 8,p: 1,maxmem: 64 * 1024 * 1024};
const PREFIX = 'scrypt-v1';

function derive(password:string,salt:Buffer):Promise<Buffer>{
  return new Promise((resolve,reject)=>{
    nodeScrypt(password,salt,64,SCRYPT_OPTIONS,(err,key)=>err?reject(err):resolve(key));
  });
}
export function sha256(value:string):string{return createHash('sha256').update(value).digest('hex');}
export async function hashPassword(password:string):Promise<string>{
  const salt=randomBytes(16);
  const derived=await derive(password,salt);
  return [PREFIX,salt.toString('hex'),derived.toString('hex')].join('$');
}
export async function verifyPassword(password:string,stored:string):Promise<boolean>{
  const [version,saltHex,keyHex]=stored.split('$');
  if(version!==PREFIX||!saltHex||!keyHex)return false;
  const actual=await derive(password,Buffer.from(saltHex,'hex'));
  const expected=Buffer.from(keyHex,'hex');
  return actual.length===expected.length && timingSafeEqual(actual,expected);
}
export function emailAddress(value:unknown):string|null {
  if(typeof value!=='string')return null;
  const email=value.trim().toLowerCase();
  if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))return null;
  return email;
}
export function passwordAcceptable(value:unknown):value is string{
  return typeof value==='string'&&value.length>=12&&value.length<=128;
}
export function sessionCookieOptions(){
  return {httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict' as const,path:'/',maxAge:60*60*24*SESSION_DAYS};
}
export async function createSession(userId:string):Promise<string>{
  const token=randomBytes(32).toString('base64url');
  await database().query(
    'insert into vachaspati_private.vachaspati_sessions (user_id,token_hash,expires_at) values ($1,$2,now()+interval \'7 days\')',
    [userId,sha256(token)]);
  return token;
}
export type SessionUser={id:string;email:string;display_name:string};
export async function getSessionUser(token?:string):Promise<SessionUser|null>{
  if(!token||! /^[A-Za-z0-9_-]{43}$/.test(token))return null;
  const result=await database().query<SessionUser>(`
    select u.id,u.email,u.display_name
    from vachaspati_private.vachaspati_sessions s
    join vachaspati_private.vachaspati_users u on u.id=s.user_id
    where s.token_hash=$1 and s.revoked_at is null and s.expires_at>now()
      and u.disabled_at is null limit 1`,
    [sha256(token)]);
  return result.rows[0]??null;
}
export async function currentUser():Promise<SessionUser|null>{
  const token=(await cookies()).get(SESSION_COOKIE)?.value;
  return getSessionUser(token);
}
export async function revokeSession(token?:string):Promise<void>{
  if(!token)return;
  await database().query(
    'update vachaspati_private.vachaspati_sessions set revoked_at=now() where token_hash=$1 and revoked_at is null',
    [sha256(token)]);
}
export async function isLoginRateLimited(identifier:string):Promise<boolean>{
  const result=await database().query<{count:string}>(`
    select count(*)::text as count
    from vachaspati_private.vachaspati_login_attempts
    where identifier_hash=$1 and attempted_at>now()-interval '15 minutes'`,
    [sha256(identifier)]);
  return Number(result.rows[0]?.count??0)>=8;
}
export async function recordFailedLogin(identifier:string):Promise<void>{
  await database().query(
    'insert into vachaspati_private.vachaspati_login_attempts(identifier_hash) values($1)',
    [sha256(identifier)]);
}
