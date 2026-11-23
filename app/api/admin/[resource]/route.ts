import {NextRequest} from 'next/server';
import {database} from '../../../../lib/server/db';
import {requireAdmin,audit,type AdminRole} from '../../../../lib/server/admin';
import {recordedHealth} from '../../../../lib/server/service-health';
import {apiError,readJson,safeOrigin,validUuid} from '../../../../lib/server/platform';
export const runtime='nodejs';export const dynamic='force-dynamic';
const S='vachaspati_private';type P={params:Promise<{resource:string}>};
const acl:Record<string,AdminRole[]> = {
 overview:['superadmin','operations','support','finance','analyst'],
 users:['superadmin','operations','support','analyst'],
 admins:['superadmin'],
 accounts:['superadmin','operations','support','finance','analyst'],
 agents:['superadmin','operations','support','analyst'],
 models:['superadmin','operations','analyst'],
 plans:['superadmin','finance','analyst'],
 rates:['superadmin','finance','analyst'],
 packages:['superadmin','finance','analyst'],
 payments:['superadmin','finance','analyst'],
 usage:['superadmin','operations','finance','analyst'],
 api_keys:['superadmin','operations','support'],
 settings:['superadmin','operations','analyst'],
 incidents:['superadmin','operations','support','analyst'],
 audit:['superadmin','analyst'],
 tickets:['superadmin','operations','support','analyst'],
 announcements:['superadmin','operations','analyst'],
 health:['superadmin','operations','analyst'],
};
const reads:Record<string,string> = {
 users:`select id,email,display_name,email_verified_at,disabled_at,created_at from ${S}.vachaspati_users order by created_at desc limit $1 offset $2`,
 admins:`select r.user_id,u.email,u.display_name,r.role,r.active,r.created_at,m.confirmed_at as mfa_enabled_at from ${S}.vachaspati_admin_roles r join ${S}.vachaspati_users u on u.id=r.user_id left join ${S}.vachaspati_admin_mfa m on m.user_id=r.user_id order by r.created_at desc limit $1 offset $2`,
 accounts:`select a.id,a.name,a.owner_id,u.email as owner_email,p.name as plan_name,a.wallet_credits,a.created_at from ${S}.vachaspati_accounts a join ${S}.vachaspati_users u on u.id=a.owner_id left join ${S}.vachaspati_plans p on p.id=a.plan_id order by a.created_at desc limit $1 offset $2`,
 agents:`select a.id,a.name,a.account_id,a.status,a.llm_model,a.language_code,a.created_at from ${S}.vachaspati_agents a order by a.created_at desc limit $1 offset $2`,
 models:`select id,name,capability,description,enabled,config,created_at from ${S}.vachaspati_voice_models order by name limit $1 offset $2`,
 plans:`select * from ${S}.vachaspati_plans order by monthly_credits limit $1 offset $2`,
 rates:`select * from ${S}.vachaspati_rates order by capability limit $1 offset $2`,
 packages:`select * from ${S}.vachaspati_credit_packages order by price_paise limit $1 offset $2`,
 payments:`select id,account_id,user_id,package_id,credits,amount_paise,currency,provider,status,provider_order_id,provider_payment_id,created_at,paid_at from ${S}.vachaspati_payment_orders order by created_at desc limit $1 offset $2`,
 usage:`select id,account_id,api_key_id,model_id,request_id,units,credits,status_code,created_at from ${S}.vachaspati_api_usage order by created_at desc limit $1 offset $2`,
 api_keys:`select id,account_id,label,key_prefix,scopes,created_at,expires_at,revoked_at from ${S}.vachaspati_api_keys order by created_at desc limit $1 offset $2`,
 settings:`select key,value,description,updated_at from ${S}.vachaspati_platform_settings order by key limit $1 offset $2`,
 incidents:`select id,title,details,severity,status,created_at,resolved_at from ${S}.vachaspati_service_incidents order by created_at desc limit $1 offset $2`,
 tickets:`select t.id,t.account_id,t.subject,t.category,t.priority,t.status,t.assigned_to,u.email as customer,t.updated_at from ${S}.vachaspati_support_tickets t join ${S}.vachaspati_users u on u.id=t.opened_by order by t.updated_at desc limit $1 offset $2`,
 announcements:`select id,title,content,audience,published,created_at,updated_at from ${S}.vachaspati_announcements order by created_at desc limit $1 offset $2`,
 audit:`select a.id,a.actor_id,u.email as actor_email,a.action,a.target_type,a.target_id,a.details,a.created_at from ${S}.vachaspati_admin_audit a left join ${S}.vachaspati_users u on u.id=a.actor_id order by a.id desc limit $1 offset $2`
};
export async function GET(req:NextRequest,{params}:P){
 const resource=(await params).resource,allowed=acl[resource];
 if(!allowed)return apiError('Not found',404);
 try{
  const admin=await requireAdmin(req,allowed);if(!admin)return apiError('Forbidden',403);
  if(resource==='health'){
   const checks=await recordedHealth();
   return Response.json({data:checks},{headers:{'Cache-Control':'no-store'}});
  }
  if(resource==='overview'){
   const result=await database().query(`
    select
    (select count(*) from ${S}.vachaspati_users)::int as users,
    (select count(*) from ${S}.vachaspati_accounts)::int as workspaces,
    (select count(*) from ${S}.vachaspati_agents)::int as agents,
    (select count(*) from ${S}.vachaspati_agents where status='active')::int as live_agents,
    (select count(*) from ${S}.vachaspati_conversations)::int as conversations,
    (select count(*) from ${S}.vachaspati_api_keys where revoked_at is null)::int as active_keys,
    (select count(*) from ${S}.vachaspati_api_usage where created_at>now()-interval '24 hours')::int as requests_24h,
    (select coalesce(sum(credits),0) from ${S}.vachaspati_api_usage where created_at>now()-interval '24 hours')::bigint as credits_24h,
    (select coalesce(sum(amount_paise),0) from ${S}.vachaspati_payment_orders where status='paid')::bigint as revenue_paise,
    (select count(*) from ${S}.vachaspati_service_incidents where status<>'resolved')::int as open_incidents`);
   return Response.json({stats:result.rows[0],integrations:{
     database:true,openrouter:!!process.env.OPENROUTER_API_KEY,
     sherpa:!!process.env.SHERPA_INFERENCE_URL&&!!process.env.SHERPA_WORKER_SECRET,
     payment:!!process.env.RAZORPAY_KEY_ID&&!!process.env.RAZORPAY_KEY_SECRET&&!!process.env.RAZORPAY_WEBHOOK_SECRET,
     email:!!process.env.RESEND_API_KEY&&!!process.env.MAIL_FROM
   }},{headers:{'Cache-Control':'no-store'}});
  }
  const limit=Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit'))||50,1),100);
  const offset=Math.min(Math.max(Number(req.nextUrl.searchParams.get('offset'))||0,0),100000);
  const rows=await database().query(reads[resource],[limit,offset]);
  return Response.json({data:rows.rows,limit,offset},{headers:{'Cache-Control':'no-store'}});
 }catch{return apiError('Administrative service unavailable',503);}
}
const canCreate:Record<string,AdminRole[]> = {
 models:['superadmin','operations'],plans:['superadmin','finance'],
 packages:['superadmin','finance'],incidents:['superadmin','operations','support'],
 admins:['superadmin'],
 announcements:['superadmin','operations'],
};
export async function POST(req:NextRequest,{params}:P){
 const resource=(await params).resource,allowed=canCreate[resource];
 if(!allowed)return apiError('Not found',404);
 if(!safeOrigin(req))return apiError('Disallowed origin',403);
 try{
  const admin=await requireAdmin(req,allowed);if(!admin)return apiError('Forbidden',403);
  const b=await readJson(req,10000);if(!b)return apiError('Invalid JSON',400);
  const name=typeof b.name==='string'?b.name.trim():'';
  let row:{id?:string;user_id?:string}|undefined,action='';
  if(resource==='models'){
   const id=typeof b.id==='string'?b.id.trim():'';
   const capability=typeof b.capability==='string'?b.capability.trim():'';
   const description=typeof b.description==='string'?b.description.trim():'';
   const config=b.config??{};
   if(!/^[a-z0-9][a-z0-9._-]{2,75}$/.test(id)||!name||name.length>120||!['stt','tts','agent','v2v','multilingual'].includes(capability)||
      description.length>2000||typeof config!=='object'||config===null||Array.isArray(config))return apiError('Invalid model',400);
   const result=await database().query<{id:string}>(`insert into ${S}.vachaspati_voice_models(id,name,capability,description,enabled,config)
      values($1,$2,$3,$4,false,$5::jsonb) returning id`,[id,name,capability,description,JSON.stringify(config)]);
   row=result.rows[0];action='model.created';
  }else if(resource==='plans'){
   const code=typeof b.code==='string'?b.code.trim():'';
   const fields=['monthly_credits','daily_limit','weekly_limit','monthly_limit','concurrency_limit'] as const;
   if(!/^[a-z0-9_-]{2,40}$/.test(code)||!name||name.length>100||fields.some(x=>!Number.isSafeInteger(Number(b[x]))||Number(b[x])<0)||Number(b.concurrency_limit)<1)return apiError('Invalid plan values');
   const r=await database().query<{id:string}>(`insert into ${S}.vachaspati_plans(code,name,monthly_credits,daily_limit,weekly_limit,monthly_limit,concurrency_limit,enabled)
     values($1,$2,$3,$4,$5,$6,$7,false) returning id`,
     [code,name,...fields.map(x=>b[x])]);
   row=r.rows[0];action='plan.created';
  }else if(resource==='packages'){
   if(!name||name.length>100||!Number.isSafeInteger(Number(b.credits))||Number(b.credits)<1||!Number.isSafeInteger(Number(b.price_paise))||Number(b.price_paise)<100)return apiError('Invalid package values');
   const r=await database().query<{id:string}>(`insert into ${S}.vachaspati_credit_packages(name,description,credits,price_paise,enabled)
     values($1,$2,$3,$4,false) returning id`,[name,typeof b.description==='string'?b.description.slice(0,500):'',b.credits,b.price_paise]);
   row=r.rows[0];action='package.created';
  }else if(resource==='announcements'){
   const title=typeof b.name==='string'?b.name.trim():'';
   const message=typeof b.content==='string'?b.content.trim():'';
   const audience=typeof b.audience==='string'?b.audience:'all';
   if(title.length<3||title.length>200||message.length<1||message.length>5000||!['all','developers','billing'].includes(audience))return apiError('Invalid announcement');
   const r=await database().query<{id:string}>(`insert into ${S}.vachaspati_announcements(title,content,audience,created_by) values($1,$2,$3,$4) returning id`,
    [title,message,audience,admin.user_id]);
   row=r.rows[0];action='announcement.created';
  }else if(resource==='incidents'){
   const severity=typeof b.severity==='string'?b.severity:'';
   if(!name||name.length>200||!['low','medium','high','critical'].includes(severity))return apiError('Invalid incident');
   const r=await database().query<{id:string}>(`insert into ${S}.vachaspati_service_incidents(title,details,severity,created_by)
      values($1,$2,$3,$4) returning id`,[name,typeof b.details==='string'?b.details.slice(0,3000):'',severity,admin.user_id]);
   row=r.rows[0];action='incident.opened';
  }else{
   const user_id=typeof b.user_id==='string'?b.user_id:'';
   const role=typeof b.role==='string'?b.role:'';
   if(!validUuid(user_id)||!['superadmin','operations','support','finance','analyst'].includes(role))return apiError('Invalid admin role',400);
   const r=await database().query<{user_id:string}>(`insert into ${S}.vachaspati_admin_roles(user_id,role,active,created_by)
     values($1,$2,true,$3) on conflict(user_id) do update set role=excluded.role,active=true
      returning user_id`,[user_id,role,admin.user_id]);
   row=r.rows[0];action='admin.granted';
  }
  if(!row)return apiError('No record created',500);
  await audit(admin.user_id,action,resource,row.id||row.user_id||null,{name,role:resource==='admins'?b.role:undefined});
  return Response.json({ok:true,...row},{status:201});
 }catch(e){
  if((e as {code?:string}).code==='23505')return apiError('Record already exists',409);
  return apiError('Unable to create record',503);
 }
}
