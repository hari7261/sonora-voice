import 'server-only';
export type WavInfo={seconds:number;sampleRate:number;channels:number;bitsPerSample:number;dataBytes:number};
export function inspectWav(data:Uint8Array):WavInfo{
 if(data.length<44||data.length>10*1024*1024)throw new Error('WAV_SIZE');
 const dv=new DataView(data.buffer,data.byteOffset,data.byteLength);
 const tag=(pos:number)=>String.fromCharCode(...data.slice(pos,pos+4));
 if(tag(0)!=='RIFF'||tag(8)!=='WAVE')throw new Error('INVALID_WAV');
 let pos=12;let fmt:{format:number;sampleRate:number;channels:number;bits:number;byteRate:number}|null=null;
 let bytes=0;
 while(pos+8<=data.length){
  const name=tag(pos),size=dv.getUint32(pos+4,true),start=pos+8;
  if(size>data.length-start)throw new Error('BAD_WAV_CHUNK');
  if(name==='fmt '){
   if(size<16)throw new Error('BAD_WAV_FMT');
   fmt={format:dv.getUint16(start,true),channels:dv.getUint16(start+2,true),
    sampleRate:dv.getUint32(start+4,true),byteRate:dv.getUint32(start+8,true),
    bits:dv.getUint16(start+14,true)};
  }
  if(name==='data')bytes+=size;
  pos=start+size+(size%2);
 }
 if(!fmt||fmt.format!==1||fmt.bits!==16||fmt.channels<1||fmt.channels>2||
    fmt.sampleRate<8000||fmt.sampleRate>48000||bytes===0||
    fmt.byteRate!==fmt.sampleRate*fmt.channels*2)throw new Error('WAV_PCM16_REQUIRED');
 const seconds=bytes/fmt.byteRate;
 if(seconds<0.1||seconds>120)throw new Error('AUDIO_DURATION_LIMIT');
 return {seconds,sampleRate:fmt.sampleRate,channels:fmt.channels,bitsPerSample:fmt.bits,dataBytes:bytes};
}
