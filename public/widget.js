(function(){
'use strict';
var script=document.currentScript;
if(!script)return;
var id=script.getAttribute('data-agent-id');
if(!id||!/^[a-f0-9-]{36}$/i.test(id))return;
var base=new URL(script.src).origin;
var api=base+'/api/v1/agents/'+encodeURIComponent(id);
var token,config,opened=false,busy=false,recorder,stream,speechAudio,voiceOut=true;
var panel,body,welcome,log,input,mic,send,launcher,avatar,titleEl,subEl,eyebrowEl,greetEl,footerBrand,typingEl,voiceToggle;

function node(tag,cls,label){
 var el=document.createElement(tag);if(cls)el.className=cls;if(label!==undefined)el.textContent=label;return el;
}
function svgIcon(pathD,size,strokeWidth){
 var ns='http://www.w3.org/2000/svg';
 var svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox','0 0 24 24');
 svg.setAttribute('width',String(size||18));
 svg.setAttribute('height',String(size||18));
 svg.setAttribute('fill','none');
 svg.setAttribute('stroke','currentColor');
 svg.setAttribute('stroke-width',String(strokeWidth||2));
 svg.setAttribute('stroke-linecap','round');
 svg.setAttribute('stroke-linejoin','round');
 svg.setAttribute('aria-hidden','true');
 var paths=Array.isArray(pathD)?pathD:[pathD];
 for(var i=0;i<paths.length;i++){
  var p=document.createElementNS(ns,'path');
  p.setAttribute('d',paths[i]);
  svg.appendChild(p);
 }
 return svg;
}
function setIcon(btn,paths,size){
 btn.textContent='';
 btn.appendChild(svgIcon(paths,size||17,1.9));
}
var ICONS={
 reset:['M3 12a9 9 0 1 0 3-6.7L3 8','M3 3v5h5'],
 close:['M18 6 6 18','M6 6l12 12'],
 mic:['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z','M19 10v2a7 7 0 0 1-14 0v-2','M12 19v3'],
 stop:['M6 6h12v12H6z'],
 arrowUp:['M12 19V5','M5 12l7-7 7 7'],
 arrowNE:['M7 17 17 7','M7 7h10v10'],
 speakerOn:['M11 5 6 9H2v6h4l5 4V5Z','M15.54 8.46a5 5 0 0 1 0 7.07','M19.07 4.93a10 10 0 0 1 0 14.14'],
 speakerOff:['M11 5 6 9H2v6h4l5 4V5Z','M22 9l-6 6','M16 9l6 6']
};

function showChatView(){
 if(welcome)welcome.style.display='none';
 if(log)log.style.display='flex';
}
function showError(err){
 showChatView();
 append('system',err instanceof Error?err.message:String(err));
}
function append(role,text){
 showChatView();
 var wrap=node('div','vch-row vch-row-'+role);
 var message=node('div','vch-msg vch-'+role,text);
 wrap.appendChild(message);
 if(role==='agent'&&config&&config.voiceReady){
  var replay=node('button','vch-replay');
  replay.type='button';
  replay.title='Play voice';
  replay.setAttribute('aria-label','Play voice reply');
  setIcon(replay,ICONS.speakerOn,14);
  replay.onclick=function(){void playSpeech(text);};
  wrap.appendChild(replay);
 }
 log.appendChild(wrap);
 body.scrollTop=body.scrollHeight;
}
function showTyping(show,label){
 if(!typingEl)return;
 if(show){
  showChatView();
  typingEl.textContent='';
  var dots=node('span','vch-dots');
  dots.appendChild(node('i'));dots.appendChild(node('i'));dots.appendChild(node('i'));
  typingEl.appendChild(dots);
  if(label)typingEl.appendChild(node('span','vch-typing-lbl',label));
  typingEl.style.display='inline-flex';
  log.appendChild(typingEl);
  body.scrollTop=body.scrollHeight;
 }else{
  typingEl.style.display='none';
 }
}
function setBusy(value){
 busy=value;
 if(input)input.disabled=value;
 if(send)send.disabled=value;
 if(mic)mic.disabled=value;
}
async function request(path,options){
 var res=await fetch(api+path,options);
 if(!res.ok){var data=await res.json().catch(function(){return {}});throw new Error(data.error||'Service unavailable');}
 return res;
}
async function playSpeech(text){
 if(!config||!config.voiceReady||!text)return;
 if(speechAudio){speechAudio.pause();speechAudio=null;}
 var audio=await request('/speak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text})});
 var blob=await audio.blob(),url=URL.createObjectURL(blob);
 speechAudio=new Audio(url);
 speechAudio.onended=function(){URL.revokeObjectURL(url);};
 speechAudio.onerror=function(){URL.revokeObjectURL(url);};
 await speechAudio.play();
}
async function sendText(text,withVoice){
 if(busy||!text.trim())return;
 setBusy(true);
 try{
  if(speechAudio){speechAudio.pause();speechAudio=null;}
  append('user',text);
  showTyping(true,'Thinking…');
  var result=await (await request('/chat',{method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({text:text,sessionToken:token})})).json();
  token=result.sessionToken;
  showTyping(false);
  append('agent',result.text);
  if((withVoice||voiceOut)&&config&&config.voiceReady&&config.interactionMode!=='text'){
   try{await playSpeech(result.text);}catch(e){showError(e);}
  }
 }catch(e){showTyping(false);showError(e);}
 finally{setBusy(false);if(opened&&input)input.focus();}
}
function resetChat(){
 if(busy)return;
 if(speechAudio){speechAudio.pause();speechAudio=null;}
 token=undefined;
 log.textContent='';
 log.style.display='none';
 if(welcome)welcome.style.display='flex';
 if(config&&config.greeting){
  greetEl.textContent=config.greeting;
 }
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
  recorder.ondataavailable=function(event){if(event.data.size>0)chunks.push(event.data);};
  recorder.onstop=async function(){
   stream.getTracks().forEach(function(t){t.stop();});stream=null;
   mic.classList.remove('recording');
   setIcon(mic,ICONS.mic,18);
   mic.setAttribute('aria-label','Start voice recording');
   setBusy(true);
   showTyping(true,'Transcribing…');
   try{
    var blob=new Blob(chunks,{type:recorder.mimeType});
    var ctx=new (window.AudioContext||window.webkitAudioContext)();
    var decoded=await ctx.decodeAudioData(await blob.arrayBuffer());
    var wav=await toWav(decoded);await ctx.close();
    var form=new FormData();form.append('file',wav,'voice.wav');
    var res=await request('/transcribe',{method:'POST',body:form});
    var text=(await res.json()).text;
    showTyping(false);
    setBusy(false);
    await sendText(text,true);
   }catch(e){showTyping(false);showError(e);setBusy(false);}
  };
  recorder.start();
  mic.classList.add('recording');
  setIcon(mic,ICONS.stop,15);
  mic.setAttribute('aria-label','Stop recording and send');
 }catch(e){showError(e);}
}
function mount(){
 var host=node('div','');host.id='vachaspati-'+id;
 host.style.position='fixed';host.style.bottom='22px';host.style.right='22px';
 host.style.zIndex='2147483000';document.body.appendChild(host);
 var root=host.attachShadow({mode:'open'});
 var css=node('style','',`
 :host{all:initial;--vch-color:#a61d33;--vch-bg:#f8f7f5;--vch-surface:#ffffff;--vch-ink:#18181b;--vch-muted:#71717a;--vch-border:#e6e4e0;}
 *{box-sizing:border-box}
 button,input{font:inherit}
 .vch-wrap{display:flex;flex-direction:column;align-items:flex-end;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,sans-serif;color:var(--vch-ink)}
 .vch-launch{display:inline-flex;align-items:center;gap:10px;border:1px solid #0001;border-radius:999px;background:var(--vch-surface);color:var(--vch-ink);padding:8px 16px 8px 8px;font-weight:600;font-size:14px;box-shadow:0 10px 30px rgba(0,0,0,.14),0 2px 6px rgba(0,0,0,.06);cursor:pointer;transition:transform .16s ease,box-shadow .16s ease}
 .vch-launch:hover{transform:translateY(-2px);box-shadow:0 14px 36px rgba(0,0,0,.18)}
 .vch-launch-badge{width:32px;height:32px;border-radius:999px;background:var(--vch-color);color:#fff;display:grid;place-items:center;font-weight:700;font-size:14px;flex:0 0 auto}
 .vch-panel{width:min(390px,calc(100vw - 24px));height:min(620px,calc(100vh - 96px));background:var(--vch-bg);border:1px solid var(--vch-border);box-shadow:0 24px 64px rgba(0,0,0,.16),0 4px 16px rgba(0,0,0,.06);border-radius:20px;display:none;flex-direction:column;overflow:hidden;margin-bottom:14px}
 .vch-panel.open{display:flex;animation:vchIn .18s ease-out}
 @keyframes vchIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
 .vch-top{padding:14px 16px;background:var(--vch-surface);border-bottom:1px solid var(--vch-border);display:flex;align-items:center;justify-content:space-between;gap:12px}
 .vch-brand{display:flex;align-items:center;gap:11px;min-width:0}
 .vch-avatar{width:38px;height:38px;border-radius:10px;background:var(--vch-color);color:#fff;display:grid;place-items:center;font-weight:700;font-size:18px;font-family:Georgia,serif;flex:0 0 auto;box-shadow:0 2px 8px rgba(0,0,0,.12)}
 .vch-title-col{min-width:0}
 .vch-title{font-weight:700;font-size:16px;line-height:1.2;color:var(--vch-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .vch-status{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--vch-muted);margin-top:2px}
 .vch-dot{width:7px;height:7px;border-radius:999px;background:#22c55e;flex:0 0 auto}
 .vch-head-actions{display:flex;align-items:center;gap:4px}
 .vch-icon-btn{width:32px;height:32px;border-radius:8px;border:0;background:transparent;color:#52525b;display:grid;place-items:center;cursor:pointer;transition:background .12s,color .12s}
 .vch-icon-btn:hover{background:#f1f0ec;color:var(--vch-ink)}
 .vch-icon-btn.muted-voice{color:#a1a1aa}
 .vch-body{flex:1;min-height:0;overflow-y:auto;padding:20px 18px;display:flex;flex-direction:column}
 .vch-welcome{display:flex;flex-direction:column;margin:auto 0;padding:8px 2px}
 .vch-eyebrow{font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--vch-color);text-transform:uppercase;margin-bottom:8px}
 .vch-hero{font-size:26px;font-weight:700;line-height:1.18;letter-spacing:-.02em;color:var(--vch-ink);margin:0 0 10px}
 .vch-sub{font-size:14px;line-height:1.55;color:#52525b;margin:0 0 24px}
 .vch-sug-label{font-size:11px;font-weight:700;letter-spacing:.08em;color:#71717a;text-transform:uppercase;margin-bottom:10px}
 .vch-sugs{display:flex;flex-direction:column;gap:9px}
 .vch-sug{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;background:var(--vch-surface);border:1px solid var(--vch-border);border-radius:12px;padding:13px 14px;color:var(--vch-ink);font-size:13.5px;font-weight:500;cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .12s}
 .vch-sug:hover{border-color:#d4d1ca;box-shadow:0 4px 12px rgba(0,0,0,.04);transform:translateY(-1px)}
 .vch-sug svg{color:#a1a1aa;flex:0 0 auto}
 .vch-log{display:none;flex-direction:column;gap:12px}
 .vch-row{display:flex;flex-direction:column;gap:4px}
 .vch-row-user{align-items:flex-end}
 .vch-row-agent{align-items:flex-start}
 .vch-row-system{align-items:center}
 .vch-msg{max-width:86%;padding:11px 14px;border-radius:14px;line-height:1.5;font-size:13.5px;white-space:pre-wrap;overflow-wrap:anywhere}
 .vch-agent{background:var(--vch-surface);border:1px solid var(--vch-border);color:var(--vch-ink);border-bottom-left-radius:4px}
 .vch-user{background:var(--vch-color);color:#fff;border-bottom-right-radius:4px}
 .vch-system{color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;font-size:12px;padding:7px 12px;border-radius:10px;text-align:center}
 .vch-replay{display:inline-flex;align-items:center;gap:4px;background:transparent;border:0;color:#71717a;cursor:pointer;padding:2px 4px;border-radius:6px;font-size:11px}
 .vch-replay:hover{color:var(--vch-color);background:#eceae4}
 .vch-typing{display:none;align-items:center;gap:8px;background:var(--vch-surface);border:1px solid var(--vch-border);padding:10px 14px;border-radius:14px;border-bottom-left-radius:4px;align-self:flex-start}
 .vch-dots{display:inline-flex;gap:4px;align-items:center}
 .vch-dots i{width:6px;height:6px;border-radius:999px;background:#a1a1aa;display:block;animation:vchBounce 1.1s infinite ease-in-out}
 .vch-dots i:nth-child(2){animation-delay:.15s}.vch-dots i:nth-child(3){animation-delay:.3s}
 @keyframes vchBounce{0%,80%,100%{opacity:.35;transform:scale(.85)}40%{opacity:1;transform:scale(1.1)}}
 .vch-typing-lbl{font-size:12px;color:#71717a}
 .vch-foot{background:var(--vch-surface);border-top:1px solid var(--vch-border);padding:12px 14px 10px}
 .vch-form{display:flex;align-items:center;gap:6px;background:var(--vch-surface);border:1px solid #dfddd7;border-radius:14px;padding:6px 6px 6px 14px;transition:border-color .15s,box-shadow .15s}
 .vch-form:focus-within{border-color:#b8b4ab;box-shadow:0 0 0 3px rgba(0,0,0,.04)}
 .vch-input{border:0;outline:0;background:transparent;flex:1;min-width:0;color:var(--vch-ink);font-size:13.5px;padding:4px 0}
 .vch-input::placeholder{color:#a1a1aa}
 .vch-mic{width:34px;height:34px;border-radius:10px;border:0;background:transparent;color:#71717a;display:grid;place-items:center;cursor:pointer;flex:0 0 auto;transition:background .12s,color .12s}
 .vch-mic:hover{background:#f4f3ef;color:var(--vch-ink)}
 .vch-mic.recording{background:#fee2e2;color:#dc2626;animation:vchPulse 1.2s infinite}
 @keyframes vchPulse{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.35)}50%{box-shadow:0 0 0 6px rgba(220,38,38,0)}}
 .vch-send{width:34px;height:34px;border-radius:10px;border:0;background:var(--vch-color);color:#fff;display:grid;place-items:center;cursor:pointer;flex:0 0 auto;transition:opacity .12s,transform .1s}
 .vch-send:hover:not(:disabled){opacity:.92}
 .vch-send:active:not(:disabled){transform:scale(.96)}
 .vch-send:disabled,.vch-mic:disabled{opacity:.45;cursor:not-allowed}
 .vch-powered{text-align:center;font-size:11.5px;color:#71717a;margin-top:9px}
 .vch-powered strong{color:#3f3f46;font-weight:600}
 .vch-icon-btn:focus-visible,.vch-launch:focus-visible,.vch-send:focus-visible,.vch-mic:focus-visible,.vch-sug:focus-visible{outline:2px solid var(--vch-color);outline-offset:2px}
 @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
 `);
 root.appendChild(css);

 var wrap=node('div','vch-wrap');
 panel=node('div','vch-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-label','AI voice assistant');

 // Header
 var top=node('div','vch-top');
 var brand=node('div','vch-brand');
 avatar=node('div','vch-avatar','A');
 var titleCol=node('div','vch-title-col');
 titleEl=node('div','vch-title','Assistant');
 var statusRow=node('div','vch-status');
 statusRow.appendChild(node('span','vch-dot'));
 subEl=node('span','','AI Assistant');
 statusRow.appendChild(subEl);
 titleCol.appendChild(titleEl);titleCol.appendChild(statusRow);
 brand.appendChild(avatar);brand.appendChild(titleCol);

 var actions=node('div','vch-head-actions');
 voiceToggle=node('button','vch-icon-btn');voiceToggle.type='button';voiceToggle.title='Toggle voice replies';
 voiceToggle.setAttribute('aria-label','Toggle voice replies');
 setIcon(voiceToggle,ICONS.speakerOn,16);
 voiceToggle.style.display='none';
 voiceToggle.onclick=function(){
  voiceOut=!voiceOut;
  voiceToggle.classList.toggle('muted-voice',!voiceOut);
  setIcon(voiceToggle,voiceOut?ICONS.speakerOn:ICONS.speakerOff,16);
  if(!voiceOut&&speechAudio){speechAudio.pause();speechAudio=null;}
 };
 var resetBtn=node('button','vch-icon-btn');resetBtn.type='button';resetBtn.title='New chat';
 resetBtn.setAttribute('aria-label','Start new chat');
 setIcon(resetBtn,ICONS.reset,16);
 resetBtn.onclick=resetChat;

 var close=node('button','vch-icon-btn');close.type='button';close.title='Close';
 close.setAttribute('aria-label','Close assistant');
 setIcon(close,ICONS.close,17);
 actions.appendChild(voiceToggle);actions.appendChild(resetBtn);actions.appendChild(close);
 top.appendChild(brand);top.appendChild(actions);

 // Body + Welcome Screen + Chat Log
 body=node('div','vch-body');
 welcome=node('div','vch-welcome');
 eyebrowEl=node('div','vch-eyebrow','AI ASSISTANT');
 var hero=node('h2','vch-hero','How can I help you?');
 greetEl=node('p','vch-sub','Get answers, explore information, and find the support you need.');
 var sugLabel=node('div','vch-sug-label','SUGGESTED QUESTIONS');
 var sugs=node('div','vch-sugs');
 var prompts=['Ask a question','Find information','Get assistance'];
 for(var i=0;i<prompts.length;i++){
  (function(p){
   var b=node('button','vch-sug');b.type='button';
   b.appendChild(node('span','',p));
   b.appendChild(svgIcon(ICONS.arrowNE,15,1.8));
   b.onclick=function(){void sendText(p,false);};
   sugs.appendChild(b);
  })(prompts[i]);
 }
 welcome.appendChild(eyebrowEl);welcome.appendChild(hero);welcome.appendChild(greetEl);
 welcome.appendChild(sugLabel);welcome.appendChild(sugs);

 log=node('div','vch-log');log.setAttribute('aria-live','polite');
 typingEl=node('div','vch-typing');
 body.appendChild(welcome);body.appendChild(log);

 // Footer Composer
 var foot=node('div','vch-foot');
 var form=node('form','vch-form');
 input=node('input','vch-input');input.placeholder='Message assistant…';input.setAttribute('aria-label','Message');
 mic=node('button','vch-mic');mic.type='button';mic.setAttribute('aria-label','Start voice recording');
 setIcon(mic,ICONS.mic,18);
 send=node('button','vch-send');send.type='submit';send.setAttribute('aria-label','Send message');
 setIcon(send,ICONS.arrowUp,17);
 form.appendChild(input);form.appendChild(mic);form.appendChild(send);
 var powered=node('div','vch-powered');
 powered.appendChild(document.createTextNode('Powered by '));
 footerBrand=node('strong','','Vāchaspati');
 powered.appendChild(footerBrand);
 foot.appendChild(form);foot.appendChild(powered);

 panel.appendChild(top);panel.appendChild(body);panel.appendChild(foot);

 // Launcher Pill
 launcher=node('button','vch-launch');launcher.type='button';launcher.setAttribute('aria-label','Open assistant');
 var lBadge=node('span','vch-launch-badge','A');
 var lText=node('span','','Ask Assistant');
 launcher.appendChild(lBadge);launcher.appendChild(lText);

 wrap.appendChild(panel);wrap.appendChild(launcher);
 root.appendChild(wrap);

 function setOpen(next){
  opened=next;
  panel.classList.toggle('open',opened);
  lText.textContent=opened?'Close':('Ask '+(config&&config.name?config.name:'Assistant'));
  if(opened)setTimeout(function(){input.focus();},50);
  else launcher.focus();
 }
 launcher.onclick=function(){setOpen(!opened);};
 close.onclick=function(){setOpen(false);};
 form.onsubmit=function(e){e.preventDefault();var t=input.value.trim();input.value='';void sendText(t,false);};
 mic.onclick=function(){void toggleMic();};

 fetch(api+'/config').then(async function(res){
  if(!res.ok)throw new Error('Agent not available for this website');
  config=await res.json();
  var agentName=config.name||'Assistant';
  var initial=agentName.trim().charAt(0).toUpperCase()||'A';
  var color=/^#[a-f0-9]{6}$/i.test(config.accentColor)?config.accentColor:'#a61d33';
  host.style.setProperty('--vch-color',color);
  avatar.textContent=initial;
  lBadge.textContent=initial;
  titleEl.textContent=agentName;
  eyebrowEl.textContent=agentName.toUpperCase()+' ASSISTANT';
  input.placeholder='Message '+agentName+'…';
  footerBrand.textContent=agentName;
  lText.textContent=opened?'Close':'Ask '+agentName;
  subEl.textContent=config.voiceReady&&config.interactionMode!=='text'?'Voice & AI Assistant':'AI Assistant';
  if(config.greeting)greetEl.textContent=config.greeting;
  var hasVoice=!!(config.voiceReady&&config.interactionMode!=='text');
  mic.style.display=hasVoice?'':'none';
  voiceToggle.style.display=hasVoice?'':'none';
 }).catch(function(e){
  showError(e);input.disabled=true;send.disabled=true;mic.disabled=true;
 });
}
if(document.body)mount();else document.addEventListener('DOMContentLoaded',mount,{once:true});
})();
