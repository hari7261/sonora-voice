import 'server-only';
export type AiMessage={role:'system'|'user'|'assistant';content:string};
export async function generateReply(model:string,messages:AiMessage[]):Promise<string>{
 const apiKey=process.env.OPENROUTER_API_KEY;
 if(!apiKey)throw new Error('OPENROUTER_NOT_CONFIGURED');
 if(!/^[a-z0-9._/-]{3,120}$/i.test(model))throw new Error('INVALID_MODEL');
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),30000);
 try{
  const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{
   method:'POST',signal:controller.signal,
   headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey,
     'HTTP-Referer':process.env.APP_ORIGIN||'https://localhost','X-Title':'Vachaspati AI'},
   body:JSON.stringify({model,temperature:0.5,max_tokens:450,stream:false,messages}),
   cache:'no-store',
  });
  if(!res.ok)throw new Error('OPENROUTER_'+res.status);
  const body=await res.json() as {choices?:Array<{message?:{content?:string|null}}>};
  const answer=body.choices?.[0]?.message?.content?.trim();
  if(!answer)throw new Error('OPENROUTER_EMPTY');
  return answer.slice(0,6000);
 }finally{clearTimeout(timeout);}
}
