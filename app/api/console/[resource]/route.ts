import {NextRequest} from 'next/server';
import {isOpenRouterModelId} from '../../../../lib/openrouter-free-utils';
import {database} from '../../../../lib/server/db';
import {apiError,createApiKey,readJson,safeOrigin,userWorkspace} from '../../../../lib/server/platform';
import {getCreditBalance} from '../../../../lib/server/credits';
export const runtime='nodejs';export const dynamic='force-dynamic';
const S='vachaspati_private';
type Params={params:Promise<{resource:string}>};
export async function GET(req:NextRequest,{params}:Params){
 const name=(await params).resource;
 if(!['agents','keys','usage','models','plans'].includes(name))return apiError('Not found',404);
 try{
  const who=await userWorkspace(req);if(!who)return apiError('Unauthorized',401);
  if(name==='agents'){
   const r=await database().query(`
    select a.id,a.name,a.instructions,a.status,a.language_code,a.voice_id,a.llm_model,a.greeting,
      a.accent_color,a.interaction_mode,a.created_at,
      coalesce(array_agg(d.domain) filter(where d.domain is not null),'{}'::text[]) as domains
    from ${S}.vachaspati_agents a left join ${S}.vachaspati_agent_domains d on d.agent_id=a.id
    where a.account_id=$1 group by a.id order by a.created_at desc`,[who.account_id]);
   return Response.json({agents:r.rows,account_id:who.account_id});
  }
  if(name==='keys'){
   const r=await database().query(`
    select id,label,key_prefix,scopes,expires_at,revoked_at,created_at from ${S}.vachaspati_api_keys
    where account_id=$1 order by created_at desc limit 100`,[who.account_id]);
   return Response.json({keys:r.rows});
  }
  if(name==='usage'){
   const [balance,usage]=await Promise.all([
      getCreditBalance(who.account_id),
      database().query(`select request_id,units,credits,status_code,created_at from ${S}.vachaspati_api_usage where account_id=$1 order by created_at desc limit 50`,[who.account_id])]);
   return Response.json({balance,usage:usage.rows});
  }
  if(name==='models'){
   const r=await database().query(`select id,name,capability,description,enabled,config from ${S}.vachaspati_voice_models where enabled=true order by capability,name`);
   return Response.json({models:r.rows});
  }
  const r=await database().query(`select code,name,monthly_credits,daily_limit,weekly_limit,monthly_limit,concurrency_limit from ${S}.vachaspati_plans where enabled=true order by monthly_credits`);
  return Response.json({plans:r.rows});
 }catch{return apiError('Unable to load workspace',503);}
}
export async function POST(req:NextRequest,{params}:Params){
 const name=(await params).resource;
 if(!['agents','keys'].includes(name))return apiError('Not found',404);
 if(!safeOrigin(req))return apiError('Disallowed origin',403);
 try{
  const who=await userWorkspace(req,['owner','admin','developer']);
  if(!who)return apiError('Unauthorized',401);
  const data=await readJson(req);
  if(!data)return apiError('Invalid request',400);
  if(name==='keys'){
   const label=typeof data.label==='string'?data.label.trim():'';
   const scopes=data.scopes;
   const allowed=['agents:read','agents:write','audio:write','usage:read'];
   if(!label||label.length>80||!Array.isArray(scopes)||scopes.length<1||scopes.some(s=>typeof s!=='string'||!allowed.includes(s)))return apiError('Invalid key label or scopes',400);
   const issued=await createApiKey(who.account_id,label,[...new Set(scopes as string[])]);
   return Response.json({key:issued.key,id:issued.id,prefix:issued.prefix,notice:'Store this key securely. It will never be shown again.'},{status:201,headers:{'Cache-Control':'no-store'}});
  }
  const nameValue=typeof data.name==='string'?data.name.trim():'';
  const instructions=typeof data.instructions==='string'?data.instructions.trim():'';
  const language=typeof data.language==='string'?data.language.trim():'en';
  const llmModel=typeof data.llmModel==='string'?data.llmModel.trim():process.env.OPENROUTER_DEFAULT_MODEL||'';
  if(!nameValue||nameValue.length>90||instructions.length>10000||
      !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(language)||
      !isOpenRouterModelId(llmModel))return apiError('Specify a valid name, language and OpenRouter model',400);
  const greeting=typeof data.greeting==='string'?data.greeting.trim().slice(0,300):'';
  const created=await database().query<{id:string}>(`
   insert into ${S}.vachaspati_agents(account_id,name,instructions,language_code,llm_model,greeting,status)
   values($1,$2,$3,$4,$5,$6,'draft') returning id`,
   [who.account_id,nameValue,instructions,language,llmModel,greeting]);
  return Response.json({id:created.rows[0].id,status:'draft'},{status:201});
 }catch{return apiError('Unable to save workspace record',503);}
}
