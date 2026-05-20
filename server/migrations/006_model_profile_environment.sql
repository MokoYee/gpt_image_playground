alter table model_profiles
  add column if not exists environment text not null default 'all';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'model_profiles_environment_check'
      and conrelid = 'model_profiles'::regclass
  ) then
    alter table model_profiles
      add constraint model_profiles_environment_check
      check (environment in ('all', 'development', 'production'));
  end if;
end $$;

create index if not exists idx_model_profiles_environment_enabled
  on model_profiles (environment, enabled);
