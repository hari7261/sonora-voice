import 'server-only';
import {database} from './db';
export type Check={service:string;status:'healthy'|'unavailable'|'not_configured'|'degraded';latency_ms:number|null;details:string};
async function probe(service:string,url:string|undefined,headers?:Record<string,string>):Promise<Check>{
 if(!url)return {service,status:'not_configured',latency_ms:null,details:'Provider credentials or URL absent'};
 const started=Date.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
 try{
  const r=await fetch(url,{method:'GET',headers,signal:controller.signal,cache:'no-store'});
  return {service,status:r.ok?'healthy':r.status===401||r.status===403?'degraded':'unavailable',
   latency_ms:Date.now()-started,details:r.ok?'HTTP '+r.status:'HTTP '+r.status};
 }catch{return {service,status:'unavailable',latency_ms:Date.now()-started,details:'Provider unreachable or timed out'};}
 finally{clearTimeout(timer);}
}
export async function actualServiceHealth():Promise<Check[]>{
 const started=Date.now();
 let db:Check;
 try{await database().query('select 1');db={service:'postgres',status:'healthy',latency_ms:Date.now()-started,details:'Database query completed'};}
 catch{db={service:'postgres',status:'unavailable',latency_ms:Date.now()-started,details:'Database unavailable'};}
 const workerUrl=process.env.SHERPA_INFERENCE_URL?new URL('/health',process.env.SHERPA_INFERENCE_URL).toString():undefined;
 const openrouter=process.env.OPENROUTER_API_KEY?{Authorization:'Bearer '+process.env.OPENROUTER_API_KEY}:undefined;
 const razorpay=process.env.RAZORPAY_KEY_ID&&process.env.RAZORPAY_KEY_SECRET?
  {Authorization:'Basic '+Buffer.from(process.env.RAZORPAY_KEY_ID+':'+process.env.RAZORPAY_KEY_SECRET).toString('base64')}:undefined;
 const resend=process.env.RESEND_API_KEY?{Authorization:'Bearer '+process.env.RESEND_API_KEY}:undefined;
 const result=await Promise.all([
  probe('openrouter',openrouter?'https://openrouter.ai/api/v1/models':undefined,openrouter),
  probe('sherpa',workerUrl),
  probe('razorpay',razorpay?'https://api.razorpay.com/v1/orders?count=1':undefined,razorpay),
  probe('resend',resend?'https://api.resend.com/domains':undefined,resend),
 ]);
 return [db,...result];
}
export async function recordedHealth(){
 const results=await actualServiceHealth();
 await database().query(`insert into vachaspati_private.vachaspati_service_checks(service,status,latency_ms,details)
 select value->>'service',value->>'status',nullif(value->>'latency_ms','')::integer,value->>'details'
 from jsonb_array_elements($1::jsonb) as value`,[JSON.stringify(results)]);
 return results;
}
