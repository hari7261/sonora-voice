import {NextRequest} from 'next/server';
import {widgetAccess,widgetError,publicThrottle} from '../../../../../../lib/server/widget-http';
import {QuotaError,reserveCredits,finishUsage} from '../../../../../../lib/server/credits';
import {inspectWav} from '../../../../../../lib/server/wav';
import {transcribeAudio} from '../../../../../../lib/server/inference';
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
  if(Number(req.headers.get('content-length')||0)>10*1024*1024+20000)return widgetError('Audio exceeds 10 MB',413,access.headers);
  const form=await req.formData();const file=form.get('file');
  if(!(file instanceof File)||file.size<44||file.size>10*1024*1024)return widgetError('PCM16 WAV audio is required',400,access.headers);
  const bytes=new Uint8Array(await file.arrayBuffer());
  let wav;try{wav=inspectWav(bytes)}catch{return widgetError('Invalid WAV or duration',400,access.headers)}
  const seconds=Math.ceil(wav.seconds),charge=await reserveCredits(access.agent.account_id,'stt',seconds);
  try{
   const output=await transcribeAudio(bytes.buffer as ArrayBuffer,'audio/wav',access.agent.language_code);
   await finishUsage(access.agent.account_id,charge.requestId,'stt',seconds,charge.credits,200);
   return Response.json({text:output.text,seconds:wav.seconds},{headers:access.headers});
  }catch{
   await finishUsage(access.agent.account_id,charge.requestId,'stt',seconds,charge.credits,503);
   return widgetError('Speech recognition currently unavailable',503,access.headers);
  }
 }catch(e){return e instanceof QuotaError?widgetError(e.reason,e.status):widgetError('Transcription unavailable',503);}
}
