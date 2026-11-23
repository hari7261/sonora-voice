import 'server-only';
import {randomBytes} from 'node:crypto';
import {database} from './db';
import {sha256} from './credentials';
export async function sendVerification(email:string,userId:string){
 if(!process.env.RESEND_API_KEY||!process.env.MAIL_FROM||!process.env.APP_ORIGIN)
  throw new Error('EMAIL_NOT_CONFIGURED');
 const origin=new URL(process.env.APP_ORIGIN);
 if(origin.protocol!=='https:')throw new Error('EMAIL_ORIGIN_NOT_HTTPS');
 const token=randomBytes(32).toString('base64url');
 await database().query(`insert into vachaspati_private.vachaspati_email_verifications(user_id,token_hash,expires_at)
  values($1,$2,now()+interval '24 hours')`,[userId,sha256(token)]);
 const url=new URL('/verify-email',origin);url.searchParams.set('token',token);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const result=await fetch('https://api.resend.com/emails',{method:'POST',signal:controller.signal,
    headers:{'Authorization':'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({from:process.env.MAIL_FROM,to:[email],subject:'Verify your Vāchaspati AI email address',
      html:'<p>Verify your email to access your Vāchaspati AI workspace.</p><p><a href="'+url.href+'">Verify email</a></p><p>This link expires in 24 hours.</p>'}),cache:'no-store'});
  if(!result.ok)throw new Error('MAIL_PROVIDER_'+result.status);
 }finally{clearTimeout(timer);}
}
