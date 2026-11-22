'use client';
import {useCallback,useEffect,useState} from 'react';
import {motion,AnimatePresence} from 'motion/react';
import {ArrowRight,Clipboard,Check,KeyRound,Mic2,ShieldCheck} from 'lucide-react';
type Agent={id:string;name:string;status:string;instructions:string;llm_model:string;language_code:string;greeting:string;accent_color:string;voice_id:string|null;interaction_mode:string;domains:string[]};
type Key={id:string;label:string;key_prefix:string;scopes:string[];revoked_at:string|null;created_at:string};
type Usage={balance:null|{remaining:string;monthly_credits:string;used_today:string;used_week:string;used_month:string;plan_name:string};usage:Array<{request_id:string;credits:number;status_code:number;created_at:string}>};
async function api<T>(url:string,method='GET',body?:object):Promise<T>{
 const r=await fetch(url,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const result=await r.json() as T & {error?:string};
 if(!r.ok)throw new Error(result.error||'Request failed');
 return result;
}
function CopyCode({text}:{text:string}){
 const [done,setDone]=useState(false);
 async function copy(){await navigator.clipboard.writeText(text);setDone(true);setTimeout(()=>setDone(false),1800);}
 return <button className="button button-outline" type="button" onClick={copy}>{done?<Check size={16}/>:<Clipboard size={16}/>} {done?'Copied':'Copy'}</button>;
}
function AgentEditor({agent,onSaved}:{agent:Agent;onSaved:()=>void}){
 const [name,setName]=useState(agent.name),[instructions,setInstructions]=useState(agent.instructions),
 [llmModel,setLlmModel]=useState(agent.llm_model||''),[greeting,setGreeting]=useState(agent.greeting||''),
 [domains,setDomains]=useState(agent.domains.join('\n')),[language,setLanguage]=useState(agent.language_code),
 [voiceId,setVoiceId]=useState(agent.voice_id||''),[status,setStatus]=useState(agent.status),
 [mode,setMode]=useState(agent.interaction_mode),[color,setColor]=useState(agent.accent_color);
 const [error,setError]=useState(''),[saving,setSaving]=useState(false);
 const embed=typeof window==='undefined'?'':`<script src="${window.location.origin}/widget.js" data-agent-id="${agent.id}" async></script>`;
 async function save(){
  setSaving(true);setError('');
  try{
   await api('/api/console/agents/'+agent.id,'PATCH',{
    name,instructions,llmModel,greeting,language,voiceId,interactionMode:mode,
    accentColor:color,status,domains:domains.split(/[\n,]/).map(d=>d.trim()).filter(Boolean)
   });
   onSaved();
  }catch(e){setError((e as Error).message);}
  finally{setSaving(false);}
 }
 async function remove(){
  if(!window.confirm('Delete this agent and its conversation history?'))return;
  try{await api('/api/console/agents/'+agent.id,'DELETE');onSaved();}
  catch(e){setError((e as Error).message);}
 }
 return <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="console-agent-editor">
  <h3>{agent.name}</h3><span className="micro muted">Agent ID: {agent.id}</span>
  <div className="console-fields">
   <label>Agent name<input value={name} onChange={e=>setName(e.target.value)} maxLength={90}/></label>
   <label>OpenRouter model ID<input value={llmModel} onChange={e=>setLlmModel(e.target.value)} placeholder="Provider/model-name" required/></label>
   <label>Language<input value={language} onChange={e=>setLanguage(e.target.value)} placeholder="en"/></label>
   <label>Voice ID (configured on inference worker)<input value={voiceId} onChange={e=>setVoiceId(e.target.value)} placeholder="default"/></label>
   <label>Interaction mode<select value={mode} onChange={e=>setMode(e.target.value)}><option value="voice-text">Voice and text</option><option value="text">Text only</option><option value="voice">Voice only</option></select></label>
   <label>Accent color<input type="color" value={color} onChange={e=>setColor(e.target.value)}/></label>
  </div>
  <label>Agent instructions<textarea rows={5} value={instructions} onChange={e=>setInstructions(e.target.value)} maxLength={10000} placeholder="How should the agent assist visitors?"/></label>
  <label>Greeting<textarea rows={2} value={greeting} onChange={e=>setGreeting(e.target.value)} maxLength={300}/></label>
  <label>Allowed domains (one per line)<textarea rows={3} value={domains} onChange={e=>setDomains(e.target.value)} placeholder="example.com"/></label>
  <label>Publishing status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="draft">Draft</option><option value="active">Published</option><option value="paused">Paused</option></select></label>
  {error&&<p className="auth-error" role="alert">{error}</p>}
  <div className="console-actions"><button className="button button-dark" disabled={saving} onClick={save}>{saving?'Saving…':'Save changes'} <ArrowRight size={16}/></button><button className="button button-outline" onClick={remove}>Delete agent</button></div>
  <p className="micro muted">Published agents require an allowed domain and configured OpenRouter model. Audio additionally requires a deployed Sherpa worker.</p>
  <div className="console-code"><strong>Website embed</strong><pre>{embed}</pre><CopyCode text={embed}/></div>
 </motion.div>;
}
export function Console(){
 const [agents,setAgents]=useState<Agent[]>([]),[keys,setKeys]=useState<Key[]>([]),
 [usage,setUsage]=useState<Usage|null>(null),[active,setActive]=useState<'agents'|'keys'|'usage'>('agents'),
 [selected,setSelected]=useState<string|null>(null),[label,setLabel]=useState(''),
 [name,setName]=useState(''),[model,setModel]=useState(''),[newKey,setNewKey]=useState(''),
 [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),
 [loading,setLoading]=useState(true);
 const load=useCallback(async()=>{
  try{
   const [a,k,u]=await Promise.all([
    api<{agents:Agent[]}>('/api/console/agents'),
    api<{keys:Key[]}>('/api/console/keys'),
    api<Usage>('/api/console/usage')
   ]);
   setAgents(a.agents);setKeys(k.keys);setUsage(u);setError('');
  }catch(e){setError((e as Error).message);}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load()},[load]);
 async function createAgent(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   const created=await api<{id:string}>('/api/console/agents','POST',{name,llmModel:model,language:'en'});
   setName('');setModel('');setSelected(created.id);setNotice('Agent created. Add instructions and allowed domains before publishing.');
   await load();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function issueKey(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');setNewKey('');
  try{
   const created=await api<{key:string}>('/api/console/keys','POST',
     {label,scopes:['audio:write','usage:read']});
   setNewKey(created.key);setLabel('');await load();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function revoke(id:string){
  if(!window.confirm('Revoke this API key immediately?'))return;
  try{await api('/api/console/keys/'+id,'DELETE');await load();}
  catch(e){setError((e as Error).message);}
 }
 return <div className="console">
  <div className="console-tabs">{([['agents','Voice agents'],['keys','API keys'],['usage','Credits & usage']] as const).map(([key,title])=><button type="button" key={key} onClick={()=>{setActive(key);setError('')}} className={active===key?'active':''}>{title}</button>)}</div>
  {loading&&<p>Loading your workspace data…</p>}
  {error&&<p className="auth-error" role="alert">{error}</p>}
  {notice&&<p className="console-notice">{notice}</p>}
  {active==='agents'&&<div className="console-grid">
   <div className="console-panel">
    <h2><Mic2 size={22}/> Your agents</h2>
    {agents.length===0?<p className="muted">No agents yet. Create your first one below.</p>:
      agents.map(a=><button className={'console-agent-item '+(selected===a.id?'active':'')} key={a.id} onClick={()=>setSelected(a.id)}><strong>{a.name}</strong><span>{a.status}</span></button>)}
    <form onSubmit={createAgent} className="console-form">
     <h3>Create agent</h3>
     <label>Agent name<input value={name} onChange={e=>setName(e.target.value)} required placeholder="Support assistant"/></label>
     <label>OpenRouter model<input value={model} onChange={e=>setModel(e.target.value)} required placeholder="Provider/model-name"/></label>
     <button className="button button-dark" disabled={busy} type="submit">{busy?'Creating…':'Create agent'} <ArrowRight size={16}/></button>
    </form>
   </div>
   <div className="console-panel">{selected&&agents.find(a=>a.id===selected)?
    <AgentEditor key={selected} agent={agents.find(a=>a.id===selected)!} onSaved={()=>void load()}/>:
    <div className="console-empty"><ShieldCheck size={36}/><h3>Choose an agent</h3><p>Select an existing agent to edit it, publish it, and get a live website embed snippet.</p></div>}
   </div>
  </div>}
  {active==='keys'&&<div className="console-panel">
   <h2><KeyRound size={22}/> Developer API keys</h2>
   <p>Create a private key for server-side speech requests and credit usage. It is displayed only once.</p>
   <form className="console-form console-form-row" onSubmit={issueKey}>
    <label>Key label<input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Production backend" required maxLength={80}/></label>
    <button className="button button-dark" type="submit" disabled={busy}>{busy?'Creating…':'Create API key'}</button>
   </form>
   {newKey&&<div className="console-secret"><strong>Save this key now — it will not be shown again.</strong><code>{newKey}</code><CopyCode text={newKey}/></div>}
   <div>{keys.length===0?<p className="muted">No keys issued yet.</p>:keys.map(k=><div className="console-key-row" key={k.id}>
    <span><strong>{k.label}</strong><small>{k.key_prefix}… · {k.revoked_at?'Revoked':'Active'}</small></span>
    {!k.revoked_at&&<button className="button button-outline" onClick={()=>void revoke(k.id)}>Revoke</button>}
   </div>)}</div>
  </div>}
  {active==='usage'&&<div className="console-panel">
   <h2>Actual credits & API usage</h2>
   {!usage?.balance?<p>No active subscription plan is configured for this workspace.</p>:<>
     <div className="console-metrics">{([
      ['Plan',usage.balance.plan_name],['Remaining',usage.balance.remaining],
      ['Used today',usage.balance.used_today],['Used this week',usage.balance.used_week],
      ['Used this month',usage.balance.used_month],['Monthly allowance',usage.balance.monthly_credits]
     ]).map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>
     <h3>Recent requests</h3>
     {usage.usage.length===0?<p className="muted">No billable requests yet.</p>:
      <div className="console-requests">{usage.usage.map(u=><div key={u.request_id}><span>{new Date(u.created_at).toLocaleString()}</span><span>HTTP {u.status_code}</span><strong>{u.credits} credits</strong></div>)}</div>}
   </>}
   <button className="button button-outline" onClick={()=>void load()}>Refresh usage</button>
  </div>}
 </div>;
}
