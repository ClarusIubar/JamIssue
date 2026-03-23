begin;

update public.map
set district = '서구',
    latitude = 36.3688239,
    longitude = 127.3879822,
    updated_at = now()
where slug = '070-한밭수목원';

update public.map
set district = '유성구',
    latitude = 36.3601462,
    longitude = 127.3570634,
    updated_at = now()
where slug = '071-유림공원';

commit;
