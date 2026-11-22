import {NextRequest} from 'next/server';
import {readJson} from '../../../../../../lib/server/platform';
import {widgetAccess,widgetError,publicThrottle} from '../../../../../../lib/server/widget-http';
import {QuotaError,reserveCredits,finishUsage} from '../../../../../../lib/server/credits';
import {synthesizeSpeech} from '../../../../../../lib/server/inference';
export const runtime='nodejs';export const dynamic='force-dynamic';
type P={params:Promise<{id:string}>};
export async function OPTIONS(req:NextRequest,{params}:P){
 const access=await widgetAccess(req,(await params).id);
 return access?new Response(null,{status:204,headers:access.headers}):new Response(null,{status:403});
}
export async function POST(req:NextRequest,{params}:P){
 try{
  const id=(await params).id,access=await widgetAccess(req,id);
  if(!access)return widgetError('Agent not available',403);
  if(!access.agent.interaction_mode.includes('voice'))return widgetError('Voice disabled for this agent',403,access.headers);
  if(!await publicThrottle(req,id))return widgetError('Too many requests',429,access.headers);
  const body=await readJson(req,7000),text=typeof body?.text==='string'?body.text.trim():'';
  if(!text||text.length>5000)return widgetError('Invalid text',400,access.headers);
  const charge=await reserveCredits(access.agent.account_id,'tts',text.length);
  try{
   const audio=await synthesizeSpeech(text,access.agent.voice_id||'',access.agent.language_code);
   await finishUsage(access.agent.account_id,charge.requestId,'tts',text.length,charge.credits,200);
   return new Response(Buffer.from(audio),{headers:{...access.headers,'Content-Type':'audio/wav'}});
  }catch{
   await finishUsage(access.agent.account_id,charge.requestId,'tts',text.length,charge.credits,503);
   return widgetError('Voice synthesis currently unavailable',503,access.headers);
  }
 }catch(e){return e instanceof QuotaError?widgetError(e.reason,e.status):widgetError('Voice synthesis unavailable',503);}
}
