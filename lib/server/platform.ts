import 'server-only';
import {createHash,randomBytes} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {database} from './db';
import {getSessionUser,SESSION_COOKIE,sha256} from './credentials';

const S='vachaspati_private';
export type Workspace={account_id:string;role:string;user_id:string};
export function apiError(error:string,status=400){return Response.json({error},{status,headers:{'Cache-Control':'no-store'}});}
export function safeOrigin(req:NextRequest){
  const origin=req.headers.get('origin');
  if(!origin)return false;
  try{
    const supplied=new URL(origin);
    const own=new URL(req.url);
    return (supplied.protocol==='https:'||supplied.hostname==='localhost') &&
      (supplied.origin===own.origin||!!process.env.APP_ORIGIN&&supplied.origin===process.env.APP_ORIGIN);
  }catch{return false;}
}
export async function userWorkspace(req:NextRequest,roles=['owner','admin','developer','viewer']):Promise<Workspace|null>{
  const user=await getSessionUser(req.cookies.get(SESSION_COOKIE)?.value);
  if(!user)return null;
  const result=await database().query<{account_id:string;role:string}>(
    `select m.account_id,m.role from ${S}.vachaspati_account_members m
       where m.user_id=$1 and m.role=any($2::text[]) order by
       case m.role when 'owner' then 0 when 'admin' then 1 when 'developer' then 2 else 3 end limit 1`,
       [user.id,roles]);
  return result.rows[0]?{...result.rows[0],user_id:user.id}:null;
}
export async function keyWorkspace(req:NextRequest,requiredScope:string):Promise<{account_id:string;key_id:string}|null>{
  const token=req.headers.get('authorization')?.match(/^Bearer\s+(vch_[a-zA-Z0-9_-]{40,100})$/i)?.[1];
  if(!token)return null;
  const result=await database().query<{account_id:string;key_id:string;scopes:string[]}>(
    `select k.account_id,k.id as key_id,k.scopes from ${S}.vachaspati_api_keys k
      where k.key_hash=$1 and k.revoked_at is null and (k.expires_at is null or k.expires_at>now())
      limit 1`,[sha256(token)]);
  const row=result.rows[0];
  return row&&(row.scopes.includes(requiredScope)||row.scopes.includes('*'))?row:null;
}
export async function createApiKey(accountId:string,label:string,scopes:string[]){
  const secret='vch_'+randomBytes(36).toString('base64url');
  const prefix=secret.slice(0,15);
  const created=await database().query<{id:string}>(
    `insert into ${S}.vachaspati_api_keys(account_id,label,key_prefix,key_hash,scopes)
     values($1,$2,$3,$4,$5) returning id`,[accountId,label,prefix,sha256(secret),scopes]);
  return {id:created.rows[0].id,key:secret,prefix};
}
export async function readJson(req:Request,maxLength=16384):Promise<Record<string,unknown>|null>{
  if(Number(req.headers.get('content-length')||0)>maxLength)return null;
  const raw=await req.text();
  if(raw.length>maxLength)return null;
  try{const value:unknown=JSON.parse(raw);return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;}
  catch{return null;}
}
export function validUuid(x:unknown):x is string{
  return typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
}
export function hostAllowed(origin:string,hosts:string[]):boolean{
  try{const url=new URL(origin);return (url.protocol==='https:'||url.hostname==='localhost') && hosts.includes(url.hostname.toLowerCase());}
  catch{return false;}
}
export function agentIdValid(value:unknown){return validUuid(value);}
export type AgentRow={id:string;account_id:string;name:string;instructions:string;status:string;language_code:string;voice_id:string|null;llm_model:string|null;greeting:string;accent_color:string;interaction_mode:string};
export async function accountAgent(account:string,id:string):Promise<AgentRow|null>{
  const result=await database().query<AgentRow>(
    `select id,account_id,name,instructions,status,language_code,voice_id,llm_model,greeting,accent_color,interaction_mode
       from ${S}.vachaspati_agents where account_id=$1 and id=$2`,[account,id]);
  return result.rows[0]??null;
}
