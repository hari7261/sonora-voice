create table if not exists vachaspati_private.vachaspati_email_verifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references vachaspati_private.vachaspati_users(id) on delete cascade,
 token_hash text not null unique,
 expires_at timestamptz not null,
 used_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists vachaspati_email_verification_user on vachaspati_private.vachaspati_email_verifications(user_id,expires_at);
alter table vachaspati_private.vachaspati_email_verifications enable row level security;
revoke all on table vachaspati_private.vachaspati_email_verifications from anon,authenticated;
insert into vachaspati_private.vachaspati_platform_settings(key,value,description)
values ('email_verification_required','false'::jsonb,'Require confirmed email before account access')
on conflict(key) do nothing;
