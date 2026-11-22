-- Add real runtime controls to the custom email/password Vāchaspati database.
create table if not exists vachaspati_private.vachaspati_rates (
 id uuid primary key default gen_random_uuid(),
 capability text not null unique check (capability in ('agent','stt','tts')),
 unit_size integer not null check(unit_size>0),
 credits_per_unit bigint not null check(credits_per_unit>0),
 enabled boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table vachaspati_private.vachaspati_rates enable row level security;
revoke all on table vachaspati_private.vachaspati_rates from anon,authenticated;
alter table vachaspati_private.vachaspati_agents add column if not exists llm_model text;
alter table vachaspati_private.vachaspati_agents add column if not exists greeting text not null default '';
alter table vachaspati_private.vachaspati_agents add column if not exists accent_color text not null default '#de6847';
alter table vachaspati_private.vachaspati_agents add column if not exists interaction_mode text not null default 'voice-text';
insert into vachaspati_private.vachaspati_plans(code,name,monthly_credits,daily_limit,weekly_limit,monthly_limit,concurrency_limit,enabled)
 values ('starter','Starter',1000,300,700,1000,2,true) on conflict(code) do nothing;
insert into vachaspati_private.vachaspati_rates(capability,unit_size,credits_per_unit,enabled)
 values ('agent',1,1,true),('stt',10,1,true),('tts',100,1,true) on conflict(capability) do nothing;
create table if not exists vachaspati_private.vachaspati_request_limits (
 id bigint generated always as identity primary key,
 request_hash text not null,
 attempted_at timestamptz not null default now()
);
create index if not exists vachaspati_request_limits_lookup on vachaspati_private.vachaspati_request_limits(request_hash,attempted_at desc);
alter table vachaspati_private.vachaspati_request_limits enable row level security;
revoke all on table vachaspati_private.vachaspati_request_limits from anon,authenticated;
create table if not exists vachaspati_private.vachaspati_concurrency_slots (
 request_id text primary key,
 account_id uuid not null references vachaspati_private.vachaspati_accounts(id) on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '2 minutes'
);
create index if not exists vachaspati_concurrency_account_expiry on vachaspati_private.vachaspati_concurrency_slots(account_id,expires_at);
alter table vachaspati_private.vachaspati_concurrency_slots enable row level security;
revoke all on table vachaspati_private.vachaspati_concurrency_slots from anon,authenticated;
