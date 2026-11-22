import {NextRequest} from 'next/server';
import {database} from '../../../../lib/server/db';
import {apiError,keyWorkspace,readJson} from '../../../../lib/server/platform';
export const runtime='nodejs';export const dynamic='force-dynamic';
const S='vachaspati_private';
export async function GET(req:NextRequest){
 const who=await keyWorkspace(req,'agents:read');if(!who)return apiError('Valid agents:read API key required',401);
 try{
  const r=await database().query(`select id,name,status,language_code,llm_model,created_at
    from ${S}.vachaspati_agents where account_id=$1 order by created_at desc limit 100`,[who.account_id]);
  return Response.json({data:r.rows},{headers:{'Cache-Control':'no-store'}});
 }catch{return apiError('Agent listing unavailable',503);}
}
export async function POST(req:NextRequest){
 const who=await keyWorkspace(req,'agents:write');if(!who)return apiError('Valid agents:write API key required',401);
 const body=await readJson(req);
 const name=typeof body?.name==='string'?body.name.trim():'';
 const instructions=typeof body?.instructions==='string'?body.instructions.trim():'';
 const model=typeof body?.llm_model==='string'?body.llm_model.trim():'';
 const language=typeof body?.language==='string'?body.language.trim():'en';
 if(!name||name.length>90||instructions.length>10000||!/^[a-z0-9._/-]{3,120}$/i.test(model)||
    !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(language))return apiError('Invalid agent settings',400);
 try{
  const r=await database().query<{id:string}>(`insert into ${S}.vachaspati_agents(account_id,name,instructions,llm_model,language_code,status)
    values($1,$2,$3,$4,$5,'draft') returning id`,[who.account_id,name,instructions,model,language]);
  return Response.json({id:r.rows[0].id,status:'draft'},{status:201});
 }catch{return apiError('Agent creation unavailable',503);}
}
