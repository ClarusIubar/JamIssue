begin;

alter table if exists public.map
  add column if not exists image_url varchar(255),
  add column if not exists image_storage_path varchar(255);

commit;
