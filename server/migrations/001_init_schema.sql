create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  email text not null,
  password_hash text not null,
  role text not null check (role in ('user', 'admin')),
  status text not null default 'enabled' check (status in ('enabled', 'disabled', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists uq_users_username_active on users (lower(username)) where status <> 'deleted';
create unique index if not exists uq_users_email_active on users (lower(email)) where status <> 'deleted';

create table if not exists user_wallets (
  user_id uuid primary key references users(id),
  credits numeric(18,4) not null default 0 check (credits >= 0),
  multiplier numeric(10,4) not null default 1 check (multiplier >= 0),
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id)
);

create table if not exists credit_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  type text not null check (type in ('recharge', 'refund')),
  amount numeric(18,4) not null check (amount > 0),
  operator_id uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_records_user_created on credit_records (user_id, created_at desc);

create table if not exists image_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  prompt text not null,
  params jsonb not null,
  api_provider text,
  api_model text,
  status text not null check (status in ('running', 'done', 'error')),
  error text,
  elapsed_ms integer,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_image_tasks_user_created on image_tasks (user_id, created_at desc);

create table if not exists image_files (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references image_tasks(id),
  user_id uuid not null references users(id),
  source text not null check (source in ('upload', 'generated', 'mask')),
  storage_provider text not null default 'local',
  relative_path text not null,
  sha256 text not null,
  mime_type text not null,
  size_bytes bigint not null,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_image_files_task on image_files (task_id);
create index if not exists idx_image_files_user_created on image_files (user_id, created_at desc);

create table if not exists usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  task_id uuid references image_tasks(id),
  prompt text not null,
  quality text not null,
  image_count integer not null check (image_count > 0),
  base_credits numeric(18,4) not null,
  multiplier numeric(10,4) not null,
  total_credits numeric(18,4) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_records_user_created on usage_records (user_id, created_at desc);

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  status text not null default 'enabled' check (status in ('enabled', 'disabled', 'deleted')),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

insert into system_settings (key, value)
values
  ('auth', '{"registrationOpen": true, "defaultCredits": 20, "defaultMultiplier": 1}'::jsonb),
  ('storage', '{"provider": "local", "s3Enabled": false}'::jsonb),
  ('imageApi', '{"provider": "openai-compatible", "baseUrl": "https://api.openai.com/v1", "model": "gpt-image-2", "apiMode": "images", "timeoutSeconds": 120}'::jsonb)
on conflict (key) do nothing;
