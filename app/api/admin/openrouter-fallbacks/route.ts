import {NextRequest} from 'next/server';
import {database} from '../../../../lib/server/db';
import {requireAdmin,audit} from '../../../../lib/server/admin';
import {apiError,readJson,safeOrigin} from '../../../../lib/server/platform';
import {MODEL_ID_PATTERN} from '../../../../lib/openrouter-free-utils';
import {syncFreeFallbackRegistry} from '../../../../lib/server/openrouter-fallbacks';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const S='vachaspati_private';

export async function GET(req:NextRequest){
 try{
  const admin=await requireAdmin(req,['superadmin','operations','analyst']);
  if(!admin)return apiError('Forbidden',403);
  const rows=await database().query(`select model_id,name,priority,enabled,catalog_available,
    context_length,prompt_price::text,completion_price::text,last_verified_at,updated_at
    from ${S}.vachaspati_openrouter_fallbacks
    order by priority,model_id limit 250`);
  return Response.json({data:rows.rows},{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  if((e as {code?:string}).code==='42P01')
   return apiError('Run the openrouter_free_fallbacks SQL migration before managing this feature',503);
  return apiError('Unable to load fallback models',503);
 }
}
export async function POST(req:NextRequest){
 if(!safeOrigin(req))return apiError('Disallowed origin',403);
 try{
  const admin=await requireAdmin(req,['superadmin','operations']);
  if(!admin)return apiError('Forbidden',403);
  const body=await readJson(req,1000);
  if(body?.action!=='sync')return apiError('Expected action: sync',400);
  const result=await syncFreeFallbackRegistry();
  await audit(admin.user_id,'openrouter.fallbacks.synced','openrouter_fallbacks',null,result);
  return Response.json({ok:true,...result},{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  if((e as {code?:string}).code==='42P01')return apiError('Run the SQL migration first',503);
  return apiError('Could not verify the live OpenRouter catalog. Existing preferences were preserved.',503);
 }
}
export async function PATCH(req:NextRequest){
 if(!safeOrigin(req))return apiError('Disallowed origin',403);
 try{
  const admin=await requireAdmin(req,['superadmin','operations']);
  if(!admin)return apiError('Forbidden',403);
  const body=await readJson(req,2000);
  const id=typeof body?.modelId==='string'?body.modelId.trim():'';
  if(!id||id.length>140||!MODEL_ID_PATTERN.test(id))return apiError('Invalid model identifier',400);
  const enabled=typeof body?.enabled==='boolean'?body.enabled:null;
  const priority=typeof body?.priority==='number'?body.priority:null;
  if(enabled===null&&priority===null)return apiError('Specify enabled or priority',400);
  if(priority!==null&&(!Number.isSafeInteger(priority)||priority<1||priority>100000))
    return apiError('Priority must be between 1 and 100000',400);
  const client=await database().connect();
  try{
   await client.query('begin');
   const updated=await client.query(`update ${S}.vachaspati_openrouter_fallbacks
     set enabled=coalesce($2,enabled),priority=coalesce($3,priority),updated_at=now()
     where model_id=$1 returning model_id`,[id,enabled,priority]);
   if(!updated.rowCount){await client.query('rollback');return apiError('Model is not registered. Refresh the catalog.',404);}
   await client.query(`insert into ${S}.vachaspati_admin_audit(actor_id,action,target_type,target_id,details)
     values($1,'openrouter.fallback.updated','openrouter_fallback',$2,$3::jsonb)`,
     [admin.user_id,id,JSON.stringify({enabled,priority})]);
   await client.query('commit');
   return Response.json({ok:true});
  }catch(e){await client.query('rollback');throw e;}finally{client.release();}
 }catch{return apiError('Unable to update fallback settings',503);}
}
