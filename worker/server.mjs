// Dedicated long-running native Sherpa-ONNX inference worker.
// Never run on a serverless web host. Install compatible offline model weights separately.
import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sherpa=require('sherpa-onnx-node');
const port=Number(process.env.PORT||8080);
const secret=process.env.SHERPA_WORKER_SECRET;
if(!secret||secret.length<24)throw new Error('SHERPA_WORKER_SECRET must contain at least 24 characters');
if(!process.env.SHERPA_ASR_CONFIG_JSON||!process.env.SHERPA_TTS_CONFIG_JSON)
 throw new Error('Set SHERPA_ASR_CONFIG_JSON and SHERPA_TTS_CONFIG_JSON to installed model configurations');
const voices=JSON.parse(process.env.SHERPA_VOICES_JSON||'{"default":0}');
const recognizer=await sherpa.OfflineRecognizer.createAsync(JSON.parse(process.env.SHERPA_ASR_CONFIG_JSON));
const tts=await sherpa.OfflineTts.createAsync(JSON.parse(process.env.SHERPA_TTS_CONFIG_JSON));

function readWave(bytes){
 if(bytes.length<44||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw new Error('INVALID_WAV');
 let offset=12,format,channels,rate,bits,data;
 while(offset+8<=bytes.length){
  const tag=bytes.toString('ascii',offset,offset+4),n=bytes.readUInt32LE(offset+4),start=offset+8;
  if(start+n>bytes.length)throw new Error('CORRUPT_WAV');
  if(tag==='fmt '){format=bytes.readUInt16LE(start);channels=bytes.readUInt16LE(start+2);rate=bytes.readUInt32LE(start+4);bits=bytes.readUInt16LE(start+14);}
  if(tag==='data')data=bytes.subarray(start,start+n);
  offset=start+n+(n%2);
 }
 if(format!==1||bits!==16||![1,2].includes(channels)||!rate||!data)throw new Error('ONLY_PCM16_WAV');
 const samples=new Float32Array(data.length/(2*channels));
 for(let i=0;i<samples.length;i++){let sum=0;for(let c=0;c<channels;c++)sum+=data.readInt16LE((i*channels+c)*2)/32768;samples[i]=sum/channels;}
 return {samples,sampleRate:rate,duration_seconds:samples.length/rate};
}
function wavBytes(samples,sampleRate){
 const out=Buffer.alloc(44+samples.length*2);
 out.write('RIFF',0);out.writeUInt32LE(out.length-8,4);out.write('WAVE',8);
 out.write('fmt ',12);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);
 out.writeUInt16LE(1,22);out.writeUInt32LE(sampleRate,24);out.writeUInt32LE(sampleRate*2,28);
 out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(samples.length*2,40);
 for(let i=0;i<samples.length;i++)out.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);
 return out;
}
function authorized(req){
 const actual=Buffer.from(req.headers['x-worker-secret']||'');
 const wanted=Buffer.from(secret);
 return actual.length===wanted.length&&timingSafeEqual(actual,wanted);
}
function readBody(req,max){
 return new Promise((resolve,reject)=>{
  const chunks=[];let total=0;
  req.on('data',chunk=>{total+=chunk.length;if(total>max){reject(new Error('BODY_TOO_LARGE'));req.destroy();return;}chunks.push(chunk)});
  req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject);
 });
}
function response(res,status,body,contentType='application/json'){
 res.writeHead(status,{'Content-Type':contentType,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 res.end(contentType==='application/json'?JSON.stringify(body):body);
}
const server=http.createServer(async(req,res)=>{
 if(req.url==='/health'&&req.method==='GET'){response(res,200,{ready:true,asr:true,tts:true});return;}
 if(!authorized(req)){response(res,401,{error:'Unauthorized'});return;}
 try{
  if(req.url==='/transcribe'&&req.method==='POST'){
   const body=await readBody(req,10*1024*1024);
   const wave=readWave(body);
   if(wave.duration_seconds<.1||wave.duration_seconds>120)throw new Error('INVALID_DURATION');
   const stream=recognizer.createStream();
   stream.acceptWaveform({sampleRate:wave.sampleRate,samples:wave.samples});
   const result=await recognizer.decodeAsync(stream);
   const text=result?.text?.trim();
   if(!text){response(res,422,{error:'No speech recognized'});return;}
   response(res,200,{text,duration_seconds:wave.duration_seconds});return;
  }
  if(req.url==='/synthesize'&&req.method==='POST'){
   const body=await readBody(req,16*1024);
   const data=JSON.parse(body.toString('utf8'));
   if(typeof data.text!=='string'||!data.text.trim()||data.text.length>5000)throw new Error('INVALID_TEXT');
   const name=typeof data.voice==='string'&&data.voice?data.voice:'default';
   if(!Object.prototype.hasOwnProperty.call(voices,name)){response(res,400,{error:'Unknown configured speaker'});return;}
   const speaker=Number(voices[name]);
   if(!Number.isSafeInteger(speaker)||speaker<0)throw new Error('INVALID_SPEAKER');
   const generated=await tts.generateAsync({text:data.text,sid:speaker,speed:1.0});
   if(!generated.samples?.length)throw new Error('TTS_EMPTY');
   const wav=wavBytes(generated.samples,generated.sampleRate);
   if(wav.length>12*1024*1024)throw new Error('OUTPUT_TOO_LARGE');
   response(res,200,wav,'audio/wav');return;
  }
  response(res,404,{error:'Not found'});
 }catch(err){
  const bad=/^INVALID_|^ONLY_|^CORRUPT_|^BODY_/.test(String(err.message));
  response(res,bad?400:503,{error:bad?'Invalid audio or request':'Inference failed'});
 }
});
server.requestTimeout=65000;
server.listen(port,'0.0.0.0',()=>console.log('Vachaspati Sherpa worker listening on '+port));
