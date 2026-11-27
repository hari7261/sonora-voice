import 'server-only';
import {randomUUID} from 'node:crypto';
import {database} from './db';
type Capability='agent'|'stt'|'tts';
type Rate={unit_size:number;credits_per_unit:string};
type Plan={monthly_credits:string;daily_limit:string;weekly_limit:string;monthly_limit:string;concurrency_limit:number;wallet_credits:string};
const S='vachaspati_private';
export class QuotaError extends Error{
 constructor(public readonly reason:string,public readonly status=429){super(reason);}
}
export async function getCreditBalance(accountId:string){
 const r=await database().query<{
 monthly_credits:string;wallet_credits:string;plan_remaining:string;
 used_today:string;used_week:string;used_month:string;plan_name:string;
 }>(`
 select p.monthly_credits::text,p.name as plan_name,a.wallet_credits::text,
 greatest(0,p.monthly_credits+coalesce((select sum(l.delta-l.wallet_delta)
  from ${S}.vachaspati_credit_ledger l where l.account_id=a.id
  and l.reason in ('agent','stt','tts','refund') and l.created_at>=date_trunc('month',now())),0))::text as plan_remaining,
 coalesce((select -sum(l.delta) from ${S}.vachaspati_credit_ledger l where l.account_id=a.id
  and l.reason in ('agent','stt','tts','refund') and l.created_at>=date_trunc('day',now())),0)::text as used_today,
 coalesce((select -sum(l.delta) from ${S}.vachaspati_credit_ledger l where l.account_id=a.id
  and l.reason in ('agent','stt','tts','refund') and l.created_at>=date_trunc('week',now())),0)::text as used_week,
 coalesce((select -sum(l.delta) from ${S}.vachaspati_credit_ledger l where l.account_id=a.id
  and l.reason in ('agent','stt','tts','refund') and l.created_at>=date_trunc('month',now())),0)::text as used_month
 from ${S}.vachaspati_accounts a join ${S}.vachaspati_plans p on p.id=a.plan_id where a.id=$1`,[accountId]);
 if(!r.rows[0])return null;
 const row=r.rows[0];
 return {...row,remaining:String(Number(row.plan_remaining)+Number(row.wallet_credits))};
}
export async function reserveCredits(accountId:string,capability:Capability,units:number,requestId=randomUUID()):Promise<{requestId:string;credits:number}>{
 if(!Number.isSafeInteger(units)||units<=0||units>10_000_000)throw new QuotaError('Invalid billable units',400);
 const client=await database().connect();
 try{
  await client.query('begin');
  const state=await client.query<Plan & {slot_count:string;unit_size:number|null;credits_per_unit:string|null;day:string;week:string;plan_used:string}>(`
   with del as (
    delete from ${S}.vachaspati_concurrency_slots where account_id=$1 and expires_at<now()
   ),
   acc as (
    select p.monthly_credits::text,p.daily_limit::text,p.weekly_limit::text,p.monthly_limit::text,p.concurrency_limit,
     a.wallet_credits::text
    from ${S}.vachaspati_accounts a join ${S}.vachaspati_plans p on p.id=a.plan_id
    where a.id=$1 and p.enabled=true for update of a
   ),
   slots as (
    select count(*)::text as slot_count from ${S}.vachaspati_concurrency_slots where account_id=$1
   ),
   rt as (
    select unit_size,credits_per_unit::text from ${S}.vachaspati_rates where capability=$2 and enabled=true limit 1
   ),
   usg as (
    select
     coalesce(-sum(delta) filter(where created_at>=date_trunc('day',now())),0)::text as day,
     coalesce(-sum(delta) filter(where created_at>=date_trunc('week',now())),0)::text as week,
     coalesce(-sum(delta-wallet_delta) filter(where created_at>=date_trunc('month',now())),0)::text as plan_used
    from ${S}.vachaspati_credit_ledger
    where account_id=$1 and reason in ('agent','stt','tts','refund')
   )
   select acc.*,slots.slot_count,rt.unit_size,rt.credits_per_unit,usg.day,usg.week,usg.plan_used
   from acc,slots,usg left join rt on true`,[accountId,capability]);
  const row=state.rows[0];
  if(!row)throw new QuotaError('No active subscription plan',403);
  if(Number(row.slot_count)>=row.concurrency_limit)throw new QuotaError('Concurrent request limit reached',429);
  if(!row.unit_size||!row.credits_per_unit)throw new QuotaError('Voice capability is unavailable',503);
  const credits=Math.ceil(units/row.unit_size)*Number(row.credits_per_unit);
  if(!Number.isSafeInteger(credits)||credits<=0)throw new QuotaError('Invalid credit rate',503);
  if(credits+Number(row.day)>Number(row.daily_limit)||credits+Number(row.week)>Number(row.weekly_limit))
   throw new QuotaError('Daily or weekly credit limit reached',429);
  const planRemaining=Math.max(0,Math.min(Number(row.monthly_credits),Number(row.monthly_limit))-Number(row.plan_used));
  const walletCharge=Math.max(0,credits-planRemaining);
  if(walletCharge>Number(row.wallet_credits))throw new QuotaError('Insufficient plan or prepaid credits',429);
  await client.query(`
   with upd as (
    update ${S}.vachaspati_accounts set wallet_credits=wallet_credits-$2 where id=$1 and $2>0
   ),
   led as (
    insert into ${S}.vachaspati_credit_ledger(account_id,delta,wallet_delta,reason,request_id)
    values($1,$3,$4,$5,$6)
   )
   insert into ${S}.vachaspati_concurrency_slots(account_id,request_id) values($1,$6)`,
   [accountId,walletCharge,-credits,-walletCharge,capability,requestId]);
  await client.query('commit');
  return {credits,requestId};
 }catch(e){await client.query('rollback');throw e;}finally{client.release();}
}
export async function finishUsage(account:string,requestId:string,capability:Capability,units:number,charge:number,statusCode:number,keyId?:string,modelId?:string){
 if(statusCode>=200&&statusCode<300){
  await database().query(`
   with acc as (select id from ${S}.vachaspati_accounts where id=$1 for update),
   del as (delete from ${S}.vachaspati_concurrency_slots where account_id=(select id from acc) and request_id=$2)
   insert into ${S}.vachaspati_api_usage(account_id,api_key_id,model_id,request_id,units,credits,status_code)
   select (select id from acc),$3,$4,$2,$5,$6,$7
   on conflict(request_id) do nothing`,
   [account,requestId,keyId??null,modelId??null,units,charge,statusCode]);
  return;
 }
 const client=await database().connect();
 try{
  await client.query('begin');
  await client.query('select id from '+S+'.vachaspati_accounts where id=$1 for update',[account]);
  await client.query(`delete from ${S}.vachaspati_concurrency_slots where account_id=$1 and request_id=$2`,[account,requestId]);
  const debited=await client.query<{delta:string;wallet_delta:string}>(`select delta::text,wallet_delta::text from ${S}.vachaspati_credit_ledger
    where account_id=$1 and request_id=$2 and reason=$3 limit 1`,[account,requestId,capability]);
  if(debited.rows[0]){
   const orig=debited.rows[0];
   const refund=await client.query(`insert into ${S}.vachaspati_credit_ledger(account_id,delta,wallet_delta,reason,request_id)
     values($1,$2,$3,'refund',$4) on conflict(account_id,request_id) do nothing returning id`,
     [account,-Number(orig.delta),-Number(orig.wallet_delta),'refund:'+requestId]);
   if(refund.rowCount&&Number(orig.wallet_delta)<0)
     await client.query(`update ${S}.vachaspati_accounts set wallet_credits=wallet_credits+$2 where id=$1`,
       [account,-Number(orig.wallet_delta)]);
  }
  await client.query(`insert into ${S}.vachaspati_api_usage(account_id,api_key_id,model_id,request_id,units,credits,status_code)
    values($1,$2,$3,$4,$5,$6,$7) on conflict(request_id) do nothing`,
    [account,keyId??null,modelId??null,requestId,units,statusCode,0]);
  await client.query('commit');
 }catch(e){await client.query('rollback');throw e;}finally{client.release();}
}
