import {NextRequest} from 'next/server';
import {isOpenRouterModelId} from '../../../../../lib/openrouter-free-utils';
import {database} from '../../../../../lib/server/db';
import {flag} from '../../../../../lib/server/admin';
import {apiError,keyWorkspace,readJson,validUuid} from '../../../../../lib/server/platform';
export const runtime='nodejs';export const dynamic='force-dynamic';
const S='vachaspati_private';type P={params:Promise<{id:string}>};
export async function GET(req:NextRequest,{params}:P){
 const who=await keyWorkspace(req,'agents:read');if(!who)return apiError('Valid agents:read API key required',401);
 const id=(await params).id;if(!validUuid(id))return apiError('Invalid agent ID');
 try{
  const r=await database().query(`select id,name,instructions,language_code,llm_model,status,greeting,accent_color,interaction_mode
    from ${S}.vachaspati_agents where id=$1 and account_id=$2`,[id,who.account_id]);
  if(!r.rows[0])return apiError('Agent not found',404);
  return Response.json({agent:r.rows[0]});
 }catch{return apiError('Unable to load agent',503);}
}
export async function PATCH(req:NextRequest,{params}:P){
 const who=await keyWorkspace(req,'agents:write');if(!who)return apiError('Valid agents:write API key required',401);
 const id=(await params).id;if(!validUuid(id))return apiError('Invalid agent ID');
 const b=await readJson(req);
 if(!b)return apiError('Invalid input',400);
 const name=typeof b.name==='string'?b.name.trim():null;
 const instructions=typeof b.instructions==='string'?b.instructions.trim():null;
 const model=typeof b.llm_model==='string'?b.llm_model.trim():null;
 const greeting=typeof b.greeting==='string'?b.greeting.trim():null;
 const status=typeof b.status==='string'?b.status:null;
 if(name!==null&&(!name||name.length>90)||instructions!==null&&instructions.length>10000||
    model!==null&&!isOpenRouterModelId(model)||greeting!==null&&greeting.length>300||
    status!==null&&!['draft','active','paused'].includes(status))return apiError('Invalid agent settings');
 try{
  if(status==='active'){
   if(!await flag('agent_publishing_enabled',true))return apiError('Agent publishing is disabled',403);
   if(!process.env.OPENROUTER_API_KEY)return apiError('OpenRouter is not configured',503);
   const existing=await database().query<{interaction_mode:string}>(`select interaction_mode from ${S}.vachaspati_agents where account_id=$1 and id=$2`,[who.account_id,id]);
   if(!existing.rows[0])return apiError('Agent not found',404);
   if(existing.rows[0].interaction_mode.includes('voice')&&(!process.env.SHERPA_INFERENCE_URL||!process.env.SHERPA_WORKER_SECRET))
    return apiError('Speech worker is not configured',503);
   const chk=await database().query<{count:string}>(`select count(*)::text as count from ${S}.vachaspati_agent_domains
    where agent_id=$1`,[id]);
   if(Number(chk.rows[0]?.count||0)===0)return apiError('Configure allowed domains in the dashboard before publishing');
  }
  const result=await database().query(`update ${S}.vachaspati_agents set name=coalesce($3,name),
    instructions=coalesce($4,instructions),llm_model=coalesce($5,llm_model),
    greeting=coalesce($6,greeting),status=coalesce($7,status),updated_at=now()
    where id=$1 and account_id=$2 returning id,status`,
    [id,who.account_id,name,instructions,model,greeting,status]);
  return result.rows[0]?Response.json({agent:result.rows[0]}):apiError('Not found',404);
 }catch{return apiError('Unable to update agent',503);}
}
export async function DELETE(req:NextRequest,{params}:P){
 const who=await keyWorkspace(req,'agents:write');if(!who)return apiError('Valid agents:write API key required',401);
 const id=(await params).id;if(!validUuid(id))return apiError('Invalid agent ID');
 try{
  const r=await database().query(`delete from ${S}.vachaspati_agents where id=$1 and account_id=$2 returning id`,[id,who.account_id]);
  return r.rows[0]?Response.json({deleted:true}):apiError('Not found',404);
 }catch{return apiError('Unable to delete agent',503);}
}
