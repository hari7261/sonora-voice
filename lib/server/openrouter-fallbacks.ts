import 'server-only';
import {database} from './db';
import {arrangeFallbacks,extractFreeTextModels,type FreeTextModel,type FallbackPreference} from '../openrouter-free-utils';
const S='vachaspati_private';
export async function liveFreeModels(forceFresh=false):Promise<FreeTextModel[]>{
 const url='https://openrouter.ai/api/v1/models?output_modalities=text&max_price=0&max_output_price=0&limit=1000';
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),9000);
 try{
  const response=await fetch(url,{
   signal:controller.signal,
   ...(forceFresh?{cache:'no-store' as const}:{next:{revalidate:180}}),
  });
  if(!response.ok)throw new Error('OPENROUTER_CATALOG_'+response.status);
  const body:unknown=await response.json();
  if(!body||typeof body!=='object'||!('data' in body))throw new Error('OPENROUTER_CATALOG_INVALID');
  return extractFreeTextModels((body as {data:unknown}).data);
 }finally{clearTimeout(timer);}
}
export async function fallbackPreferences():Promise<FallbackPreference[]>{
 try{
  const r=await database().query<FallbackPreference>(`select model_id,enabled,priority
    from ${S}.vachaspati_openrouter_fallbacks order by priority,model_id`);
  return r.rows;
 }catch(e){
  // Keep the old app working until the new migration is applied.
  if((e as {code?:string}).code==='42P01')return [];
  throw e;
 }
}
export async function eligibleModelChain(primary:string):Promise<string[]>{
 // A failed catalog lookup MUST NOT cause use of stale possibly paid model IDs.
 const [catalog,prefs]=await Promise.all([liveFreeModels(false),fallbackPreferences()]);
 return arrangeFallbacks(primary,catalog,prefs);
}
export async function syncFreeFallbackRegistry():Promise<{models:number;nowUnavailable:number}>{
 const models=await liveFreeModels(true);
 const client=await database().connect();
 try{
  await client.query('begin');
  await client.query(`update ${S}.vachaspati_openrouter_fallbacks
    set catalog_available=false,updated_at=now()`);
  for(let i=0;i<models.length;i++){
   const model=models[i];
   // A real-time check has established text input/output and zero fees.
   const rank=model.id==='openrouter/free'?99999:500+i;
   await client.query(`insert into ${S}.vachaspati_openrouter_fallbacks
     (model_id,name,priority,enabled,catalog_available,context_length,prompt_price,completion_price,last_verified_at)
     values($1,$2,$3,true,true,$4,0,0,now())
     on conflict(model_id) do update set
       name=excluded.name,catalog_available=true,context_length=excluded.context_length,
       prompt_price=0,completion_price=0,last_verified_at=now(),updated_at=now()`,
     [model.id,model.name,rank,model.context_length]);
  }
  const r=await client.query<{count:string}>(`select count(*)::text as count
    from ${S}.vachaspati_openrouter_fallbacks where catalog_available=false`);
  await client.query('commit');
  return {models:models.length,nowUnavailable:Number(r.rows[0].count)};
 }catch(e){await client.query('rollback');throw e;}finally{client.release();}
}
