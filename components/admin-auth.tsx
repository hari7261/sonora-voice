'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
async function post(action:string,body:object){const r=await fetch('/api/admin/auth/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Authentication failed');return d;}
export function AdminLogin(){
 const router=useRouter(),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[code,setCode]=useState(''),
 [error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setError('');setBusy(true);
  try{await post('login',{email,password,code});router.replace('/superadmin');router.refresh();}
  catch(e){setError((e as Error).message);}finally{setBusy(false)}
 }
 return <div className="auth-layout container"><div className="auth-editorial"><span className="eyebrow">RESTRICTED / OPERATIONS</span><h1>Vāchaspati <em>Control.</em></h1>
 <p>Separate administrator access. Your account must be explicitly authorized, with an authenticator app enabled before signing in.</p></div>
 <div className="auth-panel"><h2>Admin sign in</h2><form onSubmit={submit}>
 <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required/></label>
 <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label>
 <label>Authenticator code<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} autoComplete="one-time-code" required/></label>
 {error&&<p className="auth-error" role="alert">{error}</p>}
 <button type="submit" disabled={busy} className="button button-dark auth-submit">{busy?'Verifying…':'Secure sign in'}</button></form>
 <p className="auth-switch">First administrator? <Link href="/superadmin/setup">Enroll MFA</Link> after receiving a role assignment.</p></div></div>;
}
export function AdminSetup(){
 const router=useRouter();const [password,setPassword]=useState(''),[secret,setSecret]=useState(''),
 [uri,setUri]=useState(''),[code,setCode]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function enroll(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');
  try{const r=await post('enroll',{password});setSecret(r.secret);setUri(r.otpauth);}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function confirm(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');
  try{await post('confirm',{code});router.replace('/superadmin');router.refresh();}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <div className="auth-layout container"><div className="auth-editorial"><span className="eyebrow">SECURITY / INITIAL ENROLLMENT</span><h1>Protect the <em>control plane.</em></h1>
 <p>You must first register normally, sign in, and have your user explicitly granted an admin role in PostgreSQL. This page cannot grant itself administrator privileges.</p></div>
 <div className="auth-panel"><h2>Configure MFA</h2>
 {!secret?<form onSubmit={enroll}><label>Confirm your account password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
 <button className="button button-dark auth-submit" disabled={busy}>Generate authenticator secret</button></form>:
 <form onSubmit={confirm}><p>In your authenticator app, choose <strong>Enter setup key</strong> and enter this secret. Do not share it.</p>
 <code className="admin-mfa-secret">{secret}</code>
 <p className="micro muted">Account issuer: Vāchaspati AI · TOTP / SHA1 / 30 seconds</p>
 <label>6-digit verification code<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} required/></label>
 <button className="button button-dark auth-submit" disabled={busy}>Verify and open Super Admin</button></form>}
 {error&&<p className="auth-error" role="alert">{error}</p>}
 <p className="auth-switch"><Link href="/superadmin/login">Return to administrator sign in</Link></p></div></div>;
}
