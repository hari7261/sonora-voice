-- Vāchaspati AI: free OpenRouter chat failover registry.
-- Every table is private and prefixed. Supabase Auth is NOT used.
create table if not exists vachaspati_private.vachaspati_openrouter_fallbacks (
 model_id text primary key,
 name text not null,
 priority integer not null default 500 check(priority between 1 and 100000),
 enabled boolean not null default true,
 catalog_available boolean not null default false,
 context_length integer not null default 0,
 prompt_price numeric(22,12) not null default 0,
 completion_price numeric(22,12) not null default 0,
 last_verified_at timestamptz,
 updated_at timestamptz not null default now(),
 constraint vachaspati_openrouter_fallback_model_id_check check(
   length(model_id) between 5 and 140 and model_id ~ '^[a-zA-Z0-9._/-]+(:free)?$')
);
create index if not exists vachaspati_openrouter_fallbacks_order
 on vachaspati_private.vachaspati_openrouter_fallbacks(priority,model_id)
 where enabled=true;
alter table vachaspati_private.vachaspati_openrouter_fallbacks enable row level security;
revoke all on table vachaspati_private.vachaspati_openrouter_fallbacks from anon, authenticated;

-- A reply records the actual provider model, not the requested primary model.
alter table vachaspati_private.vachaspati_messages
 add column if not exists provider_model_id text;
alter table vachaspati_private.vachaspati_api_usage
 add column if not exists provider_model_id text;

insert into vachaspati_private.vachaspati_platform_settings(key,value,description)
values ('openrouter_free_fallbacks_enabled','true'::jsonb,
 'Allow catalog-verified free OpenRouter text models to be attempted after the primary model fails')
on conflict(key) do nothing;

-- Requested candidates are initially marked UNAVAILABLE.
-- They are NEVER routed until checked against the live OpenRouter catalog.
insert into vachaspati_private.vachaspati_openrouter_fallbacks
 (model_id,name,priority,enabled,catalog_available)
values
 ('nvidia/nemotron-3.5-lightning:free','NVIDIA Nemotron 3.5 Lightning',10,true,false),
 ('baidu/ernie-5.5-flash-preview:free','Baidu ERNIE 5.5 Flash Preview',20,true,false),
 ('google/gemma-4-26b-a4b-it:free','Google Gemma 4 26B A4B',30,true,false),
 ('google/gemma-4-31b-it:free','Google Gemma 4 31B',40,true,false),
 ('inclusionai/ling-3.2-flash:free','inclusionAI Ling 3.2 Flash',50,true,false),
 ('nvidia/nemotron-3-ultra-550b-a55b:free','NVIDIA Nemotron 3 Ultra',60,true,false),
 ('nvidia/nemotron-3.5-super-vl:free','NVIDIA Nemotron 3.5 Super VL',70,true,false),
 ('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free','NVIDIA Nemotron 3 Nano Omni',80,true,false),
 ('liquid/lfm-3-1.7b:free','LiquidAI LFM3 1.7B',90,true,false),
 ('particle-ai/particle-1:free','Particle AI Particle-1',100,true,false),
 ('recursive/flint-v1.0:free','Recursive Flint',110,true,false),
 ('openrouter/free','OpenRouter free model router',99999,true,false)
on conflict(model_id) do nothing;
