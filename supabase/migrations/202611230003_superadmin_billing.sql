-- Vāchaspati superadmin, observability and prepaid billing foundation.
-- Custom credentials only; no Supabase Auth dependencies. Every new table starts vachaspati_.
create table if not exists vachaspati_private.vachaspati_admin_roles (
 user_id uuid primary key references vachaspati_private.vachaspati_users(id) on delete cascade,
 role text not null check(role in ('superadmin','operations','support','finance','analyst')),
 active boolean not null default true,
 created_by uuid references vachaspati_private.vachaspati_users(id),
 created_at timestamptz not null default now()
);
create table if not exists vachaspati_private.vachaspati_admin_mfa (
 user_id uuid primary key references vachaspati_private.vachaspati_users(id) on delete cascade,
 secret_encrypted text not null,
 confirmed_at timestamptz,
 last_counter bigint not null default -1,
 created_at timestamptz not null default now()
);
create table if not exists vachaspati_private.vachaspati_admin_sessions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references vachaspati_private.vachaspati_users(id) on delete cascade,
 token_hash text unique not null,
 expires_at timestamptz not null,
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists vachaspati_admin_sessions_lookup on vachaspati_private.vachaspati_admin_sessions(user_id,expires_at) where revoked_at is null;
create table if not exists vachaspati_private.vachaspati_admin_audit (
 id bigint generated always as identity primary key,
 actor_id uuid references vachaspati_private.vachaspati_users(id) on delete set null,
 action text not null,
 target_type text not null,
 target_id text,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists vachaspati_admin_audit_recent on vachaspati_private.vachaspati_admin_audit(created_at desc);
create table if not exists vachaspati_private.vachaspati_platform_settings (
 key text primary key,
 value jsonb not null,
 description text not null default '',
 updated_by uuid references vachaspati_private.vachaspati_users(id) on delete set null,
 updated_at timestamptz not null default now()
);
create table if not exists vachaspati_private.vachaspati_credit_packages (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 description text not null default '',
 credits bigint not null check(credits>0),
 price_paise bigint not null check(price_paise>=100),
 currency char(3) not null default 'INR' check(currency='INR'),
 enabled boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists vachaspati_private.vachaspati_payment_orders (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references vachaspati_private.vachaspati_accounts(id),
 user_id uuid not null references vachaspati_private.vachaspati_users(id),
 package_id uuid not null references vachaspati_private.vachaspati_credit_packages(id),
 credits bigint not null check(credits>0),
 amount_paise bigint not null check(amount_paise>=100),
 currency char(3) not null default 'INR',
 provider text not null check(provider='razorpay'),
 provider_order_id text unique,
 provider_payment_id text unique,
 status text not null default 'pending' check(status in ('pending','created','paid','failed','refunded')),
 created_at timestamptz not null default now(),
 paid_at timestamptz
);
create index if not exists vachaspati_payment_orders_account on vachaspati_private.vachaspati_payment_orders(account_id,created_at desc);
create table if not exists vachaspati_private.vachaspati_payment_events (
 id bigint generated always as identity primary key,
 provider text not null,
 event_id text not null unique,
 event_type text not null,
 order_id uuid references vachaspati_private.vachaspati_payment_orders(id),
 created_at timestamptz not null default now()
);
create table if not exists vachaspati_private.vachaspati_service_incidents (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 details text not null default '',
 severity text not null check(severity in ('low','medium','high','critical')),
 status text not null default 'investigating' check(status in ('investigating','identified','monitoring','resolved')),
 created_by uuid references vachaspati_private.vachaspati_users(id),
 created_at timestamptz not null default now(),
 resolved_at timestamptz
);
-- Wallet balance holds purchased/prepaid credits independent of plan month.
alter table vachaspati_private.vachaspati_accounts add column if not exists wallet_credits bigint not null default 0 check(wallet_credits>=0);
alter table vachaspati_private.vachaspati_credit_ledger add column if not exists wallet_delta bigint not null default 0;
-- Dynamic operational settings; no custom IDs are hardcoded.
insert into vachaspati_private.vachaspati_platform_settings(key,value,description)
 values ('signup_enabled','true'::jsonb,'Allow new registrations'),
 ('agent_publishing_enabled','true'::jsonb,'Allow customers to publish new agents'),
 ('maintenance_mode','false'::jsonb,'Temporarily disable public AI execution')
 on conflict(key) do nothing;
do $$
declare t text;
begin
 for t in select tablename from pg_tables where schemaname='vachaspati_private' and tablename like 'vachaspati_%'
 loop
   execute format('alter table vachaspati_private.%I enable row level security',t);
   execute format('revoke all on table vachaspati_private.%I from anon, authenticated',t);
 end loop;
end $$;
