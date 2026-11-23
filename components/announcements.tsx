'use client';
import {useEffect,useState} from 'react';
type Announcement={id:string;title:string;content:string;created_at:string};
export function Announcements(){
 const [items,setItems]=useState<Announcement[]>([]);
 useEffect(()=>{void fetch('/api/public/announcements',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(d=>setItems(d.announcements||[])).catch(()=>{});},[]);
 if(items.length===0)return null;
 return <section className="account-announcements"><h2>Platform announcements</h2><div className="account-workspaces">{items.map(a=><article key={a.id} className="account-workspace"><h3>{a.title}</h3><p>{a.content}</p><small>{new Date(a.created_at).toLocaleDateString()}</small></article>)}</div></section>;
}
