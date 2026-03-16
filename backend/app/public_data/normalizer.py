"""Normalize external tourism records into JamIssue map-ready records."""

from __future__ import annotations

import hashlib
import re

from .schemas import NormalizedPublicPlace, PublicPlacePayload


CATEGORY_ALIASES = {
    "landmark": "landmark",
    "명소": "landmark",
    "관광지": "landmark",
    "문화시설": "landmark",
    "food": "food",
    "맛집": "food",
    "음식": "food",
    "cafe": "cafe",
    "카페": "cafe",
    "night": "night",
    "야경": "night",
    "nightspot": "night",
}

CATEGORY_DEFAULTS = {
    "landmark": {
        "vibe_tags": ["산책", "기억 포인트", "대표 스팟"],
        "visit_time": "40분 - 1시간 20분",
        "route_hint": "근처 스팟과 묶어 반나절 코스로 보기 좋아요",
        "stamp_reward": "대표 스팟 스탬프 획득",
        "hero_label": "City Spot",
        "jam_color": "#8bc8ff",
        "accent_color": "#7ce0cf",
    },
    "food": {
        "vibe_tags": ["로컬픽", "한입 코스", "먹거리"],
        "visit_time": "30분 - 1시간",
        "route_hint": "근처 산책 동선과 함께 묶으면 만족도가 높아요",
        "stamp_reward": "먹거리 스탬프 획득",
        "hero_label": "Taste Stop",
        "jam_color": "#ff8d63",
        "accent_color": "#ffcf69",
    },
    "cafe": {
        "vibe_tags": ["사진", "소품", "카페"],
        "visit_time": "40분 - 1시간 30분",
        "route_hint": "짧은 이동 안에서 여러 스팟을 묶기 좋아요",
        "stamp_reward": "카페 스탬프 획득",
        "hero_label": "Mood Break",
        "jam_color": "#ff9fd0",
        "accent_color": "#91a7ff",
    },
    "night": {
        "vibe_tags": ["노을", "야경", "데이트"],
        "visit_time": "30분 - 50분",
        "route_hint": "저녁 시간대 코스와 연결하면 좋아요",
        "stamp_reward": "야경 스탬프 획득",
        "hero_label": "Night View",
        "jam_color": "#ff5f8f",
        "accent_color": "#7e9dff",
    },
}


def slugify_candidate(value: str | None) -> str:
    """Build a stable internal slug candidate from an external value."""

    text = (value or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    if text:
        return text

    digest = hashlib.sha1((value or "public-place").encode("utf-8")).hexdigest()
    return f"public-place-{digest[:10]}"


def normalize_category(raw_category: str | None) -> str:
    """Map external categories into JamIssue's internal categories."""

    key = (raw_category or "landmark").strip().lower()
    return CATEGORY_ALIASES.get(key, "landmark")


def normalize_public_place(record: PublicPlacePayload) -> NormalizedPublicPlace:
    """Normalize an external place record into a map-ready payload."""

    category = normalize_category(record.category)
    defaults = CATEGORY_DEFAULTS[category]
    map_slug = record.slug or slugify_candidate(record.external_id or record.name)
    display_name = record.name.strip()
    district = (record.district or "대전").strip()
    summary = (record.summary or "").strip() or f"{display_name} is a Daejeon spot worth a quick stop."
    description = (record.description or "").strip() or summary
    normalized_tags = list(record.vibe_tags or defaults["vibe_tags"])
    visit_time = (record.visit_time or defaults["visit_time"]).strip()
    route_hint = (record.route_hint or defaults["route_hint"]).strip()
    stamp_reward = (record.stamp_reward or defaults["stamp_reward"]).strip()
    hero_label = (record.hero_label or defaults["hero_label"]).strip()
    jam_color = (record.jam_color or defaults["jam_color"]).strip()
    accent_color = (record.accent_color or defaults["accent_color"]).strip()

    map_payload = None
    if record.latitude is not None and record.longitude is not None:
        map_payload = {
            "slug": map_slug,
            "name": display_name,
            "district": district,
            "category": category,
            "latitude": float(record.latitude),
            "longitude": float(record.longitude),
            "summary": summary,
            "description": description,
            "vibe_tags": normalized_tags,
            "visit_time": visit_time,
            "route_hint": route_hint,
            "stamp_reward": stamp_reward,
            "hero_label": hero_label,
            "jam_color": jam_color,
            "accent_color": accent_color,
            "is_active": record.is_active,
        }

    normalized_payload = {
        "slug": map_slug,
        "name": display_name,
        "district": district,
        "category": category,
        "summary": summary,
        "description": description,
        "vibe_tags": normalized_tags,
        "visit_time": visit_time,
        "route_hint": route_hint,
        "stamp_reward": stamp_reward,
        "hero_label": hero_label,
        "jam_color": jam_color,
        "accent_color": accent_color,
        "is_active": record.is_active,
        "address": record.address,
        "road_address": record.road_address,
        "image_url": record.image_url,
        "contact": record.contact,
        "source_page_url": record.source_page_url,
    }

    return NormalizedPublicPlace(
        external_id=record.external_id or map_slug,
        mapSlug=map_slug,
        displayName=display_name,
        district=district,
        category=category,
        latitude=record.latitude,
        longitude=record.longitude,
        summary=summary,
        description=description,
        address=record.address,
        roadAddress=record.road_address,
        imageUrl=record.image_url,
        contact=record.contact,
        sourcePageUrl=record.source_page_url,
        sourceUpdatedAt=record.source_updated_at,
        isActive=record.is_active,
        mapPayload=map_payload,
        normalizedPayload=normalized_payload,
    )
