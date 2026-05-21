create index if not exists idx_image_tasks_user_favorite_visible
  on image_tasks (user_id, favorite_at desc, created_at desc)
  where favorite_at is not null and hidden_at is null;

create index if not exists idx_image_tasks_user_visible_created
  on image_tasks (user_id, created_at desc)
  where hidden_at is null;
