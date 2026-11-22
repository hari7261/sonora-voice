import {NextRequest} from 'next/server';
import {database} from '../../../../../lib/server/db';
import {apiError,readJson,safeOrigin,userWorkspace,validUuid} from '../../../../../lib/server/platform';
export const runtime='nodejs';export const dynamic='force-dynamic';
const S='vachaspati_private';type Params={params:Promise<{id:string}>};
function domain(value:string):string|null{
 try{const raw=value.toLowerCase().trim();const host=raw.includes('://')?new URL(raw).hostname:raw;
  if(host.length<2||host.length>253||(/[^a-z0-9.-]/.test(host))||host.includes('..')||host.startsWith('-'))return null;
  return host;
 }catch{return null;}
}
export async function PATCH(req:NextRequest,{params}:Params){
 if(!safeOrigin(req))return apiError('Disallowed origin',403);
 const {id}=await params;if(!validUuid(id))return apiError('Invalid agent ID');
 try{
  const who=await userWorkspace(req,['owner','admin','developer']);if(!who)return apiError('Unauthorized',401);
  const data=await readJson(req);if(!data)return apiError('Invalid request');
  const name=typeof data.name==='string'?data.name.trim():null;
  const instructions=typeof data.instructions==='string'?data.instructions.trim():null;
  const greeting=typeof data.greeting==='string'?data.greeting.trim():null;
  const llmModel=typeof data.llmModel==='string'?data.llmModel.trim():null;
  const voice=typeof data.voiceId==='string'?data.voiceId.trim():null;
  const language=typeof data.language==='string'?data.language.trim():null;
  const color=typeof data.accentColor==='string'?data.accentColor.trim():null;
  const mode=typeof data.interactionMode==='string'?data.interactionMode:null;
  const status=typeof data.status==='string'?data.status:null;
  const domains=Array.isArray(data.domains)?data.domains:null;
  if(name!==null&&(!name||name.length>90)||instructions!==null&&instructions.length>10000||
     greeting!==null&&greeting.length>300||llmModel!==null&&!/^[a-z0-9._/-]{3,120}$/i.test(llmModel)||
     language!==null&&!/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(language)||
     color!==null&&!/^#[0-9a-f]{6}$/i.test(color)||mode!==null&&!['voice-text','voice','text'].includes(mode)||
     status!==null&&!['draft','active','paused'].includes(status)||
     voice!==null&&voice.length>100||domains!==null&&(domains.length>20||domains.some(d=>typeof d!=='string'||domain(d)===null)))
      return apiError('Invalid agent configuration');
  const client=await database().connect();
  try{
   await client.query('begin');
   const result=await client.query<{id:string;llm_model:string|null}>(`select id,llm_model from ${S}.vachaspati_agents where id=$1 and account_id=$2 for update`,[id,who.account_id]);
   if(!result.rows[0]){await client.query('rollback');return apiError('Agent not found',404);}
   if(domains){
    await client.query(`delete from ${S}.vachaspati_agent_domains where agent_id=$1`,[id]);
    for(const d of new Set(domains.map(d=>domain(d as string)!))){
     await client.query(`insert into ${S}.vachaspati_agent_domains(agent_id,domain) values($1,$2)`,[id,d]);
    }
   }
   if(status==='active'){
    const selected=llmModel||result.rows[0].llm_model;
    const domainsResult=await client.query<{count:string}>(`select count(*)::text as count from ${S}.vachaspati_agent_domains where agent_id=$1`,[id]);
    if(!selected||Number(domainsResult.rows[0].count)===0){await client.query('rollback');return apiError('A model and at least one allowed domain are required to publish',400);}
   }
   await client.query(`update ${S}.vachaspati_agents set name=coalesce($3,name),
    instructions=coalesce($4,instructions),greeting=coalesce($5,greeting),
    llm_model=coalesce($6,llm_model),voice_id=coalesce($7,voice_id),
    language_code=coalesce($8,language_code),accent_color=coalesce($9,accent_color),
    interaction_mode=coalesce($10,interaction_mode),status=coalesce($11,status),updated_at=now()
    where id=$1 and account_id=$2`,
    [id,who.account_id,name,instructions,greeting,llmModel,voice,language,color,mode,status]);
   await client.query('commit');return Response.json({ok:true});
  }catch(e){await client.query('rollback');throw e;}finally{client.release();}
 }catch{return apiError('Unable to update agent',503);}
}
export async function DELETE(req:NextRequest,{params}:Params){
 if(!safeOrigin(req))return apiError('Disallowed origin',403);
 const {id}=await params;if(!validUuid(id))return apiError('Invalid agent ID');
 try{
 const who=await userWorkspace(req,['owner','admin']);if(!who)return apiError('Unauthorized',401);
 const r=await database().query(`delete from ${S}.vachaspati_agents where id=$1 and account_id=$2 returning id`,[id,who.account_id]);
 return r.rowCount?Response.json({ok:true}):apiError('Not found',404);
 }catch{return apiError('Unable to delete agent',503);}
}
