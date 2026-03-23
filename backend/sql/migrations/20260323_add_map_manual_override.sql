begin;

alter table if exists public.map
  add column if not exists is_manual_override boolean not null default false;

commit;
