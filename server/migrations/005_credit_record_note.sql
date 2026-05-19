alter table credit_records
  add column if not exists note text not null default '';
