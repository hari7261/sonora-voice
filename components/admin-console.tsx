'use client';
import {useCallback,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {AdminTicketDetail} from './admin-ticket';
import {motion,AnimatePresence} from 'motion/react';
import {Activity,AlertTriangle,BarChart3,Box,Check,ChevronRight,ClipboardList,CreditCard,Database,KeyRound,Layers,LockKeyhole,Settings2,Shield,Users,Wallet,Workflow} from 'lucide-react';
type Role='superadmin'|'operations'|'support'|'finance'|'analyst';
type Section='overview'|'users'|'admins'|'accounts'|'agents'|'models'|'plans'|'rates'|'packages'|'payments'|'usage'|'api_keys'|'settings'|'incidents'|'tickets'|'announcements'|'health'|'audit';
type AdminData={data?:Array<Record<string,unknown>>;stats?:Record<string,unknown>;integrations?:Record<string,boolean>};
const icons:Record<Section,React.ElementType>={
 overview:Activity,users:Users,admins:Shield,accounts:Box,agents:Workflow,models:Layers,
 tickets:ClipboardList,announcements:Layers,health:Activity,
 plans:Wallet,rates:BarChart3,packages:CreditCard,payments:CreditCard,usage:Activity,
 api_keys:KeyRound,settings:Settings2,incidents:AlertTriangle,audit:ClipboardList
};
const names:Record<Section,string>={
 overview:'Overview',users:'Users',admins:'Admin roles',accounts:'Workspaces',
 agents:'Agents',models:'Models',plans:'Plans',rates:'Credit rates',
 packages:'Credit packages',payments:'Payments',usage:'API usage',api_keys:'API keys',
 settings:'Platform settings',incidents:'Incidents',tickets:'Support tickets',announcements:'Announcements',health:'Live service health',audit:'Audit trail'
};
const available:Record<Role,Section[]>={
 superadmin:['overview','users','admins','accounts','agents','models','plans','rates','packages','payments','usage','api_keys','settings','incidents','tickets','announcements','health','audit'],
 operations:['overview','users','accounts','agents','models','usage','api_keys','settings','incidents','tickets','announcements','health'],
 support:['overview','users','accounts','agents','api_keys','incidents','tickets'],
 finance:['overview','accounts','plans','rates','packages','payments','usage'],
 analyst:['overview','users','accounts','agents','models','plans','rates','packages','payments','usage','settings','incidents','tickets','announcements','health','audit']
};
async function request<T>(url:string,method='GET',body?:Record<string,unknown>):Promise<T>{
 const r=await fetch(url,{method,cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
 const d=await r.json() as T&{error?:string};if(!r.ok)throw new Error(d.error||'Request failed');return d;
}
function short(value:unknown){
 if(value===null||value===undefined)return '—';
 if(typeof value==='object')return JSON.stringify(value).slice(0,95);
 if(typeof value==='boolean')return value?'Enabled':'Disabled';
 const t=String(value);return t.length>96?t.slice(0,93)+'…':t;
}
function badgeStatus(k:string,val:unknown){return (k==='status'||k==='active'||k==='enabled')&&val!==null;}
function EditAction({label,onCommit,fields}:{label:string;onCommit:(data:Record<string,unknown>)=>Promise<void>;fields:{name:string;label:string;type?:'text'|'number'|'select'|'textarea';options?:string[];defaultValue?:string|number;required?:boolean}[]}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[values,setValues]=useState<Record<string,string>>({});
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');
  try{
   const payload:Record<string,unknown>={};
   for(const f of fields){const raw=values[f.name]??String(f.defaultValue??'');
    payload[f.name]=f.type==='number'?Number(raw):raw==='true'&&f.type==='select'?true:raw==='false'&&f.type==='select'?false:raw;}
   await onCommit(payload);setOpen(false);setValues({});
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <div className="admin-action"><button type="button" className="admin-inline-btn" onClick={()=>setOpen(x=>!x)}>{label}</button>
 {open&&<form onSubmit={save} className="admin-action-form">
 {fields.map(f=><label key={f.name}>{f.label}
 {f.type==='select'?<select value={values[f.name]??String(f.defaultValue??'')} onChange={e=>setValues(p=>({...p,[f.name]:e.target.value}))} required>{(f.options||[]).map(o=><option key={o} value={o}>{o}</option>)}</select>:
 f.type==='textarea'?<textarea required={f.required} value={values[f.name]??String(f.defaultValue??'')} onChange={e=>setValues(p=>({...p,[f.name]:e.target.value}))}/>:
 <input type={f.type==='number'?'number':'text'} required={f.required!==false} value={values[f.name]??String(f.defaultValue??'')} onChange={e=>setValues(p=>({...p,[f.name]:e.target.value}))}/>}
 </label>)}
 {error&&<span className="auth-error">{error}</span>}
 <button className="button button-dark" disabled={busy} type="submit">{busy?'Saving…':'Confirm change'}</button>
 <button className="button button-outline" type="button" onClick={()=>setOpen(false)}>Cancel</button>
 </form>}</div>;
}
const inputConfigs:Partial<Record<Section,{field:string;label:string;type?:'text'|'number'|'select'|'textarea';options?:string[]}[]>>={
 models:[{field:'id',label:'Model identifier'},{field:'name',label:'Model name'},{field:'capability',label:'Capability',type:'select',options:['stt','tts','agent','v2v','multilingual']},{field:'description',label:'Description',type:'textarea'}],
 plans:[{field:'code',label:'Plan code'},{field:'name',label:'Name'},{field:'monthly_credits',label:'Monthly credits',type:'number'},
 {field:'daily_limit',label:'Daily limit',type:'number'},{field:'weekly_limit',label:'Weekly limit',type:'number'},
 {field:'monthly_limit',label:'Monthly limit',type:'number'},{field:'concurrency_limit',label:'Concurrent requests',type:'number'}],
 packages:[{field:'name',label:'Package name'},{field:'description',label:'Description'},{field:'credits',label:'Credits',type:'number'},{field:'price_paise',label:'Price in INR paise',type:'number'}],
 incidents:[{field:'name',label:'Incident title'},{field:'severity',label:'Severity',type:'select',options:['low','medium','high','critical']},{field:'details',label:'Details',type:'textarea'}],
 announcements:[{field:'name',label:'Title'},{field:'content',label:'Announcement text',type:'textarea'},{field:'audience',label:'Audience',type:'select',options:['all','developers','billing']}],
 admins:[{field:'user_id',label:'Existing user UUID'},{field:'role',label:'Admin role',type:'select',options:['superadmin','operations','support','finance','analyst']}]
};
function CreateRecord({section,save}:{section:Section;save:(d:Record<string,unknown>)=>Promise<void>}){
 const fields=inputConfigs[section];const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),
 [error,setError]=useState(''),[form,setForm]=useState<Record<string,string>>({});
 if(!fields)return null;
 async function submit(e:React.FormEvent){e.preventDefault();setError('');setBusy(true);
  try{const payload:Record<string,unknown>={};for(const f of fields){const v=form[f.field]??f.options?.[0]??'';payload[f.field]=f.type==='number'?Number(v):v;}
   await save(payload);setOpen(false);setForm({});}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <div className="admin-create"><button className="button button-dark" onClick={()=>setOpen(o=>!o)}>{open?'Close form':section==='admins'?'Grant admin access':section==='incidents'?'Open incident':'Create '+names[section].toLowerCase()}</button>
 {open&&<form onSubmit={submit} className="admin-create-form"><h3>{section==='admins'?'Grant an existing user a role':'New '+names[section]}</h3><div className="admin-form-grid">
 {fields.map(f=><label key={f.field}>{f.label}
 {f.type==='select'?<select value={form[f.field]??f.options?.[0]} onChange={e=>setForm(v=>({...v,[f.field]:e.target.value}))}>{f.options?.map(o=><option key={o} value={o}>{o}</option>)}</select>:
 f.type==='textarea'?<textarea required value={form[f.field]??''} onChange={e=>setForm(v=>({...v,[f.field]:e.target.value}))}/>:
 <input type={f.type==='number'?'number':'text'} required min={f.type==='number'?0:undefined} value={form[f.field]??''} onChange={e=>setForm(v=>({...v,[f.field]:e.target.value}))}/>}
 </label>)}</div>{error&&<p className="auth-error">{error}</p>}
 <button className="button button-dark" type="submit" disabled={busy}>{busy?'Saving…':'Save record'}</button></form>}</div>;
}
export function AdminConsole({role}:{role:Role}){
 const router=useRouter(),[section,setSection]=useState<Section>('overview'),[rows,setRows]=useState<Array<Record<string,unknown>>>([]),
 [stats,setStats]=useState<Record<string,unknown>>({}),[integrations,setIntegrations]=useState<Record<string,boolean>>({}),
 [loading,setLoading]=useState(true),[ticketId,setTicketId]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[offset,setOffset]=useState(0);
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const data=await request<AdminData>('/api/admin/'+section+'?limit=50&offset='+offset);
   setRows(data.data||[]);setStats(data.stats||{});setIntegrations(data.integrations||{});
  }catch(e){setError((e as Error).message)}finally{setLoading(false)}
 },[section,offset]);
 useEffect(()=>{void load()},[load]);
 function tab(value:Section){setSection(value);setOffset(0);setTicketId('');setNotice('');}
 async function change(section:Section,id:string,payload:Record<string,unknown>){
  await request('/api/admin/'+section+'/'+encodeURIComponent(id),'PATCH',payload);
  setNotice('Change recorded in the administrative audit log.');await load();
 }
 async function create(payload:Record<string,unknown>){
  await request('/api/admin/'+section,'POST',payload);setNotice('Record created.');await load();
 }
 async function signOut(){await request('/api/admin/auth/logout','POST');router.replace('/superadmin/login');router.refresh();}
 function controls(row:Record<string,unknown>){
  const id=String(row.id||row.user_id||row.key||row.capability||'');
  const choices:React.ReactNode[]=[];
  const control=(title:string,data:Record<string,unknown>)=><button className="admin-inline-btn" onClick={async()=>{if(!window.confirm(title+'?'))return;try{await change(section,id,data)}catch(e){setError((e as Error).message)}}}>{title}</button>;
  if(section==='users'&&['superadmin','support'].includes(role))choices.push(control(row.disabled_at?'Reactivate':'Suspend account',{disabled:!row.disabled_at}));
  if(section==='admins'&&role==='superadmin')choices.push(<EditAction label="Edit access" onCommit={d=>change(section,id,d)} fields={[
   {name:'active',label:'Active',type:'select',options:['true','false'],defaultValue:String(row.active)},
   {name:'role',label:'Role',type:'select',options:['superadmin','operations','support','finance','analyst'],defaultValue:String(row.role)}]}/>);
  if(section==='agents'&&['superadmin','operations'].includes(role))choices.push(<EditAction label="Change status" onCommit={d=>change(section,id,d)} fields={[{name:'status',label:'Status',type:'select',options:['draft','active','paused'],defaultValue:String(row.status)}]}/>);
  if(section==='models'&&['superadmin','operations'].includes(role))choices.push(control(row.enabled?'Disable model':'Enable model',{enabled:!row.enabled}));
  if(section==='packages'&&['superadmin','finance'].includes(role))choices.push(control(row.enabled?'Unpublish':'Publish',{enabled:!row.enabled}));
  if(section==='plans'&&['superadmin','finance'].includes(role)){
   choices.push(control(row.enabled?'Disable':'Enable',{enabled:!row.enabled}));
   choices.push(<EditAction label="Change allowances" onCommit={d=>change(section,id,d)} fields={['monthly_credits','daily_limit','weekly_limit','monthly_limit','concurrency_limit'].map(k=>({name:k,label:k.replaceAll('_',' '),type:'number' as const,defaultValue:Number(row[k]||0)}))}/>);
  }
  if(section==='rates'&&['superadmin','finance'].includes(role))choices.push(<EditAction label="Change rates" onCommit={d=>change(section,String(row.capability),d)} fields={[
   {name:'unit_size',label:'Units per charge',type:'number',defaultValue:Number(row.unit_size)},
   {name:'credits_per_unit',label:'Credits per unit',type:'number',defaultValue:Number(row.credits_per_unit)},
   {name:'enabled',label:'Enabled',type:'select',options:['true','false'],defaultValue:String(row.enabled)}]}/>);
  if(section==='accounts'&&['superadmin','finance'].includes(role)){
   choices.push(<EditAction label="Adjust wallet" onCommit={d=>change(section,id,d)} fields=[
    {name:'wallet_adjustment',label:'Signed credit adjustment (+/-)',type:'number',defaultValue:0},
    {name:'reason',label:'Auditable reason (10+ chars)'}]}/>);
   choices.push(<EditAction label="Assign plan" onCommit={d=>change(section,id,d)} fields={[{name:'plan_id',label:'Plan UUID'}]}/>);
  }
  if(section==='api_keys'&&['superadmin','operations'].includes(role)&&!row.revoked_at)choices.push(control('Revoke API key',{revoke:true}));
  if(section==='settings'&&['superadmin','operations'].includes(role))choices.push(control('Toggle setting',{value:!row.value}));
  if(section==='announcements'&&['superadmin','operations'].includes(role))choices.push(control(row.published?'Unpublish':'Publish',{published:!row.published}));
  if(section==='tickets'&&['superadmin','operations','support'].includes(role))choices.push(<button className="admin-inline-btn" onClick={()=>setTicketId(id)}>Open thread</button>);
  if(section==='tickets'&&['superadmin','operations','support'].includes(role))choices.push(<EditAction label="Update status" onCommit={d=>change(section,id,d)} fields={[{name:'status',label:'Status',type:'select',options:['open','in_progress','waiting_customer','resolved','closed'],defaultValue:String(row.status)}]}/>);
  if(section==='incidents'&&['superadmin','operations','support'].includes(role))choices.push(<EditAction label="Update incident" onCommit={d=>change(section,id,d)} fields={[{name:'status',label:'Status',type:'select',options:['investigating','identified','monitoring','resolved'],defaultValue:String(row.status)}]}/>);
  return choices.length?<div className="admin-inline-actions">{choices.map((c,i)=><span key={i}>{c}</span>)}</div>:null;
 }
 const columns=rows.length?Object.keys(rows[0]).filter(k=>!['config','details'].includes(k)).slice(0,8):[];
 return <div className="admin-console">
  <div className="admin-console-actions"><span><Shield size={17}/> MFA protected admin session</span><button className="button button-outline" onClick={()=>void signOut()}>Admin sign out</button></div>
  <div className="admin-console-layout">
  <nav className="admin-sidebar" aria-label="Administrator navigation">
   {(available[role]||[]).map(t=>{const Icon=icons[t];return <button key={t} className={section===t?'active':''} onClick={()=>tab(t)}><Icon size={17}/><span>{names[t]}</span><ChevronRight size={13}/></button>})}
  </nav>
  <main className="admin-main">
   <div className="admin-section-top"><div><p className="eyebrow">CONTROL PLANE / {section.toUpperCase().replaceAll('_',' ')}</p><h2>{names[section]}</h2><p>Live PostgreSQL records. Changes are scoped to your administrator role and audited.</p></div>
   <button type="button" className="button button-outline" onClick={()=>void load()}>Refresh</button></div>
   {error&&<p className="auth-error" role="alert">{error}</p>}
   {notice&&<p className="admin-notice">{notice}</p>}
   {loading&&<p>Loading real platform data…</p>}
   {!loading&&section==='overview'&&<><div className="admin-stats-grid">
     {Object.entries(stats).map(([k,v])=><motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} key={k} className="admin-stat">
      <span>{k.replaceAll('_',' ')}</span><strong>{typeof v==='number'?v.toLocaleString('en-IN'):String(v)}</strong></motion.div>)}
     </div><h3>Service configuration</h3><div className="admin-config-grid">{Object.entries(integrations).map(([k,v])=>
      <div key={k}><span>{k}</span><strong>{v?'Configured':'Not configured'}</strong></div>)}</div>
     <p className="micro muted">Configuration checks confirm presence of environment settings, not service connectivity or model readiness.</p></>}
   {!loading&&section!=='overview'&&<>
    {['superadmin','operations','finance','support'].includes(role)&&<CreateRecord section={section} save={create}/>}
    {section==='tickets'&&['superadmin','operations','support'].includes(role)&&<p className="micro muted">Select a support ticket ID to open its messages and reply. Ticket status changes are logged.</p>}
    {rows.length===0?<p>No records in this category.</p>:<div className="admin-table-scroll"><table className="admin-data-table"><thead><tr>{columns.map(c=><th key={c}>{c.replaceAll('_',' ')}</th>)}<th>Operations</th></tr></thead>
     <tbody>{rows.map((row,i)=><tr key={String(row.id||row.user_id||row.key||row.capability||i)}>{columns.map(c=><td key={c}>{badgeStatus(c,row[c])?
       <span className="admin-cell-badge">{short(row[c])}</span>:<span title={String(row[c]??'')}>{short(row[c])}</span>}</td>)}<td>{controls(row)}</td></tr>)}</tbody></table></div>}
    {section==='tickets'&&ticketId&&<AdminTicketDetail id={ticketId} onClose={()=>setTicketId('')} onSaved={()=>void load()}/>}
    <div className="admin-pagination"><button className="button button-outline" disabled={offset===0} onClick={()=>setOffset(x=>Math.max(0,x-50))}>Previous 50</button>
     <span>{offset+1}–{offset+rows.length}</span><button className="button button-outline" disabled={rows.length<50} onClick={()=>setOffset(x=>x+50)}>Next 50</button></div>
   </>}
  </main></div></div>;
}
