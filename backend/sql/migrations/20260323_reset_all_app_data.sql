begin;

truncate table
  public.user_route_like,
  public.user_route_place,
  public.user_route,
  public.course_place,
  public.course,
  public.user_comment,
  public.feed_like,
  public.feed,
  public.user_stamp,
  public.travel_session,
  public.public_event_map_link,
  public.public_event,
  public.public_place_map_link,
  public.public_place,
  public.public_data_source,
  public.map,
  public.user_identity,
  public."user"
restart identity cascade;

commit;
