import 'server-only';
import {createCipheriv,createDecipheriv,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {database} from './db';
import {getSessionUser,SESSION_COOKIE,sha256,verifyPassword} from './credentials';

const S='vachaspati_private';
export type AdminRole='superadmin'|'operations'|'support'|'finance'|'analyst';
export type Admin={user_id:string;role:AdminRole;email:string;display_name:string};
export const ADMIN_COOKIE='vachaspati_admin_session';
export const adminCookieOptions=()=>({httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict' as const,path:'/',maxAge:60*60*4});

function encKey():Buffer{
 const hex=process.env.ADMIN_MFA_ENCRYPTION_KEY;
 if(!hex||!/^[a-f0-9]{64}$/i.test(hex))throw new Error('ADMIN_MFA_ENCRYPTION_KEY must be 32 bytes hex');
 return Buffer.from(hex,'hex');
}
export function encryptTotp(secret:string):string{
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encKey(),iv);
 const encrypted=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
 return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');
}
export function decryptTotp(value:string):string{
 const [i,t,c]=value.split('.');if(!i||!t||!c)throw new Error('INVALID_MFA_SECRET');
 const decipher=createDecipheriv('aes-256-gcm',encKey(),Buffer.from(i,'base64url'));
 decipher.setAuthTag(Buffer.from(t,'base64url'));
 return Buffer.concat([decipher.update(Buffer.from(c,'base64url')),decipher.final()]).toString('utf8');
}
const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(buf:Buffer){
 let output='',acc=0,bits=0;
 for(const b of buf){acc=(acc<<8)|b;bits+=8;while(bits>=5){bits-=5;output+=ALPHABET[(acc>>>bits)&31];}}
 if(bits>0)output+=ALPHABET[(acc<<(5-bits))&31];
 return output;
}
function fromBase32(s:string){
 let acc=0,bits=0;const result:number[]=[];
 for(const char of s.toUpperCase()){const n=ALPHABET.indexOf(char);if(n<0)throw new Error('INVALID_BASE32');
  acc=(acc<<5)|n;bits+=5;if(bits>=8){bits-=8;result.push((acc>>>bits)&255);}}
 return Buffer.from(result);
}
export function newMfaSecret(){return base32(randomBytes(20));}
export function mfaUrl(email:string,secret:string){return 'otpauth://totp/'+encodeURIComponent('Vachaspati AI:'+email)+'?secret='+secret+'&issuer='+encodeURIComponent('Vachaspati AI')+'&algorithm=SHA1&digits=6&period=30';}
function totp(secret:string,counter:number){
 const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(counter));
 const h=createHmac('sha1',fromBase32(secret)).update(b).digest();
 const p=h[h.length-1]&15;
 return String((h.readUInt32BE(p)&0x7fffffff)%1_000_000).padStart(6,'0');
}
export function verifyTotp(secret:string,code:string,lastCounter:number):number|null{
 if(!/^\d{6}$/.test(code))return null;
 const counter=Math.floor(Date.now()/30_000);
 for(const offset of [-1,0,1]){
  const n=counter+offset;if(n<=lastCounter)continue;
  const a=Buffer.from(totp(secret,n)),b=Buffer.from(code);
  if(timingSafeEqual(a,b))return n;
 }
 return null;
}
export async function adminFromSession(req:NextRequest):Promise<Admin|null>{
 const token=req.cookies.get(ADMIN_COOKIE)?.value;
 if(!token||! /^[A-Za-z0-9_-]{43}$/.test(token))return null;
 const r=await database().query<Admin>(`
 select s.user_id,ar.role,u.email,u.display_name
 from ${S}.vachaspati_admin_sessions s
 join ${S}.vachaspati_admin_roles ar on ar.user_id=s.user_id and ar.active=true
 join ${S}.vachaspati_admin_mfa m on m.user_id=s.user_id and m.confirmed_at is not null
 join ${S}.vachaspati_users u on u.id=s.user_id and u.disabled_at is null
 where s.token_hash=$1 and s.revoked_at is null and s.expires_at>now() limit 1`,
 [sha256(token)]);
 return r.rows[0]??null;
}
export async function requireAdmin(req:NextRequest,roles:AdminRole[]):Promise<Admin|null>{
 const a=await adminFromSession(req);return a&&roles.includes(a.role)?a:null;
}
export async function eligibleEnrollment(req:NextRequest):Promise<Admin|null>{
 const user=await getSessionUser(req.cookies.get(SESSION_COOKIE)?.value);if(!user)return null;
 const roles=await database().query<{role:AdminRole}>(`
  select role from ${S}.vachaspati_admin_roles where user_id=$1 and active=true limit 1`,[user.id]);
 return roles.rows[0]?{...user,user_id:user.id,role:roles.rows[0].role}:null;
}
export async function verifyAdminPassword(email:string,password:string){
 const r=await database().query<{id:string;email:string;display_name:string;password_hash:string;disabled_at:string|null;role:AdminRole;secret_encrypted:string|null;confirmed_at:string|null;last_counter:string|null}>(`
 select u.id,u.email,u.display_name,u.password_hash,u.disabled_at,ar.role,m.secret_encrypted,m.confirmed_at,m.last_counter::text
 from ${S}.vachaspati_users u
 join ${S}.vachaspati_admin_roles ar on ar.user_id=u.id and ar.active=true
 left join ${S}.vachaspati_admin_mfa m on m.user_id=u.id
 where u.email=$1 limit 1`,[email]);
 const user=r.rows[0];
 if(!user||user.disabled_at||!await verifyPassword(password,user.password_hash))return null;
 return user;
}
export async function startAdminSession(id:string){
 const token=randomBytes(32).toString('base64url');
 await database().query(`insert into ${S}.vachaspati_admin_sessions(user_id,token_hash,expires_at)
  values($1,$2,now()+interval '4 hours')`,[id,sha256(token)]);
 return token;
}
export async function audit(actor:string,action:string,target_type:string,target_id:string|null,details:object={}){
 await database().query(`insert into ${S}.vachaspati_admin_audit(actor_id,action,target_type,target_id,details) values($1,$2,$3,$4,$5::jsonb)`,
  [actor,action,target_type,target_id,JSON.stringify(details)]);
}
export async function flag(name:string,fallback=false){
 const r=await database().query<{value:boolean}>(`select value from ${S}.vachaspati_platform_settings where key=$1`,[name]);
 return typeof r.rows[0]?.value==='boolean'?r.rows[0].value:fallback;
}
