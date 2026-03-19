begin;

alter table public.map
  add column if not exists image_url varchar(255);

with duplicated as (
  select user_id,
         nickname,
         row_number() over (partition by lower(nickname) order by created_at, user_id) as row_num
  from public."user"
),
renamed as (
  select user_id,
         case
           when row_num = 1 then nickname
           else left(nickname, 95) || row_num::text
         end as next_nickname
  from duplicated
)
update public."user" u
set nickname = renamed.next_nickname,
    updated_at = now()
from renamed
where u.user_id = renamed.user_id
  and u.nickname is distinct from renamed.next_nickname;

create unique index if not exists uq_user_nickname_lower on public."user"(lower(nickname));

commit;