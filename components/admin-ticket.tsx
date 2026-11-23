'use client';
import {useEffect,useState} from 'react';
type Message={id:string;email:string;internal:boolean;content:string;created_at:string};
type Ticket={id:string;subject:string;status:string;priority:string};
export function AdminTicketDetail({id,onClose,onSaved}:{id:string;onClose:()=>void;onSaved:()=>void}){
 const [ticket,setTicket]=useState<Ticket|null>(null),[messages,setMessages]=useState<Message[]>([]),
 [reply,setReply]=useState(''),[status,setStatus]=useState('in_progress'),[internal,setInternal]=useState(false),
 [error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{void fetch('/api/admin/support/'+id,{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);
  setTicket(d.ticket);setMessages(d.messages);setStatus(d.ticket.status);}).catch(e=>setError((e as Error).message));},[id]);
 async function send(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');
  try{const r=await fetch('/api/admin/support/'+id,{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({message:reply,status,internal})});const d=await r.json();if(!r.ok)throw new Error(d.error);
   setReply('');onSaved();
   const get=await fetch('/api/admin/support/'+id);const data=await get.json();setMessages(data.messages);setTicket(data.ticket);
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <div className="admin-ticket-panel"><div className="billing-history-head">
  <h3>{ticket?.subject||'Loading support ticket…'}</h3><button className="button button-outline" onClick={onClose}>Close</button></div>
  {error&&<p className="auth-error">{error}</p>}
  <div className="support-messages">{messages.map(m=><div key={m.id} className={'support-message '+(m.internal?'support-internal':'')}>
   <strong>{m.email}{m.internal?' · Internal note':''}</strong><small>{new Date(m.created_at).toLocaleString()}</small><p>{m.content}</p>
  </div>)}</div>
  <form className="admin-create-form" onSubmit={send}><label>Staff reply<textarea required value={reply} onChange={e=>setReply(e.target.value)} maxLength={10000} rows={4}/></label>
  <div className="admin-form-grid"><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>{['open','in_progress','waiting_customer','resolved','closed'].map(x=><option key={x}>{x}</option>)}</select></label>
  <label><input type="checkbox" checked={internal} onChange={e=>setInternal(e.target.checked)}/> Private staff note (not visible to customer)</label></div>
  <button type="submit" disabled={busy} className="button button-dark">{busy?'Saving…':'Send staff reply'}</button></form>
 </div>;
}
