import {NextRequest} from 'next/server';
import {keyWorkspace,apiError,readJson} from '../../../../../lib/server/platform';
import {QuotaError,reserveCredits,finishUsage} from '../../../../../lib/server/credits';
import {synthesizeSpeech} from '../../../../../lib/server/inference';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 const who=await keyWorkspace(req,'audio:write');if(!who)return apiError('Valid audio API key required',401);
 const data=await readJson(req,12000);
 const text=typeof data?.text==='string'?data.text.trim():'';
 const voice=typeof data?.voice==='string'?data.voice.trim():'';
 const language=typeof data?.language==='string'?data.language.trim():'en';
 if(!text||text.length>5000||voice.length>100||!/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(language))return apiError('Invalid synthesis parameters');
 try{
  const reservation=await reserveCredits(who.account_id,'tts',text.length);
  try{
   const audio=await synthesizeSpeech(text,voice,language);
   await finishUsage(who.account_id,reservation.requestId,'tts',text.length,reservation.credits,200,who.key_id);
   return new Response(Uint8Array.from(audio).buffer as ArrayBuffer,{headers:{'Content-Type':'audio/wav','Cache-Control':'no-store','X-Request-Id':reservation.requestId}});
  }catch{
   await finishUsage(who.account_id,reservation.requestId,'tts',text.length,reservation.credits,503,who.key_id);
   return apiError('Speech synthesis worker unavailable',503);
  }
 }catch(e){return e instanceof QuotaError?apiError(e.reason,e.status):apiError('Unable to synthesize speech',503);}
}
