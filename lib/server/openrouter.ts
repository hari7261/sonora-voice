import 'server-only';
import {MODEL_ID_PATTERN} from '../openrouter-free-utils';
import {eligibleModelChain} from './openrouter-fallbacks';
import {database} from './db';

export type AiMessage={role:'system'|'user'|'assistant';content:string};
export type AiResponse={
 text:string;
 modelUsed:string|null;
 freeFallbacksOffered:number;
};
let fallbackCache:{value:boolean;expires:number}|null=null;
async function fallbackEnabled():Promise<boolean>{
 if(fallbackCache&&fallbackCache.expires>Date.now())return fallbackCache.value;
 const r=await database().query<{value:boolean}>(`
  select value from vachaspati_private.vachaspati_platform_settings
  where key='openrouter_free_fallbacks_enabled' limit 1`);
 const val=r.rows[0]?.value!==false;
 fallbackCache={value:val,expires:Date.now()+60_000};
 return val;
}
export async function generateReply(model:string,messages:AiMessage[]):Promise<AiResponse>{
 const apiKey=process.env.OPENROUTER_API_KEY;
 if(!apiKey)throw new Error('OPENROUTER_NOT_CONFIGURED');
 if(model.length>140||!MODEL_ID_PATTERN.test(model))throw new Error('INVALID_MODEL');
 let models=[model];
 try{
  if(await fallbackEnabled())models=await eligibleModelChain(model);
 }catch(e){
  // If live pricing/availability cannot be verified, DO NOT use stale or paid fallbacks.
  // The customer-selected primary is the sole allowed model in this case.
  console.warn('OpenRouter free fallback catalog unavailable; using selected primary only');
 }
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),45000);
 try{
  const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{
   method:'POST',signal:controller.signal,
   headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey,
    'HTTP-Referer':process.env.APP_ORIGIN||'https://localhost','X-Title':'Vachaspati AI'},
   body:JSON.stringify({
     ...(models.length>1?{models:models.slice(0,3)}:{model}),
     max_tokens:400,
     stream:false,
     messages
   }),
   cache:'no-store',
  });
  if(!res.ok)throw new Error('OPENROUTER_'+res.status);
  const body=await res.json() as {
    model?:unknown;
    choices?:Array<{message?:{content?:unknown}}>;
  };
  const content=body.choices?.[0]?.message?.content;
  const answer=typeof content==='string'?content.trim():'';
  if(!answer)throw new Error('OPENROUTER_EMPTY');
  return {
    text:answer.slice(0,6000),
    modelUsed:typeof body.model==='string'?body.model:null,
    freeFallbacksOffered:Math.max(0,models.length-1)
  };
 }finally{clearTimeout(timeout);}
}
