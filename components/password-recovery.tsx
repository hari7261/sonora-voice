'use client';
import {useState} from 'react';
import Link from 'next/link';
export function PasswordRecovery({token}:{token?:string}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),
 [confirm,setConfirm]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){
  e.preventDefault();setMessage('');
  if(token&&password!==confirm){setMessage('Passwords do not match');return;}
  setBusy(true);
  try{
   const url='/api/auth/password-reset/'+(token?'confirm':'request');
   const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(token?{token,password}:{email})});
   const data=await r.json();
   if(!r.ok)throw new Error(data.error||'Request failed');
   setMessage(token?'Password changed successfully. Sign in with your new password.':data.message);
  }catch(e){setMessage((e as Error).message);}
  finally{setBusy(false);}
 }
 return <div className="auth-layout container"><div className="auth-editorial"><span className="eyebrow">ACCOUNT SECURITY</span>
 <h1>Secure your <em>workspace.</em></h1><p>Use a single-use reset link to change your password. Existing login sessions are revoked after resetting.</p></div>
 <div className="auth-panel"><h2>{token?'Set a new password':'Reset password'}</h2>
 <form onSubmit={submit}>
 {!token?<label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com"/></label>:<>
 <label>New password<input type="password" required minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label>
 <label>Confirm password<input type="password" required value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password"/></label>
 </>}
 {message&&<p role="status">{message}</p>}
 <button type="submit" disabled={busy} className="button button-dark auth-submit">{busy?'Submitting…':token?'Update password':'Email reset link'}</button>
 </form><p className="auth-switch"><Link href="/login">Back to login</Link></p></div></div>;
}
