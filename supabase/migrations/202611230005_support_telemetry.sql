create table if not exists vachaspati_private.vachaspati_support_tickets (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references vachaspati_private.vachaspati_accounts(id) on delete cascade,
 opened_by uuid not null references vachaspati_private.vachaspati_users(id),
 assigned_to uuid references vachaspati_private.vachaspati_users(id),
 subject text not null check(length(subject) between 4 and 200),
 category text not null check(category in ('billing','account','voice','agent','api','other')),
 priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
 status text not null default 'open' check(status in ('open','in_progress','waiting_customer','resolved','closed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 resolved_at timestamptz
);
create index if not exists vachaspati_support_tickets_account on vachaspati_private.vachaspati_support_tickets(account_id,created_at desc);
create table if not exists vachaspati_private.vachaspati_support_messages (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references vachaspati_private.vachaspati_support_tickets(id) on delete cascade,
 author_id uuid not null references vachaspati_private.vachaspati_users(id),
 content text not null check(length(content) between 1 and 10000),
 internal boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists vachaspati_support_messages_ticket on vachaspati_private.vachaspati_support_messages(ticket_id,created_at asc);
create table if not exists vachaspati_private.vachaspati_service_checks (
 id bigint generated always as identity primary key,
 service text not null,
 status text not null check(status in ('healthy','unavailable','not_configured','degraded')),
 latency_ms integer,
 details text not null default '',
 checked_at timestamptz not null default now()
);
create index if not exists vachaspati_service_checks_recent on vachaspati_private.vachaspati_service_checks(checked_at desc);
create table if not exists vachaspati_private.vachaspati_announcements (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(title) between 3 and 200),
 content text not null check(length(content) between 1 and 5000),
 audience text not null default 'all' check(audience in ('all','developers','billing')),
 published boolean not null default false,
 created_by uuid references vachaspati_private.vachaspati_users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
do $$
declare t text;
begin
 for t in select tablename from pg_tables where schemaname='vachaspati_private' and tablename like 'vachaspati_%'
 loop
   execute format('alter table vachaspati_private.%I enable row level security',t);
   execute format('revoke all on table vachaspati_private.%I from anon,authenticated',t);
 end loop;
end $$;
