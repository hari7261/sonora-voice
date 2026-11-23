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
  const account=await client.query<Plan>(`
   select p.monthly_credits::text,p.daily_limit::text,p.weekly_limit::text,p.monthly_limit::text,p.concurrency_limit,
    a.wallet_credits::text
   from ${S}.vachaspati_accounts a join ${S}.vachaspati_plans p on p.id=a.plan_id
   where a.id=$1 and p.enabled=true for update of a`,[accountId]);
  if(!account.rows[0])throw new QuotaError('No active subscription plan',403);
  await client.query(`delete from ${S}.vachaspati_concurrency_slots where account_id=$1 and expires_at<now()`,[accountId]);
  const slots=await client.query<{count:string}>(`select count(*)::text as count from ${S}.vachaspati_concurrency_slots where account_id=$1`,[accountId]);
  if(Number(slots.rows[0]?.count??0)>=account.rows[0].concurrency_limit)throw new QuotaError('Concurrent request limit reached',429);
  const rate=await client.query<Rate>(`select unit_size,credits_per_unit::text from ${S}.vachaspati_rates where capability=$1 and enabled=true`,[capability]);
  if(!rate.rows[0])throw new QuotaError('Voice capability is unavailable',503);
  const credits=Math.ceil(units/rate.rows[0].unit_size)*Number(rate.rows[0].credits_per_unit);
  if(!Number.isSafeInteger(credits)||credits<=0)throw new QuotaError('Invalid credit rate',503);
  const usage=await client.query<{day:string;week:string;month:string;plan_used:string}>(`
    select
      coalesce(-sum(delta) filter(where created_at>=date_trunc('day',now())),0)::text as day,
      coalesce(-sum(delta) filter(where created_at>=date_trunc('week',now())),0)::text as week,
      coalesce(-sum(delta) filter(where created_at>=date_trunc('month',now())),0)::text as month,
      coalesce(-sum(delta-wallet_delta) filter(where created_at>=date_trunc('month',now())),0)::text as plan_used
    from ${S}.vachaspati_credit_ledger
    where account_id=$1 and reason in ('agent','stt','tts','refund')`,[accountId]);
  const p=account.rows[0],u=usage.rows[0];
  if(credits+Number(u.day)>Number(p.daily_limit)||credits+Number(u.week)>Number(p.weekly_limit))
   throw new QuotaError('Daily or weekly credit limit reached',429);
  const planRemaining=Math.max(0,Math.min(Number(p.monthly_credits),Number(p.monthly_limit))-Number(u.plan_used));
  const walletCharge=Math.max(0,credits-planRemaining);
  if(walletCharge>Number(p.wallet_credits))throw new QuotaError('Insufficient plan or prepaid credits',429);
  if(walletCharge>0)await client.query(`update ${S}.vachaspati_accounts set wallet_credits=wallet_credits-$2 where id=$1`,[accountId,walletCharge]);
  await client.query(`insert into ${S}.vachaspati_credit_ledger(account_id,delta,wallet_delta,reason,request_id)
    values($1,$2,$3,$4,$5)`,[accountId,-credits,-walletCharge,capability,requestId]);
  await client.query(`insert into ${S}.vachaspati_concurrency_slots(account_id,request_id) values($1,$2)`,[accountId,requestId]);
  await client.query('commit');
  return {credits,requestId};
 }catch(e){await client.query('rollback');throw e;}finally{client.release();}
}
export async function finishUsage(account:string,requestId:string,capability:Capability,units:number,charge:number,statusCode:number,keyId?:string,modelId?:string){
 const client=await database().connect();
 try{
  await client.query('begin');
  await client.query('select id from '+S+'.vachaspati_accounts where id=$1 for update',[account]);
  await client.query(`delete from ${S}.vachaspati_concurrency_slots where account_id=$1 and request_id=$2`,[account,requestId]);
  if(statusCode<200||statusCode>=300){
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
  }
  await client.query(`insert into ${S}.vachaspati_api_usage(account_id,api_key_id,model_id,request_id,units,credits,status_code)
    values($1,$2,$3,$4,$5,$6,$7) on conflict(request_id) do nothing`,
    [account,keyId??null,modelId??null,requestId,units,statusCode,(statusCode>=200&&statusCode<300)?charge:0]);
  await client.query('commit');
 }catch(e){await client.query('rollback');throw e;}finally{client.release();}
}
