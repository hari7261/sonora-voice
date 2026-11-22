import {NextRequest} from 'next/server';
import {keyWorkspace,apiError} from '../../../../../lib/server/platform';
import {QuotaError,reserveCredits,finishUsage} from '../../../../../lib/server/credits';
import {inspectWav} from '../../../../../lib/server/wav';
import {transcribeAudio} from '../../../../../lib/server/inference';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 const who=await keyWorkspace(req,'audio:write');if(!who)return apiError('Valid audio API key required',401);
 if(Number(req.headers.get('content-length')||0)>10*1024*1024+10000)return apiError('Audio exceeds 10 MB',413);
 try{
  const form=await req.formData();
  const file=form.get('file'),language=form.get('language');
  if(!(file instanceof File)||file.size>10*1024*1024||file.size<44)return apiError('A PCM16 WAV file (max 10 MB) is required');
  if(language!==null&&(typeof language!=='string'||!/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(language)))return apiError('Invalid language');
  const bytes=new Uint8Array(await file.arrayBuffer());
  let wav;
  try{wav=inspectWav(bytes);}catch{return apiError('Only valid PCM16 WAV, 0.1–120 seconds, is supported',400);}
  const units=Math.ceil(wav.seconds);
  const reservation=await reserveCredits(who.account_id,'stt',units);
  try{
   const response=await transcribeAudio(bytes.buffer as ArrayBuffer,'audio/wav',typeof language==='string'?language:'');
   await finishUsage(who.account_id,reservation.requestId,'stt',units,reservation.credits,200,who.key_id);
   return Response.json({text:response.text,duration_seconds:wav.seconds,request_id:reservation.requestId},{headers:{'Cache-Control':'no-store'}});
  }catch{
   await finishUsage(who.account_id,reservation.requestId,'stt',units,reservation.credits,503,who.key_id);
   return apiError('Transcription worker unavailable',503);
  }
 }catch(e){return e instanceof QuotaError?apiError(e.reason,e.status):apiError('Unable to process audio upload',503);}
}
