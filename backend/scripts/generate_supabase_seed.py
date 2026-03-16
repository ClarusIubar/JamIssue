from __future__ import annotations

import json
from pathlib import Path

from app.seed_data import COURSE_SEEDS, DEFAULT_STAMP_SLUGS, PLACE_SEEDS, REVIEW_SEEDS, USER_SEEDS


def sql_string(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def nullable_string(value: str | None) -> str:
    return "null" if value is None else sql_string(value)


root = Path(__file__).resolve().parents[1]
out_path = root / "sql" / "supabase_seed.sql"

lines: list[str] = []
lines.append("-- JamIssue Supabase seed data")
lines.append("-- 앱 초기 화면이 바로 보이도록 장소, 코스, 후기, 스탬프 기본 데이터를 채웁니다.")
lines.append("")

for user in USER_SEEDS:
    lines.append(
        "insert into public.\"user\" (user_id, email, nickname, provider) values "
        f"({sql_string(user['user_id'])}, {sql_string(user['email'])}, {sql_string(user['nickname'])}, {sql_string(user['provider'])}) "
        "on conflict (user_id) do update set "
        "email = excluded.email, nickname = excluded.nickname, provider = excluded.provider;"
    )
lines.append("")

for place in PLACE_SEEDS:
    vibe_tags = json.dumps(place["vibe_tags"], ensure_ascii=False).replace("'", "''")
    lines.append(
        "insert into public.map (slug, name, district, category, latitude, longitude, summary, description, vibe_tags, visit_time, route_hint, stamp_reward, hero_label, jam_color, accent_color, is_active) values "
        f"({sql_string(place['slug'])}, {sql_string(place['name'])}, {sql_string(place['district'])}, {sql_string(place['category'])}, {place['latitude']}, {place['longitude']}, {sql_string(place['summary'])}, {sql_string(place['description'])}, '{vibe_tags}'::jsonb, {sql_string(place['visit_time'])}, {sql_string(place['route_hint'])}, {sql_string(place['stamp_reward'])}, {sql_string(place['hero_label'])}, {sql_string(place['jam_color'])}, {sql_string(place['accent_color'])}, true) "
        "on conflict (slug) do update set "
        "name = excluded.name, district = excluded.district, category = excluded.category, latitude = excluded.latitude, longitude = excluded.longitude, summary = excluded.summary, description = excluded.description, vibe_tags = excluded.vibe_tags, visit_time = excluded.visit_time, route_hint = excluded.route_hint, stamp_reward = excluded.stamp_reward, hero_label = excluded.hero_label, jam_color = excluded.jam_color, accent_color = excluded.accent_color, is_active = excluded.is_active;"
    )
lines.append("")

for course in COURSE_SEEDS:
    lines.append(
        "insert into public.course (slug, title, mood, duration, note, color, display_order) values "
        f"({sql_string(course['slug'])}, {sql_string(course['title'])}, {sql_string(course['mood'])}, {sql_string(course['duration'])}, {sql_string(course['note'])}, {sql_string(course['color'])}, {course['display_order']}) "
        "on conflict (slug) do update set "
        "title = excluded.title, mood = excluded.mood, duration = excluded.duration, note = excluded.note, color = excluded.color, display_order = excluded.display_order;"
    )
lines.append("")

for course in COURSE_SEEDS:
    for stop_order, slug in enumerate(course["place_slugs"], start=1):
        lines.append(
            "insert into public.course_place (course_id, position_id, stop_order) values ("
            f"(select course_id from public.course where slug = {sql_string(course['slug'])}), "
            f"(select position_id from public.map where slug = {sql_string(slug)}), "
            f"{stop_order}) "
            "on conflict (course_id, position_id) do update set stop_order = excluded.stop_order;"
        )
lines.append("")

for review in REVIEW_SEEDS:
    lines.append(
        "insert into public.feed (position_id, user_id, body, mood, badge) values ("
        f"(select position_id from public.map where slug = {sql_string(review['slug'])}), "
        f"{sql_string(review['user_id'])}, {sql_string(review['body'])}, {sql_string(review['mood'])}, {sql_string(review['badge'])}) "
        "on conflict do nothing;"
    )
lines.append("")

for slug in DEFAULT_STAMP_SLUGS:
    lines.append(
        "insert into public.user_stamp (user_id, position_id) values ("
        f"'jam-demo-user', (select position_id from public.map where slug = {sql_string(slug)})) "
        "on conflict (user_id, position_id) do nothing;"
    )

out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(out_path)
