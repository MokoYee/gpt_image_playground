alter table user_wallets
  add column if not exists concurrency_limit integer check (concurrency_limit is null or concurrency_limit > 0);

alter table image_tasks
  drop constraint if exists image_tasks_status_check;

alter table image_tasks
  add constraint image_tasks_status_check
  check (status in ('queued', 'running', 'done', 'error', 'cancelled'));

alter table image_tasks
  add column if not exists local_task_id text,
  add column if not exists queued_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists queue_position_snapshot integer,
  add column if not exists last_heartbeat_at timestamptz,
  add column if not exists credits_estimated numeric(18,4),
  add column if not exists credits_charged numeric(18,4),
  add column if not exists image_count integer,
  add column if not exists raw_image_urls jsonb,
  add column if not exists actual_params jsonb,
  add column if not exists actual_params_by_image jsonb,
  add column if not exists revised_prompt_by_image jsonb;

create index if not exists idx_image_tasks_status_queued on image_tasks (status, queued_at, created_at);
create index if not exists idx_image_tasks_user_status_created on image_tasks (user_id, status, created_at desc);
create index if not exists idx_image_tasks_user_local_task on image_tasks (user_id, local_task_id) where local_task_id is not null;

insert into system_settings (key, value)
values ('queue', '{"globalConcurrency": 10, "defaultUserConcurrency": 3, "maxQueueSize": 100}'::jsonb)
on conflict (key) do nothing;
