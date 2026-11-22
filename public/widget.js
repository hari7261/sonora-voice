(function(){
'use strict';
var script=document.currentScript;
if(!script)return;
var id=script.getAttribute('data-agent-id');
if(!id||!/^[a-f0-9-]{36}$/i.test(id))return;
var base=new URL(script.src).origin;
var api=base+'/api/v1/agents/'+encodeURIComponent(id);
var token,config,opened=false,busy=false,recorder,stream,speechAudio;
var panel,log,input,mic,send,launcher;
function node(tag,cls,label){
 var el=document.createElement(tag);if(cls)el.className=cls;if(label!==undefined)el.textContent=label;return el;
}
function showError(err){append('system',err instanceof Error?err.message:String(err));}
function append(role,text){
 var message=node('div','vch-msg vch-'+role,text);
 log.appendChild(message);log.scrollTop=log.scrollHeight;
}
function setBusy(value){busy=value;if(input)input.disabled=value;if(send)send.disabled=value;if(mic)mic.disabled=value;}
async function request(path,options){
 var res=await fetch(api+path,options);
 if(!res.ok){var data=await res.json().catch(function(){return {}});throw new Error(data.error||'Voice service unavailable');}
 return res;
}
async function sendText(text,withVoice){
 if(busy||!text.trim())return;
 setBusy(true);
 try{
  if(speechAudio){speechAudio.pause();speechAudio=null;}
  append('user',text);
  var result=await (await request('/chat',{method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({text:text,sessionToken:token})})).json();
  token=result.sessionToken;
  append('agent',result.text);
  if(withVoice&&config.voiceReady){
   var audio=await request('/speak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:result.text})});
   var blob=await audio.blob(),url=URL.createObjectURL(blob);
   speechAudio=new Audio(url);
   speechAudio.onended=function(){URL.revokeObjectURL(url)};
   speechAudio.onerror=function(){URL.revokeObjectURL(url)};
   await speechAudio.play();
  }
 }catch(e){showError(e)}
 finally{setBusy(false);}
}
function toWav(buffer){
 var rate=16000;
 var audio=new OfflineAudioContext(1,Math.ceil(buffer.duration*rate),rate);
 var mono=audio.createBuffer(1,buffer.length,buffer.sampleRate);
 var target=mono.getChannelData(0);
 for(var i=0;i<buffer.length;i++){
  var sum=0;for(var c=0;c<buffer.numberOfChannels;c++)sum+=buffer.getChannelData(c)[i];
  target[i]=sum/buffer.numberOfChannels;
 }
 var source=audio.createBufferSource();source.buffer=mono;source.connect(audio.destination);source.start();
 return audio.startRendering().then(function(rendered){
  var samples=rendered.getChannelData(0),view=new DataView(new ArrayBuffer(44+samples.length*2));
  function name(p,s){for(var i=0;i<s.length;i++)view.setUint8(p+i,s.charCodeAt(i));}
  name(0,'RIFF');view.setUint32(4,36+samples.length*2,true);name(8,'WAVE');
  name(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);
  view.setUint16(32,2,true);view.setUint16(34,16,true);
  name(36,'data');view.setUint32(40,samples.length*2,true);
  for(var j=0;j<samples.length;j++){var v=Math.max(-1,Math.min(1,samples[j]));view.setInt16(44+j*2,Math.round(v*32767),true);}
  return new Blob([view.buffer],{type:'audio/wav'});
 });
}
async function toggleMic(){
 if(recorder&&recorder.state==='recording'){recorder.stop();return;}
 if(busy)return;
 try{
  stream=await navigator.mediaDevices.getUserMedia({audio:true});
  recorder=new MediaRecorder(stream);
  var chunks=[];
  recorder.ondataavailable=function(event){if(event.data.size>0)chunks.push(event.data)};
  recorder.onstop=async function(){
   stream.getTracks().forEach(function(t){t.stop()});stream=null;mic.textContent='🎤';
   setBusy(true);
   try{
    var blob=new Blob(chunks,{type:recorder.mimeType});
    var ctx=new (window.AudioContext||window.webkitAudioContext)();
    var decoded=await ctx.decodeAudioData(await blob.arrayBuffer());
    var wav=await toWav(decoded);await ctx.close();
    var form=new FormData();form.append('file',wav,'voice.wav');
    var res=await request('/transcribe',{method:'POST',body:form});
    var text=(await res.json()).text;setBusy(false);
    await sendText(text,true);
   }catch(e){showError(e);setBusy(false);}
  };
  recorder.start();mic.textContent='■';
 }catch(e){showError(e);}
}
function mount(){
 var host=node('div','');host.id='vachaspati-'+id;
 host.style.position='fixed';host.style.bottom='22px';host.style.right='22px';
 host.style.zIndex='2147483000';document.body.appendChild(host);
 var root=host.attachShadow({mode:'open'});
 var css=node('style','',`
 :host{all:initial}*{box-sizing:border-box}button,input{font:inherit}
 .vch-launch{border:0;border-radius:40px;background:var(--vch-color,#161b19);color:white;
 padding:13px 18px;font:600 14px system-ui;box-shadow:0 12px 40px #0003;cursor:pointer}
 .vch-panel{width:min(350px,calc(100vw - 28px));height:min(540px,75vh);background:#fff;color:#151615;
 border:1px solid #e8e8e5;box-shadow:0 18px 60px #0003;border-radius:16px;
 display:none;flex-direction:column;overflow:hidden;margin-bottom:12px;font:14px system-ui}
 .vch-panel.open{display:flex}.vch-top{padding:18px;background:var(--vch-color,#161b19);color:#fff;
 display:flex;justify-content:space-between;align-items:center;font-weight:700}
 .vch-close{background:transparent;border:0;color:inherit;cursor:pointer;font-size:22px}
 .vch-log{display:flex;flex-direction:column;gap:12px;padding:18px;overflow-y:auto;flex:1;min-height:0}
 .vch-msg{max-width:90%;padding:11px 13px;border-radius:12px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
 .vch-agent{background:#f1f2ee;align-self:flex-start}.vch-user{background:var(--vch-color,#161b19);color:white;align-self:flex-end}
 .vch-system{color:#b94337;font-size:12px;text-align:center;align-self:center}
 .vch-form{display:flex;border-top:1px solid #eee;padding:12px;gap:7px}
 .vch-input{border:1px solid #ddd;padding:10px;border-radius:8px;flex:1;min-width:0;color:#111;background:#fff}
 .vch-btn{background:var(--vch-color,#161b19);color:white;border:0;border-radius:8px;padding:10px;cursor:pointer}
 .vch-btn:disabled{opacity:.5;cursor:wait}.vch-btn:focus-visible,.vch-launch:focus-visible{outline:2px solid #7c9d94;outline-offset:3px}
 @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
 `);
 root.appendChild(css);
 launcher=node('button','vch-launch','Speak with Vāchaspati');launcher.type='button';launcher.setAttribute('aria-label','Open voice agent');
 panel=node('div','vch-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Vāchaspati voice agent');
 var top=node('div','vch-top');var title=node('span','','Voice Agent');
 var close=node('button','vch-close','×');close.type='button';close.setAttribute('aria-label','Close assistant');
 top.appendChild(title);top.appendChild(close);
 log=node('div','vch-log');log.setAttribute('aria-live','polite');
 var form=node('form','vch-form');input=node('input','vch-input');input.placeholder='Your message…';input.setAttribute('aria-label','Message');
 mic=node('button','vch-btn','🎤');mic.type='button';mic.setAttribute('aria-label','Start or stop voice recording');
 send=node('button','vch-btn','Send');send.type='submit';
 form.appendChild(input);form.appendChild(mic);form.appendChild(send);
 panel.appendChild(top);panel.appendChild(log);panel.appendChild(form);
 root.appendChild(panel);root.appendChild(launcher);
 launcher.onclick=function(){opened=!opened;panel.classList.toggle('open',opened);launcher.textContent=opened?'Hide assistant':'Speak with Vāchaspati';if(opened)input.focus()};
 close.onclick=function(){opened=false;panel.classList.remove('open');launcher.textContent='Speak with Vāchaspati';launcher.focus()};
 form.onsubmit=function(e){e.preventDefault();var t=input.value.trim();input.value='';void sendText(t,false)};
 mic.onclick=function(){void toggleMic()};
 fetch(api+'/config').then(async function(res){if(!res.ok)throw new Error('Agent not available for this website');
  config=await res.json();title.textContent=config.name||'Voice Agent';
  var color=/^#[a-f0-9]{6}$/i.test(config.accentColor)?config.accentColor:'#161b19';
  host.style.setProperty('--vch-color',color);
  mic.style.display=config.voiceReady&&config.interactionMode!=='text'?'':'none';
  if(config.greeting)append('agent',config.greeting);
 }).catch(function(e){showError(e);input.disabled=true;send.disabled=true;mic.disabled=true});
}
if(document.body)mount();else document.addEventListener('DOMContentLoaded',mount,{once:true});
})();