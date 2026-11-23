import {NextRequest} from 'next/server';
import {randomUUID} from 'node:crypto';
import {database} from '../../../../../lib/server/db';
import {requireAdmin,type AdminRole} from '../../../../../lib/server/admin';
import {apiError,readJson,safeOrigin,validUuid} from '../../../../../lib/server/platform';
export const runtime='nodejs';export const dynamic='force-dynamic';
type P={params:Promise<{resource:string;id:string}>};
const S='vachaspati_private';
function rejectAdmin(message:string,status=400):never{throw Object.assign(new Error(message),{adminStatus:status});}
const roles:Record<string,AdminRole[]>={users:['superadmin','support'],admins:['superadmin'],
 agents:['superadmin','operations'],models:['superadmin','operations'],
 plans:['superadmin','finance'],rates:['superadmin','finance'],packages:['superadmin','finance'],
 accounts:['superadmin','finance'],api_keys:['superadmin','operations'],
 settings:['superadmin','operations'],incidents:['superadmin','operations','support'],
 announcements:['superadmin','operations'],tickets:['superadmin','operations','support']};
const validRoles=['superadmin','operations','support','finance','analyst'];
export async function PATCH(req:NextRequest,{params}:P){
 const {resource,id}=await params;const allowed=roles[resource];
 if(!allowed)return apiError('Not found',404);
 if(!safeOrigin(req))return apiError('Invalid origin',403);
 try{
  const admin=await requireAdmin(req,allowed);if(!admin)return apiError('Forbidden',403);
  const b=await readJson(req,12000);if(!b)return apiError('Invalid request');
  let target=id,action='';let updated=0;
  const client=await database().connect();
  try{
   await client.query('begin');
   if(resource==='users'){
    if(!validUuid(id)||typeof b.disabled!=='boolean')rejectAdmin('User ID and disabled boolean required');
    if(id===admin.user_id&&b.disabled)rejectAdmin('Cannot disable own admin account',403);
    const r=await client.query(`update ${S}.vachaspati_users set disabled_at=case when $2 then now() else null end,updated_at=now() where id=$1 returning id`,[id,b.disabled]);
    updated=r.rowCount??0;action=b.disabled?'user.disabled':'user.enabled';
    if(b.disabled&&updated)await client.query(`update ${S}.vachaspati_sessions set revoked_at=now() where user_id=$1 and revoked_at is null`,[id]);
    if(b.disabled&&updated)await client.query(`update ${S}.vachaspati_admin_sessions set revoked_at=now() where user_id=$1 and revoked_at is null`,[id]);
   }else if(resource==='admins'){
    if(!validUuid(id)||typeof b.active!=='boolean'||!validRoles.includes(String(b.role??'superadmin')))rejectAdmin('Invalid admin update',400);
    const role=typeof b.role==='string'?b.role:null;
    if(id===admin.user_id&&(!b.active||role&&role!=='superadmin'))rejectAdmin('Cannot remove your own superadmin access',403);
    await client.query('select pg_advisory_xact_lock(29385701)');
    if(!b.active||role&&role!=='superadmin'){
      const own=await client.query<{role:string}>(`select role from ${S}.vachaspati_admin_roles where user_id=$1`,[id]);
      if(own.rows[0]?.role==='superadmin'){
       const left=await client.query<{count:string}>(`select count(*)::text as count from ${S}.vachaspati_admin_roles where role='superadmin' and active=true`);
       if(Number(left.rows[0].count)<=1)rejectAdmin('Cannot remove the last superadmin',409);
      }
    }
    const r=await client.query(`update ${S}.vachaspati_admin_roles set active=$2,role=coalesce($3,role) where user_id=$1 returning user_id`,[id,b.active,role]);
    updated=r.rowCount??0;action='admin.updated';
    if(updated)await client.query(`update ${S}.vachaspati_admin_sessions set revoked_at=now() where user_id=$1 and revoked_at is null`,[id]);
   }else if(resource==='agents'){
    if(!validUuid(id)||!['draft','active','paused'].includes(String(b.status)))rejectAdmin('Invalid agent status');
    const r=await client.query(`update ${S}.vachaspati_agents set status=$2,updated_at=now() where id=$1 returning id`,[id,b.status]);
    updated=r.rowCount??0;action='agent.status.updated';
   }else if(resource==='models'){
    if(!/^[a-z0-9][a-z0-9._-]{2,75}$/.test(id)||typeof b.enabled!=='boolean')rejectAdmin('Invalid model status');
    const r=await client.query(`update ${S}.vachaspati_voice_models set enabled=$2 where id=$1 returning id`,[id,b.enabled]);
    updated=r.rowCount??0;action='model.status.updated';
   }else if(resource==='plans'){
    if(!validUuid(id))rejectAdmin('Invalid plan');
    const allowedFields=['name','monthly_credits','daily_limit','weekly_limit','monthly_limit','concurrency_limit','enabled'] as const;
    for(const [k,v] of Object.entries(b)){if(!allowedFields.includes(k as typeof allowedFields[number]))rejectAdmin('Unsupported plan field');if(k==='enabled'&&typeof v!=='boolean'||k==='name'&&(typeof v!=='string'||!v.trim()||v.length>120)||k!=='name'&&k!=='enabled'&&(!Number.isSafeInteger(Number(v))||Number(v)<(k==='concurrency_limit'?1:0)))rejectAdmin('Invalid plan field');}
    if(!Object.keys(b).length)rejectAdmin('No changes');
    const keys=Object.keys(b),sets=keys.map((k,i)=>k+'=$'+(i+2)).join(',');
    const r=await client.query(`update ${S}.vachaspati_plans set ${sets} where id=$1 returning id`,[id,...keys.map(k=>b[k])]);
    updated=r.rowCount??0;action='plan.updated';
   }else if(resource==='rates'){
    if(!['agent','stt','tts'].includes(id))rejectAdmin('Invalid capability');
    if(!Number.isSafeInteger(Number(b.unit_size))||Number(b.unit_size)<1||!Number.isSafeInteger(Number(b.credits_per_unit))||Number(b.credits_per_unit)<1||typeof b.enabled!=='boolean')rejectAdmin('Invalid rate');
    const r=await client.query(`update ${S}.vachaspati_rates set unit_size=$2,credits_per_unit=$3,enabled=$4,updated_at=now() where capability=$1 returning id`,
      [id,b.unit_size,b.credits_per_unit,b.enabled]);updated=r.rowCount??0;action='rate.updated';
   }else if(resource==='packages'){
    if(!validUuid(id)||typeof b.enabled!=='boolean')rejectAdmin('Invalid package');
    const r=await client.query(`update ${S}.vachaspati_credit_packages set enabled=$2 where id=$1 returning id`,[id,b.enabled]);
    updated=r.rowCount??0;action='package.status.updated';
   }else if(resource==='settings'){
    if(!['signup_enabled','agent_publishing_enabled','maintenance_mode','email_verification_required'].includes(id)||typeof b.value!=='boolean')rejectAdmin('Unsupported platform setting');
    if(id==='maintenance_mode'&&admin.role!=='superadmin')rejectAdmin('Only superadmin may change maintenance mode',403);
    if(id==='email_verification_required'&&b.value===true&&(!process.env.RESEND_API_KEY||!process.env.MAIL_FROM||!process.env.APP_ORIGIN))
     rejectAdmin('Verify the email provider configuration before requiring account verification',409);
    const r=await client.query(`update ${S}.vachaspati_platform_settings set value=$2::jsonb,updated_by=$3,updated_at=now() where key=$1 returning key`,
      [id,JSON.stringify(b.value),admin.user_id]);updated=r.rowCount??0;action='setting.updated';
   }else if(resource==='announcements'){
    if(!validUuid(id)||typeof b.published!=='boolean')rejectAdmin('Invalid announcement');
    const r=await client.query(`update ${S}.vachaspati_announcements set published=$2,updated_at=now() where id=$1 returning id`,[id,b.published]);
    updated=r.rowCount??0;action='announcement.updated';
   }else if(resource==='tickets'){
    if(!validUuid(id)||!['open','in_progress','waiting_customer','resolved','closed'].includes(String(b.status)))rejectAdmin('Invalid ticket status');
    const r=await client.query(`update ${S}.vachaspati_support_tickets set status=$2,updated_at=now(),
      resolved_at=case when $2 in ('resolved','closed') then now() else null end where id=$1 returning id`,[id,b.status]);
    updated=r.rowCount??0;action='ticket.status.updated';
   }else if(resource==='incidents'){
    if(!validUuid(id)||!['investigating','identified','monitoring','resolved'].includes(String(b.status)))rejectAdmin('Invalid incident status');
    const r=await client.query(`update ${S}.vachaspati_service_incidents set status=$2,resolved_at=case when $2='resolved' then now() else null end where id=$1 returning id`,[id,b.status]);
    updated=r.rowCount??0;action='incident.updated';
   }else if(resource==='api_keys'){
    if(!validUuid(id)||b.revoke!==true)rejectAdmin('Invalid revocation');
    const r=await client.query(`update ${S}.vachaspati_api_keys set revoked_at=now() where id=$1 and revoked_at is null returning id`,[id]);
    updated=r.rowCount??0;action='key.revoked';
   }else if(resource==='accounts'){
    if(!validUuid(id))rejectAdmin('Invalid account ID');
    if(typeof b.plan_id==='string'&&validUuid(b.plan_id)){
     const r=await client.query(`update ${S}.vachaspati_accounts set plan_id=$2 where id=$1 returning id`,[id,b.plan_id]);
     updated=r.rowCount??0;action='account.plan.changed';
    }else if(Number.isSafeInteger(Number(b.wallet_adjustment))&&Number(b.wallet_adjustment)!==0&&Math.abs(Number(b.wallet_adjustment))<=1_000_000){
     const reason=typeof b.reason==='string'?b.reason.trim():'';
     if(reason.length<10||reason.length>300)rejectAdmin('Supply a 10–300 character credit adjustment reason');
     const r=await client.query<{wallet_credits:string}>(`select wallet_credits::text from ${S}.vachaspati_accounts where id=$1 for update`,[id]);
     if(!r.rows[0])rejectAdmin('Account not found',404);
     if(Number(r.rows[0].wallet_credits)+Number(b.wallet_adjustment)<0)rejectAdmin('Cannot make prepaid balance negative',409);
     await client.query(`update ${S}.vachaspati_accounts set wallet_credits=wallet_credits+$2 where id=$1`,[id,b.wallet_adjustment]);
     await client.query(`insert into ${S}.vachaspati_credit_ledger(account_id,delta,wallet_delta,reason,request_id)
       values($1,$2,$2,$3,$4)`,[id,b.wallet_adjustment,'admin_adjustment:'+reason,'admin:'+randomUUID()]);
     updated=1;action='account.wallet.adjusted';
    }else rejectAdmin('Specify plan_id or wallet_adjustment');
   }
   if(!updated){await client.query('rollback');return apiError('Record not found',404);}
   await client.query(`insert into ${S}.vachaspati_admin_audit(actor_id,action,target_type,target_id,details)
    values($1,$2,$3,$4,$5::jsonb)`,[admin.user_id,action,resource,target,JSON.stringify(b)]);
   await client.query('commit');
   return Response.json({ok:true});
  }catch(e){await client.query('rollback');throw e;}finally{client.release();}
 }catch(e){
  if((e as {code?:string}).code==='23503')return apiError('Related record not found',404);
  const adminStatus=(e as {adminStatus?:number}).adminStatus;
  if(adminStatus&&adminStatus>=400&&adminStatus<=499)return apiError((e as Error).message,adminStatus);
  return apiError('Unable to update record',503);
 }
}
