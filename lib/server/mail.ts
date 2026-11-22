import 'server-only';
export async function sendPasswordResetEmail(to:string,token:string){
 const apiKey=process.env.RESEND_API_KEY,from=process.env.MAIL_FROM,origin=process.env.APP_ORIGIN;
 if(!apiKey||!from||!origin||!origin.startsWith('https://'))throw new Error('EMAIL_NOT_CONFIGURED');
 const url=new URL('/reset-password',origin);url.searchParams.set('token',token);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const r=await fetch('https://api.resend.com/emails',{method:'POST',signal:controller.signal,
   headers:{'Authorization':'Bearer '+apiKey,'Content-Type':'application/json'},
   body:JSON.stringify({from,to:[to],subject:'Reset your Vāchaspati AI password',
     html:'<p>A password reset was requested for your Vāchaspati AI account.</p>'+
      '<p><a href="'+url.href+'">Reset your password</a></p>'+
      '<p>This link expires in 30 minutes. If you did not request it, ignore this email.</p>'}),
   cache:'no-store'});
  if(!r.ok)throw new Error('EMAIL_PROVIDER_'+r.status);
 }finally{clearTimeout(timer);}
}
