alter table image_tasks
  add column if not exists credits_reserved numeric(18,4) not null default 0,
  add column if not exists hidden_at timestamptz,
  add column if not exists favorite_at timestamptz;

create unique index if not exists uq_image_tasks_user_local_task
  on image_tasks (user_id, local_task_id)
  where local_task_id is not null;

create table if not exists model_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  provider text not null default 'openai-compatible',
  base_url text not null,
  api_key text,
  model text not null,
  api_mode text not null check (api_mode in ('images', 'responses')),
  timeout_seconds integer not null default 120 check (timeout_seconds between 10 and 900),
  enabled boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id)
);

create unique index if not exists uq_model_profiles_default on model_profiles (is_default) where is_default;

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id),
  actor_username text,
  action text not null,
  target_type text not null,
  target_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created on audit_logs (created_at desc);
create index if not exists idx_audit_logs_actor_created on audit_logs (actor_id, created_at desc);

insert into model_profiles (name, provider, base_url, api_key, model, api_mode, timeout_seconds, enabled, is_default)
select
  '默认模型',
  coalesce(value->>'provider', 'openai-compatible'),
  coalesce(value->>'baseUrl', 'https://api.openai.com/v1'),
  value->>'apiKey',
  coalesce(value->>'model', 'gpt-image-2'),
  coalesce(value->>'apiMode', 'images'),
  coalesce((value->>'timeoutSeconds')::integer, 120),
  true,
  true
from system_settings
where key = 'imageApi'
  and not exists (select 1 from model_profiles where is_default);
