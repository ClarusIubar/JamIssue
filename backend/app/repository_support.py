"""Shared helper utilities for normalized repository flows."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from math import asin, cos, radians, sin, sqrt
from uuid import uuid4
from zoneinfo import ZoneInfo

from .db_models import MapPlace, TravelSession, User, UserComment
from .models import AdminPlaceOut, CommentOut, PlaceOut, SessionUser

KST = ZoneInfo("Asia/Seoul")
LEGACY_PROVIDERS = ("demo", "seed")
BADGE_BY_MOOD = {
    "\uC124\uB818": "\uCCAB \uBC29\uBB38",
    "\uCE5C\uAD6C\uB791": "\uCE5C\uAD6C \uCD94\uCC9C",
    "\uD63C\uC790\uC11C": "\uB85C\uCEEC \uD0D0\uBC29",
    "\uC57C\uACBD \uB9DB\uC9D1": "\uC57C\uACBD \uC131\uACF5",
}


def utcnow_naive() -> datetime:
    return datetime.now(KST).replace(tzinfo=None)


def to_seoul_date(value: datetime | None = None) -> date:
    if value is None:
        return datetime.now(KST).date()
    if value.tzinfo is None:
        return value.date()
    return value.astimezone(KST).date()


def generate_user_id() -> str:
    return f"user-{uuid4().hex[:20]}"


def format_datetime(value: datetime | None) -> str:
    if not value:
        return ""
    return value.strftime("%m. %d. %H:%M")


def format_date(value: date | datetime | None) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return to_seoul_date(value).isoformat()
    return value.isoformat()


def format_visit_label(visit_number: int | None) -> str:
    safe_visit_number = visit_number if visit_number and visit_number > 0 else 1
    return f"{safe_visit_number}\uBC88\uC9F8 \uBC29\uBB38"


def build_session_duration_label(session: TravelSession) -> str:
    diff = max(session.ended_at - session.started_at, timedelta())
    diff_days = diff.days
    if diff_days <= 0:
        return f"\uB2F9\uC77C \uCF54\uC2A4 \u00B7 \uC2A4\uD0EC\uD504 {session.stamp_count}\uAC1C"
    return f"{diff_days}\uBC15 {diff_days + 1}\uC77C \u00B7 \uC2A4\uD0EC\uD504 {session.stamp_count}\uAC1C"


def calculate_distance_meters(
    start_latitude: float,
    start_longitude: float,
    end_latitude: float,
    end_longitude: float,
) -> float:
    earth_radius_meters = 6_371_000
    latitude_delta = radians(end_latitude - start_latitude)
    longitude_delta = radians(end_longitude - start_longitude)
    start_latitude_radians = radians(start_latitude)
    end_latitude_radians = radians(end_latitude)
    haversine = (
        sin(latitude_delta / 2) ** 2
        + cos(start_latitude_radians) * cos(end_latitude_radians) * sin(longitude_delta / 2) ** 2
    )
    return earth_radius_meters * (2 * asin(sqrt(haversine)))


def ensure_stamp_can_be_collected(
    place: MapPlace,
    current_latitude: float,
    current_longitude: float,
    radius_meters: int,
) -> None:
    distance_meters = calculate_distance_meters(
        current_latitude,
        current_longitude,
        place.latitude,
        place.longitude,
    )
    if distance_meters > radius_meters:
        raise PermissionError(
            f"{place.name} \uD604\uC7A5 \uBC18\uACBD {radius_meters}m \uC548\uC5D0 \uB4E4\uC5B4\uC640\uC57C \uC2A4\uD0EC\uD504\uB97C \uBC1B\uC744 \uC218 \uC788\uC5B4\uC694. \uD604\uC7AC \uC57D {round(distance_meters)}m \uB5A8\uC5B4\uC838 \uC788\uC5B4\uC694."
        )


def parse_review_id(review_id: str) -> int:
    try:
        return int(review_id)
    except ValueError as error:
        raise ValueError("\uB9AC\uBDF0 ID \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC544\uC694.") from error


def parse_comment_id(comment_id: str) -> int:
    try:
        return int(comment_id)
    except ValueError as error:
        raise ValueError("\uB313\uAE00 ID \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC544\uC694.") from error


def parse_stamp_id(stamp_id: str) -> int:
    try:
        return int(stamp_id)
    except ValueError as error:
        raise ValueError("\uC2A4\uD0EC\uD504 ID \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC544\uC694.") from error


def to_place_out(place: MapPlace) -> PlaceOut:
    return PlaceOut(
        id=place.slug,
        positionId=str(place.position_id),
        name=place.name,
        district=place.district,
        category=place.category,
        jamColor=place.jam_color,
        accentColor=place.accent_color,
        imageUrl=place.image_url,
        latitude=place.latitude,
        longitude=place.longitude,
        summary=place.summary,
        description=place.description,
        vibeTags=list(place.vibe_tags or []),
        visitTime=place.visit_time,
        routeHint=place.route_hint,
        stampReward=place.stamp_reward,
        heroLabel=place.hero_label,
    )


def to_session_user(
    user: User,
    is_admin: bool,
    profile_image: str | None = None,
    provider: str | None = None,
) -> SessionUser:
    return SessionUser(
        id=user.user_id,
        nickname=user.nickname,
        email=user.email,
        provider=provider or user.provider,
        profileImage=profile_image,
        isAdmin=is_admin,
        profileCompletedAt=user.profile_completed_at.isoformat() if user.profile_completed_at else None,
    )


def to_admin_place_out(place: MapPlace, review_count: int) -> AdminPlaceOut:
    return AdminPlaceOut(
        id=place.slug,
        name=place.name,
        district=place.district,
        category=place.category,
        isActive=place.is_active,
        isManualOverride=place.is_manual_override,
        reviewCount=review_count,
        updatedAt=format_datetime(place.updated_at),
    )


def build_comment_tree(comments: list[UserComment]) -> list[CommentOut]:
    ordered_comments = sorted(comments, key=lambda item: (item.created_at, item.comment_id))
    comment_rows_by_id = {comment.comment_id: comment for comment in ordered_comments}
    nodes: dict[int, CommentOut] = {}
    roots: list[CommentOut] = []

    for comment in ordered_comments:
        nodes[comment.comment_id] = CommentOut(
            id=str(comment.comment_id),
            userId=comment.user_id,
            author=comment.user.nickname if comment.user else "\uC774\uB984 \uC5C6\uC74C",
            body="\uC0AD\uC81C\uB41C \uB313\uAE00\uC785\uB2C8\uB2E4." if comment.is_deleted else comment.body,
            parentId=str(comment.parent_id) if comment.parent_id else None,
            isDeleted=comment.is_deleted,
            createdAt=format_datetime(comment.created_at),
            replies=[],
        )

    for comment in ordered_comments:
        node = nodes[comment.comment_id]
        parent = comment_rows_by_id.get(comment.parent_id) if comment.parent_id else None
        root_parent_id = None
        if parent:
            root_parent_id = parent.parent_id or parent.comment_id

        if root_parent_id and root_parent_id in nodes:
            nodes[root_parent_id].replies.append(node)
        else:
            roots.append(node)

    return roots
