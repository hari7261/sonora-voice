'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {ArrowRight,LockKeyhole} from 'lucide-react';

export function AuthForm({mode}:{mode:'login'|'register'}){
  const router=useRouter();
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [displayName,setDisplayName]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const register=mode==='register';
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setError('');
    if(register&&password!==confirmation){setError('Passwords do not match.');return;}
    setLoading(true);
    try{
      const response=await fetch('/api/auth/'+mode,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email,password,...(register?{displayName}:{})}),
      });
      const data=await response.json() as {ok?:boolean;error?:string};
      if(!response.ok){setError(data.error||'Unable to continue.');return;}
      router.replace('/dashboard');router.refresh();
    }catch{setError('Unable to contact the authentication service.');}
    finally{setLoading(false);}
  }
  return <div className="auth-layout container">
    <div className="auth-editorial">
      <span className="eyebrow">VĀCHASPATI AI / WORKSPACE ACCESS</span>
      <h1>Voice infrastructure, <em>your way.</em></h1>
      <p>Secure access to your projects, agents, API credentials and usage. Your account and session data live in Vāchaspati's private database tables.</p>
    </div>
    <div className="auth-panel">
      <div className="auth-icon"><LockKeyhole size={22}/></div>
      <h2>{register?'Create your account':'Welcome back'}</h2>
      <p>{register?'Start with your own Vāchaspati workspace.':'Log in with your email and password.'}</p>
      <form onSubmit={submit}>
        {register&&<label>Full name<input autoComplete="name" required maxLength={120} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Your full name"/></label>}
        <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
        <label>Password<input type="password" autoComplete={register?'new-password':'current-password'} required minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 12 characters"/></label>
        {register&&<label>Confirm password<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="Re-enter password"/></label>}
        {error&&<p className="auth-error" role="alert">{error}</p>}
        <button className="button button-dark auth-submit" type="submit" disabled={loading}>{loading?'Working…':register?'Create account':'Log in'} <ArrowRight size={16}/></button>
      </form>
      <p className="auth-switch">{register?'Already have an account?':'New to Vāchaspati AI?'} <Link href={register?'/login':'/signup'}>{register?'Log in':'Create an account'}</Link></p>
    </div>
  </div>;
}
export function LogoutButton(){
  const router=useRouter();const [working,setWorking]=useState(false);
  async function logOut(){
    setWorking(true);
    try{
      const response=await fetch('/api/auth/logout',{method:'POST'});
      if(!response.ok)throw new Error('Logout failed');
      router.replace('/login');router.refresh();
    }catch{setWorking(false);}
  }
  return <button type="button" className="button button-outline" disabled={working} onClick={logOut}>{working?'Signing out…':'Sign out'}</button>;
}
