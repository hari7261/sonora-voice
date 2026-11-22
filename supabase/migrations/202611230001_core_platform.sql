-- Vāchaspati AI core schema (run on the dedicated Supabase project)
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text, created_at timestamptz not null default now()
);
create table if not exists public.voice_models (
 id text primary key, name text not null, capability text not null,
 description text not null default '', enabled boolean not null default false,
 config jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.model_languages (
 model_id text not null references public.voice_models(id) on delete cascade,
 language_code text not null, primary key(model_id,language_code)
);
create table if not exists public.plans (
 id uuid primary key default gen_random_uuid(), code text unique not null,
 name text not null, monthly_credits bigint not null check(monthly_credits>=0),
 daily_limit bigint not null check(daily_limit>=0),
 weekly_limit bigint not null check(weekly_limit>=0),
 monthly_limit bigint not null check(monthly_limit>=0),
 concurrency_limit int not null check(concurrency_limit>0),
 enabled boolean not null default false
);
create table if not exists public.accounts (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null, plan_id uuid references public.plans(id),
 created_at timestamptz not null default now()
);
create table if not exists public.account_members (
 account_id uuid not null references public.accounts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','admin','developer','viewer')),
 primary key(account_id,user_id)
);
create table if not exists public.agents (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references public.accounts(id) on delete cascade,
 name text not null, instructions text not null default '',
 model_id text references public.voice_models(id), language_code text not null default 'en',
 voice_id text, status text not null default 'draft' check(status in ('draft','active','paused')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.agent_domains (
 agent_id uuid not null references public.agents(id) on delete cascade,
 domain text not null, primary key(agent_id,domain)
);
create table if not exists public.api_keys (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references public.accounts(id) on delete cascade,
 label text not null, key_prefix text not null,
 key_hash text not null unique, scopes text[] not null default '{}',
 revoked_at timestamptz, expires_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.conversations (
 id uuid primary key default gen_random_uuid(),
 agent_id uuid not null references public.agents(id) on delete cascade,
 session_token_hash text, started_at timestamptz not null default now(),
 ended_at timestamptz
);
create table if not exists public.messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 role text not null check(role in ('user','assistant','system','tool')),
 content text not null, created_at timestamptz not null default now()
);
create table if not exists public.credit_ledger (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references public.accounts(id) on delete cascade,
 delta bigint not null check(delta<>0), reason text not null,
 request_id text, created_at timestamptz not null default now(),
 unique(account_id,request_id)
);
create table if not exists public.api_usage (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references public.accounts(id) on delete cascade,
 api_key_id uuid references public.api_keys(id) on delete set null,
 model_id text references public.voice_models(id),
 request_id text not null unique, units bigint not null check(units>=0),
 credits bigint not null check(credits>=0), status_code int not null,
 created_at timestamptz not null default now()
);
create index if not exists api_usage_account_time on public.api_usage(account_id,created_at desc);
create index if not exists credit_ledger_account_time on public.credit_ledger(account_id,created_at desc);
create index if not exists agents_account on public.agents(account_id);
create or replace function public.is_account_member(a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.account_members m where m.account_id=a and m.user_id=(select auth.uid()))
$$;
revoke all on function public.is_account_member(uuid) from public;
grant execute on function public.is_account_member(uuid) to authenticated;
alter table public.profiles enable row level security;
alter table public.voice_models enable row level security;
alter table public.model_languages enable row level security;
alter table public.plans enable row level security;
alter table public.accounts enable row level security;
alter table public.account_members enable row level security;
alter table public.agents enable row level security;
alter table public.agent_domains enable row level security;
alter table public.api_keys enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.api_usage enable row level security;
create policy "read own profile" on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy "update own profile" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy "public enabled models" on public.voice_models for select to anon,authenticated using(enabled=true);
create policy "public enabled model languages" on public.model_languages for select to anon,authenticated using(exists(select 1 from public.voice_models v where v.id=model_id and v.enabled));
create policy "public enabled plans" on public.plans for select to anon,authenticated using(enabled=true);
create policy "read own accounts" on public.accounts for select to authenticated using(public.is_account_member(id));
create policy "read account members" on public.account_members for select to authenticated using(public.is_account_member(account_id));
create policy "read account agents" on public.agents for select to authenticated using(public.is_account_member(account_id));
create policy "write account agents" on public.agents for insert to authenticated with check(exists(select 1 from public.account_members m where m.account_id=agents.account_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','developer')));
create policy "update account agents" on public.agents for update to authenticated using(exists(select 1 from public.account_members m where m.account_id=agents.account_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','developer'))) with check(exists(select 1 from public.account_members m where m.account_id=agents.account_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','developer')));
create policy "read agent domains" on public.agent_domains for select to authenticated using(exists(select 1 from public.agents a where a.id=agent_id and public.is_account_member(a.account_id)));
create policy "read key metadata" on public.api_keys for select to authenticated using(public.is_account_member(account_id));
create policy "read conversations" on public.conversations for select to authenticated using(exists(select 1 from public.agents a where a.id=agent_id and public.is_account_member(a.account_id)));
create policy "read messages" on public.messages for select to authenticated using(exists(select 1 from public.conversations c join public.agents a on a.id=c.agent_id where c.id=conversation_id and public.is_account_member(a.account_id)));
create policy "read credit ledger" on public.credit_ledger for select to authenticated using(public.is_account_member(account_id));
create policy "read usage" on public.api_usage for select to authenticated using(public.is_account_member(account_id));
-- Key creation, billing mutations, agent sessions and usage charging are server-only.
-- Never expose service-role credentials to the browser. Do not enable client writes to financial tables.
