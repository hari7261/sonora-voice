'use client';
import {useState} from 'react';
import Link from 'next/link';
async function verifyRequest(action:'request'|'confirm',data:object){const r=await fetch('/api/auth/verify/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const body=await r.json();if(!r.ok)throw new Error(body.error||'Verification unsuccessful');return body;}
export function EmailVerification({token}:{token?:string}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),
 [message,setMessage]=useState(''),[working,setWorking]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setWorking(true);setMessage('');
  try{
   const r=await verifyRequest(token?'confirm':'request',token?{token}:{email,password});
   setMessage(token?'Email confirmed. You can now sign in.':r.message);
  }catch(e){setMessage((e as Error).message);}finally{setWorking(false);}
 }
 return <div className="auth-layout container"><div className="auth-editorial">
  <span className="eyebrow">ACCOUNT / EMAIL VERIFICATION</span><h1>One more <em>secure step.</em></h1>
  <p>Confirm your email to protect your Vāchaspati AI account. This uses our own database and email verification tokens, not Supabase Auth.</p></div>
  <div className="auth-panel"><h2>{token?'Confirm your email':'Request verification link'}</h2>
   <form onSubmit={submit}>{!token&&<>
    <label>Account email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
    <label>Account password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>
   </>}
    {message&&<p role="status">{message}</p>}
    <button className="button button-dark auth-submit" type="submit" disabled={working}>{working?'Working…':token?'Verify email':'Send verification link'}</button>
   </form><p className="auth-switch"><Link href="/login">Return to login</Link></p></div>
 </div>;
}
