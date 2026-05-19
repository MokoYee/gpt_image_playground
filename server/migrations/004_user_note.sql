alter table users
  add column if not exists note text not null default '',
  add column if not exists last_login_at timestamptz,
  add column if not exists last_active_at timestamptz;

create index if not exists idx_users_last_active on users (last_active_at desc);
