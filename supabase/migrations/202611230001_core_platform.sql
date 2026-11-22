-- Vāchaspati AI: dedicated custom-credentials data model.
-- PostgreSQL is hosted on Supabase. Supabase Auth / auth.users / auth.uid() are NOT used.
-- No migrations have been applied to a live project automatically.
-- All platform tables live in a non-exposed schema and begin with vachaspati_.
create extension if not exists pgcrypto;
create schema if not exists vachaspati_private;
revoke all on schema vachaspati_private from public;
revoke all on schema vachaspati_private from anon, authenticated;

create table if not exists vachaspati_private.vachaspati_users (
 id uuid primary key default gen_random_uuid(),
 email text not null unique check (length(email) between 3 and 254),
 password_hash text not null,
 display_name text not null check (length(display_name) between 1 and 120),
 email_verified_at timestamptz,
 disabled_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint vachaspati_users_email_lowercase check(email=lower(btrim(email)))
);
create table if not exists vachaspati_private.vachaspati_sessions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references vachaspati_private.vachaspati_users(id) on delete cascade,
 token_hash text not null unique,
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 revoked_at timestamptz
);
create index if not exists vachaspati_sessions_active_idx on vachaspati_private.vachaspati_sessions(user_id,expires_at) where revoked_at is null;

create table if not exists vachaspati_private.vachaspati_login_attempts (
 id bigint generated always as identity primary key,
 identifier_hash text not null,
 attempted_at timestamptz not null default now()
);
create index if not exists vachaspati_login_attempts_time_idx on vachaspati_private.vachaspati_login_attempts(identifier_hash,attempted_at desc);

create table if not exists vachaspati_private.vachaspati_password_resets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references vachaspati_private.vachaspati_users(id) on delete cascade,
 token_hash text not null unique,
 expires_at timestamptz not null,
 used_at timestamptz,
 created_at timestamptz not null default now()
);

create table if not exists vachaspati_private.vachaspati_voice_models (
 id text primary key,
 name text not null,
 capability text not null,
 description text not null default '',
 enabled boolean not null default false,
 config jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table if not exists vachaspati_private.vachaspati_model_languages (
 model_id text not null references vachaspati_private.vachaspati_voice_models(id) on delete cascade,
 language_code text not null,
 primary key(model_id,language_code)
);
create table if not exists vachaspati_private.vachaspati_plans (
 id uuid primary key default gen_random_uuid(),
 code text unique not null,
 name text not null,
 monthly_credits bigint not null check(monthly_credits>=0),
 daily_limit bigint not null check(daily_limit>=0),
 weekly_limit bigint not null check(weekly_limit>=0),
 monthly_limit bigint not null check(monthly_limit>=0),
 concurrency_limit int not null check(concurrency_limit>0),
 enabled boolean not null default false
);
create table if not exists vachaspati_private.vachaspati_accounts (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references vachaspati_private.vachaspati_users(id),
 name text not null,
 plan_id uuid references vachaspati_private.vachaspati_plans(id),
 created_at timestamptz not null default now()
);
create table if not exists vachaspati_private.vachaspati_account_members (
 account_id uuid not null references vachaspati_private.vachaspati_accounts(id) on delete cascade,
 user_id uuid not null references vachaspati_private.vachaspati_users(id) on delete cascade,
 role text not null check(role in ('owner','admin','developer','viewer')),
 primary key(account_id,user_id)
);
create table if not exists vachaspati_private.vachaspati_agents (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references vachaspati_private.vachaspati_accounts(id) on delete cascade,
 name text not null, instructions text not null default '',
 model_id text references vachaspati_private.vachaspati_voice_models(id),
 language_code text not null default 'en', voice_id text,
 status text not null default 'draft' check(status in ('draft','active','paused')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists vachaspati_private.vachaspati_agent_domains (
 agent_id uuid not null references vachaspati_private.vachaspati_agents(id) on delete cascade,
 domain text not null, primary key(agent_id,domain)
);
create table if not exists vachaspati_private.vachaspati_api_keys (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references vachaspati_private.vachaspati_accounts(id) on delete cascade,
 label text not null, key_prefix text not null, key_hash text not null unique,
 scopes text[] not null default '{}',
 revoked_at timestamptz, expires_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists vachaspati_private.vachaspati_conversations (
 id uuid primary key default gen_random_uuid(),
 agent_id uuid not null references vachaspati_private.vachaspati_agents(id) on delete cascade,
 session_token_hash text, started_at timestamptz not null default now(),
 ended_at timestamptz
);
create table if not exists vachaspati_private.vachaspati_messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references vachaspati_private.vachaspati_conversations(id) on delete cascade,
 role text not null check(role in ('user','assistant','system','tool')),
 content text not null, created_at timestamptz not null default now()
);
create table if not exists vachaspati_private.vachaspati_credit_ledger (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references vachaspati_private.vachaspati_accounts(id) on delete cascade,
 delta bigint not null check(delta<>0), reason text not null,
 request_id text,
 created_at timestamptz not null default now(),
 unique(account_id,request_id)
);
create table if not exists vachaspati_private.vachaspati_api_usage (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references vachaspati_private.vachaspati_accounts(id) on delete cascade,
 api_key_id uuid references vachaspati_private.vachaspati_api_keys(id) on delete set null,
 model_id text references vachaspati_private.vachaspati_voice_models(id),
 request_id text not null unique,
 units bigint not null check(units>=0),
 credits bigint not null check(credits>=0),
 status_code int not null,
 created_at timestamptz not null default now()
);
create index if not exists vachaspati_usage_account_time on vachaspati_private.vachaspati_api_usage(account_id,created_at desc);
create index if not exists vachaspati_ledger_account_time on vachaspati_private.vachaspati_credit_ledger(account_id,created_at desc);
create index if not exists vachaspati_agents_account on vachaspati_private.vachaspati_agents(account_id);

-- Defense in depth. These tables are NEVER exposed via Supabase Data API.
-- The app accesses them only through server-side, scoped SQL queries.
do $$
declare tbl text;
begin
 for tbl in select tablename from pg_tables where schemaname='vachaspati_private' and tablename like 'vachaspati_%'
 loop
   execute format('alter table vachaspati_private.%I enable row level security',tbl);
   execute format('revoke all on table vachaspati_private.%I from anon, authenticated',tbl);
 end loop;
end $$;
