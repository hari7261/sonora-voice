'use client';
import {useCallback,useEffect,useState} from 'react';
import {MessageCircle,Send} from 'lucide-react';
type Ticket={id:string;subject:string;category:string;priority:string;status:string;created_at:string;updated_at:string};
type Message={id:string;author_id:string;display_name:string;content:string;created_at:string};
async function call<T>(url:string,method='GET',body?:object):Promise<T>{
 const r=await fetch(url,{method,cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
 const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to load support');return d as T;
}
export function SupportPanel(){
 const [tickets,setTickets]=useState<Ticket[]>([]),[selected,setSelected]=useState(''),[thread,setThread]=useState<Message[]>([]),
 [subject,setSubject]=useState(''),[category,setCategory]=useState('other'),[message,setMessage]=useState(''),
 [reply,setReply]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{try{const r=await call<{tickets:Ticket[]}>('/api/support/tickets');setTickets(r.tickets);}
  catch(e){setError((e as Error).message)}},[]);
 useEffect(()=>{void refresh()},[refresh]);
 async function open(id:string){setSelected(id);setError('');
  try{const t=await call<{messages:Message[]}>('/api/support/tickets/'+id);setThread(t.messages);}
  catch(e){setError((e as Error).message)}
 }
 async function create(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');
  try{const t=await call<{id:string}>('/api/support/tickets','POST',{subject,category,message});setSubject('');setMessage('');
   await refresh();await open(t.id);setNotice('Your support request has been submitted.');}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function send(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');
  try{await call('/api/support/tickets/'+selected,'POST',{message:reply});setReply('');await open(selected);await refresh();}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <div className="support-console">
  <h1>Support center.</h1><p>Track your real support requests and communicate with the Vāchaspati operations team.</p>
  {error&&<p role="alert" className="auth-error">{error}</p>}
  {notice&&<p className="admin-notice">{notice}</p>}
  <div className="support-layout"><div className="console-panel">
   <h2><MessageCircle size={20}/> Your tickets</h2>
   {tickets.length===0?<p>No tickets yet.</p>:tickets.map(t=><button className={'support-item '+(selected===t.id?'active':'')}
     key={t.id} onClick={()=>void open(t.id)}><strong>{t.subject}</strong><span>{t.status} · {new Date(t.updated_at).toLocaleDateString()}</span></button>)}
   <form onSubmit={create} className="console-form">
    <h3>New support request</h3>
    <label>Subject<input required minLength={4} maxLength={200} value={subject} onChange={e=>setSubject(e.target.value)}/></label>
    <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{['billing','account','voice','agent','api','other'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    <label>Message<textarea required minLength={5} maxLength={10000} rows={5} value={message} onChange={e=>setMessage(e.target.value)}/></label>
    <button className="button button-dark" type="submit" disabled={busy}>{busy?'Submitting…':'Create ticket'}</button>
   </form>
  </div><div className="console-panel"><h2>Conversation</h2>
  {!selected?<p>Select a ticket to view its conversation.</p>:<>
   <div className="support-messages">{thread.map(m=><div key={m.id} className="support-message">
    <strong>{m.display_name}</strong><small>{new Date(m.created_at).toLocaleString()}</small><p>{m.content}</p>
   </div>)}</div>
   <form onSubmit={send} className="console-form"><label>Reply<textarea value={reply} onChange={e=>setReply(e.target.value)} required maxLength={10000} rows={4}/></label>
    <button type="submit" disabled={busy} className="button button-dark"><Send size={16}/> Send reply</button></form>
  </>}</div></div></div>;
}
