-- JamIssue Supabase Storage setup
-- Supabase SQL Editor에서 그대로 실행하면 review-images와 place-images 버킷을 생성하거나 갱신합니다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'review-images',
    'review-images',
    true,
    5242880,
    array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  ),
  (
    'place-images',
    'place-images',
    true,
    10485760,
    array['image/png', 'image/jpeg', 'image/webp']
  )
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
