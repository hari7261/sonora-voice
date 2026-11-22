'use client';
import {useState,useEffect} from 'react';
import {motion,AnimatePresence} from 'motion/react';
import Link from 'next/link';
import {ArrowUpRight,AudioLines,Check,ChevronDown,Clipboard,Code2,Mic,Pause,Play,Send,Volume2,X,SlidersHorizontal} from 'lucide-react';
import {faq} from '../lib/data';
export function Copy({value,label='Copy'}:{value:string,label?:string}){const [copied,setCopied]=useState(false);return <button className="copy-btn" onClick={async()=>{await navigator.clipboard.writeText(value);setCopied(true);setTimeout(()=>setCopied(false),1800)}}>{copied?<Check size={14}/>:<Clipboard size={14}/>} {copied?'Copied':label}</button>}
const samples={stt:{before:'[00:00] “hey I just wanted to um check if the meeting has moved to tomorrow at ten”',after:'I just wanted to check if the meeting has moved to tomorrow at 10.'},tts:{before:'“Your order has shipped. You can track it from your dashboard.”',after:'Voice preview ready · English · Natural pace'},agent:{before:'Visitor: “Can your API work with our existing support bot?”',after:'Agent: “Yes. You can bring your own OpenRouter model and add speech input and output with the Vāchaspati AI voice pipeline.”'}};
export function Playground(){const [tab,setTab]=useState<'stt'|'tts'|'agent'>('stt'),[playing,setPlaying]=useState(false);const selected=samples[tab];return <div className="playground"><div className="playground-top"><div className="inline"><span className="live-dot"/> PRODUCT SANDBOX <span className="muted">/ UI PREVIEW</span></div><span className="micro muted">No API requests made</span></div><div className="playground-tabs">{([['stt','Transcribe'],['tts','Synthesize'],['agent','Converse']] as const).map(([k,v])=><button className={tab===k?'selected':''} key={k} onClick={()=>{setTab(k);setPlaying(false)}}>{v}</button>)}</div><div className="playground-content"><div className="pane-label">INPUT <span>01</span></div><motion.div key={tab+"-input"} initial={{opacity:0,y:9}} animate={{opacity:1,y:0}} transition={{duration:.3}} className="input-example">{selected.before}</motion.div><div className="wave-wrap"><Wave/><button className="round-play" aria-label={playing?'Pause animation':'Play animation'} onClick={()=>setPlaying(!playing)}>{playing?<Pause size={16}/>:<Play size={16}/>}</button><span className="micro muted">{playing?'Playing visual preview':'Sample audio waveform'}</span></div><div className="pane-label pane-label-bottom">OUTPUT <span>02</span></div><motion.div key={tab+"-output"} initial={{opacity:0,y:9}} animate={{opacity:1,y:0}} transition={{duration:.36,delay:.08}} className="output-example">{selected.after}</motion.div></div><div className="playground-foot"><span>Built around Sherpa-ONNX</span><Link href="/models">Explore models <ArrowUpRight size={14}/></Link></div></div>}
export function Wave({count=55}:{count?:number}){return <div className="waveform" aria-hidden="true">{Array.from({length:count},(_,i)=><i key={i} style={{height:`${12+Math.round(Math.abs(Math.sin(i*.79)*Math.cos(i*.19))*56)}%`}}/>)}</div>}
export function VoiceAgent({floating=false}:{floating?:boolean}){
 const agentId=process.env.NEXT_PUBLIC_VACHASPATI_DEMO_AGENT_ID;
 const [config,setConfig]=useState<{name:string;greeting:string}|null>(null);
 const [open,setOpen]=useState(!floating),[input,setInput]=useState(''),[error,setError]=useState(''),
 [busy,setBusy]=useState(false),[token,setToken]=useState<string|undefined>(),
 [messages,setMessages]=useState<{role:string;text:string}[]>([]);
 useEffect(()=>{if(!agentId)return;
  fetch('/api/v1/agents/'+agentId+'/config',{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error('Demo agent unavailable');return r.json()})
   .then(c=>{setConfig(c);if(c.greeting)setMessages([{role:'agent',text:c.greeting}])})
   .catch(e=>setError((e as Error).message));
 },[agentId]);
 async function submit(value=input){
  const question=value.trim();if(!question||busy||!agentId)return;
  setInput('');setError('');setBusy(true);
  setMessages(m=>[...m,{role:'user',text:question}]);
  try{
   const result=await fetch('/api/v1/agents/'+agentId+'/chat',{method:'POST',
     headers:{'Content-Type':'application/json'},body:JSON.stringify({text:question,sessionToken:token})});
   const data=await result.json();
   if(!result.ok)throw new Error(data.error||'Agent unavailable');
   setToken(data.sessionToken);setMessages(m=>[...m,{role:'agent',text:data.text}]);
  }catch(e){setError((e as Error).message);}finally{setBusy(false)}
 }
 if(!agentId)return <div className={floating?'floating-widget':'agent-card'}>
  <div className="agent-head"><div className="agent-avatar"><AudioLines size={20}/></div><div><strong>Live agent setup</strong><span>Production integration</span></div></div>
  <div className="agent-body"><p>A live public demo agent has not been published yet. Create an agent, configure OpenRouter and add this website to its allowed domains.</p></div>
  <div className="agent-options"><Link className="button button-dark" href="/dashboard">Create a real agent <ArrowUpRight size={14}/></Link></div>
 </div>;
 return <div className={floating?'floating-widget':'agent-card'}>
 {floating&&!open?<button className="floating-launch" onClick={()=>setOpen(true)}><AudioLines size={23}/>Ask Vāchaspati AI</button>:<>
 <div className="agent-head"><div className="agent-avatar"><AudioLines size={20}/></div><div><strong>{config?.name||'Voice agent'}</strong><span>{config?'Connected agent':'Connecting…'}</span></div><div className="agent-head-actions">{floating&&<button aria-label="Close assistant" onClick={()=>setOpen(false)}><X size={16}/></button>}</div></div>
 <div className="agent-body"><div className="agent-status">LIVE AI CONVERSATION</div>{messages.map((m,i)=><motion.div key={i} initial={{opacity:0,y:9}} animate={{opacity:1,y:0}} className={'agent-message '+(m.role==='user'?'user-message':'bot-message')}>{m.text}</motion.div>)}{error&&<div className="auth-error" role="alert">{error}</div>}</div>
 <form className="agent-input" onSubmit={e=>{e.preventDefault();void submit()}}><input aria-label="Message for AI agent" disabled={!config||busy} value={input} onChange={e=>setInput(e.target.value)} placeholder={busy?'Thinking…':'Ask a question…'}/><button type="submit" disabled={busy||!config} aria-label="Send message"><Send size={17}/></button></form>
 </>}</div>
}
export function FAQList({limit}:{limit?:number}){const [open,setOpen]=useState<number|null>(0);return <div className="faq-list">{faq.slice(0,limit).map((f,i)=><div key={f.q} className={'faq-item '+(open===i?'faq-open':'')}><button onClick={()=>setOpen(open===i?null:i)} aria-expanded={open===i}><span>{f.q}</span><ChevronDown size={19}/></button><AnimatePresence initial={false}>{open===i&&<motion.p initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} transition={{duration:.25}}>{f.a}</motion.p>}</AnimatePresence></div>)}</div>}
export function PricingCards(){
 const [plans,setPlans]=useState<{code:string;name:string;monthly_credits:string;daily_limit:string;weekly_limit:string;concurrency_limit:number}[]>([]);
 const [error,setError]=useState('');
 useEffect(()=>{fetch('/api/public/catalog').then(async r=>{if(!r.ok)throw new Error('Pricing catalog unavailable');return r.json()})
   .then(data=>setPlans(data.plans||[])).catch(e=>setError((e as Error).message))},[]);
 if(error)return <p className="center-note">{error}</p>;
 if(!plans.length)return <p className="center-note">No subscription plans are currently published.</p>;
 return <><div className="pricing-grid">{plans.map(p=><motion.div key={p.code} whileHover={{y:-6}} className="pricing-card">
  <div className="pricing-name">{p.name}</div><div className="pricing-price">{Number(p.monthly_credits).toLocaleString()} <span>credits / month</span></div>
  <p>Plan allowances are stored in the database and enforced by the API.</p>
  <Link href="/signup" className="button button-dark">Create account <ArrowUpRight size={16}/></Link>
  <div className="pricing-divider"/>
  <div className="pricing-feature"><Check size={16}/>{p.daily_limit} daily credits</div>
  <div className="pricing-feature"><Check size={16}/>{p.weekly_limit} weekly credits</div>
  <div className="pricing-feature"><Check size={16}/>{p.concurrency_limit} concurrency limit</div>
 </motion.div>)}</div><p className="center-note">Usage plans are live database values. Payment processing and paid subscriptions are not yet enabled.</p></>
}
export function EmbedBuilder(){
 return <div className="builder-grid"><div className="builder-form">
 <span className="eyebrow">01 / CREATE</span><h3>Publish a real voice agent.</h3>
 <p>Create an account, configure the OpenRouter model and instructions, add allowed domains, and publish your agent.</p>
 <Link className="button button-dark" href="/dashboard">Open agent builder <ArrowUpRight size={16}/></Link>
 <p className="micro muted">Agent settings, approved domains and generated IDs are stored in PostgreSQL — not hardcoded.</p>
 </div><div className="builder-preview"><span className="eyebrow">02 / INTEGRATE</span>
 <h3>Copy your unique script tag.</h3>
 <p>Each published agent receives an embed snippet with its real ID from your dashboard. Install the widget on any approved domain for live text and voice conversations.</p>
 <p className="micro muted">Speech requires the separate Sherpa-ONNX inference worker. OpenRouter credentials must be configured for responses.</p>
 </div></div>;
}
