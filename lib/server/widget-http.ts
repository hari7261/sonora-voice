import 'server-only';
import type {NextRequest} from 'next/server';
import {sha256} from './credentials';
import {publicAgent} from './agent-runtime';
import {database} from './db';
import {validUuid} from './platform';
export function cors(origin:string){
 return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','Cache-Control':'no-store'};
}
export async function widgetAccess(req:NextRequest,id:string){
 if(!validUuid(id))return null;
 const origin=req.headers.get('origin')||(req.method==='GET'?new URL(req.url).origin:null);
 if(!origin)return null;
 const agent=await publicAgent(id,origin);
 return agent?{agent,origin,headers:cors(origin)}:null;
}
export async function publicThrottle(req:NextRequest,id:string){
 // Rate limiting is an additional safeguard; paid service quotas are enforced separately.
 const origin=req.headers.get('origin')||'';
 const ip=req.headers.get('x-vercel-forwarded-for')||req.headers.get('cf-connecting-ip')||
   req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')||'unknown';
 const hash=sha256(id+'|'+origin+'|'+ip.split(',')[0].trim());
 const r=await database().query<{allowed:boolean}>(`
  with lk as (select pg_advisory_xact_lock(hashtext($1))),
  recent as (
   select count(*)::int as total from vachaspati_private.vachaspati_request_limits, lk
   where request_hash=$1 and attempted_at>now()-interval '1 minute'
  ),
  ins as (
   insert into vachaspati_private.vachaspati_request_limits(request_hash)
   select $1 from recent where total<15 returning 1
  )
  select exists(select 1 from ins) as allowed`,[hash]);
 return !!r.rows[0]?.allowed;
}
export function widgetError(error:string,status=400,headers?:Record<string,string>){
 return Response.json({error},{status,headers});
}
