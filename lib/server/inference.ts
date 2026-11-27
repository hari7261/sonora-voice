import 'server-only';
const MAX_AUDIO=10*1024*1024;
export async function transcribeAudio(audio:ArrayBuffer,format:'audio/wav'|'audio/wave',language:string){
 const base=process.env.SHERPA_INFERENCE_URL;
 const secret=process.env.SHERPA_WORKER_SECRET;
 if(!base||!secret)throw new Error('INFERENCE_NOT_CONFIGURED');
 if(audio.byteLength<=44||audio.byteLength>MAX_AUDIO)throw new Error('INVALID_AUDIO_LENGTH');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),60000);
 try{
  const r=await fetch(new URL('/transcribe',base),{method:'POST',body:Buffer.from(audio),
    headers:{'Content-Type':format,'X-Worker-Secret':secret,'X-Language':language},
    signal:controller.signal,cache:'no-store'});
  if(!r.ok)throw new Error('INFERENCE_HTTP_'+r.status);
  const data=await r.json() as {text?:string;duration_seconds?:number};
  if(typeof data.text!=='string'||!data.text.trim())throw new Error('INFERENCE_EMPTY');
  return {text:data.text,duration_seconds:data.duration_seconds};
 }finally{clearTimeout(timer);}
}
function cleanSpeechText(raw:string):string{
 return raw
  .replace(/```[\s\S]*?```/g,' ')
  .replace(/`([^`]*)`/g,'$1')
  .replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1')
  .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
  .replace(/^\s{0,3}#{1,6}\s+/gm,'')
  .replace(/^\s{0,3}[-*•+]\s+/gm,'')
  .replace(/^\s{0,3}\d+\.\s+/gm,'')
  .replace(/^\s{0,3}>\s?/gm,'')
  .replace(/(\*\*|__|\*|_|~~)/g,'')
  .replace(/[|~^\\<>]/g,' ')
  .replace(/\s*—\s*|\s*–\s*/g,', ')
  .replace(/\r?\n+/g,'. ')
  .replace(/\.\s*\./g,'.')
  .replace(/\s{2,}/g,' ')
  .trim();
}
export async function synthesizeSpeech(text:string,voice:string,language:string):Promise<Uint8Array>{
 const base=process.env.SHERPA_INFERENCE_URL,secret=process.env.SHERPA_WORKER_SECRET;
 if(!base||!secret)throw new Error('INFERENCE_NOT_CONFIGURED');
 const spoken=cleanSpeechText(text)||text.trim();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
 try{
  const r=await fetch(new URL('/synthesize',base),{method:'POST',body:JSON.stringify({text:spoken,voice,language}),
   headers:{'Content-Type':'application/json','X-Worker-Secret':secret},cache:'no-store',signal:controller.signal});
  if(!r.ok)throw new Error('INFERENCE_HTTP_'+r.status);
  const bytes=new Uint8Array(await r.arrayBuffer());
  if(bytes.length<44||bytes.length>12*1024*1024)throw new Error('INVALID_WORKER_AUDIO');
  return bytes;
 }finally{clearTimeout(timer);}
}
