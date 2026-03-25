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
    """한국 시간(KST)을 기준으로 naive datetime 객체를 반환합니다."""
    return datetime.now(KST).replace(tzinfo=None)


def to_seoul_date(value: datetime | None = None) -> date:
    """datetime 객체를 한국 시간 기준의 date 객체로 변환합니다."""
    if value is None:
        return datetime.now(KST).date()
    if value.tzinfo is None:
        return value.date()
    return value.astimezone(KST).date()


def generate_user_id() -> str:
    """임의의 해시가 포함된 고유 사용자 ID를 생성합니다."""
    return f"user-{uuid4().hex[:20]}"


def format_datetime(value: datetime | None) -> str:
    """datetime 객체를 화면에 보여줄 포맷(MM. DD. HH:MM)으로 변환합니다."""
    if not value:
        return ""
    return value.strftime("%m. %d. %H:%M")


def format_date(value: date | datetime | None) -> str:
    """날짜(date) 혹은 datetime 객체를 ISO 8601 포맷의 문자열로 변환합니다."""
    if value is None:
        return ""
    if isinstance(value, datetime):
        return to_seoul_date(value).isoformat()
    return value.isoformat()


def format_visit_label(visit_number: int | None) -> str:
    """n번째 방문 여부를 나타내는 라벨 문자열을 생성합니다."""
    safe_visit_number = visit_number if visit_number and visit_number > 0 else 1
    return f"{safe_visit_number}\uBC88\uC9F8 \uBC29\uBB38"


def build_session_duration_label(session: TravelSession) -> str:
    """여행 세션의 기간(당일, 1박 2일 등) 및 스탬프 수를 요약한 문자열을 반환합니다."""
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
    """두 좌표 사이의 직선 거리를 하버사인 공식을 이용해 미터 단위로 계산합니다."""
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
    """사용자가 스탬프를 받을 수 있는 범위 내에 있는지 확인합니다. 벗어나면 PermissionError를 발생시킵니다."""
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
    """리뷰(피드) 식별자 문자열을 정수형 ID로 파싱합니다."""
    try:
        return int(review_id)
    except ValueError as error:
        raise ValueError("\uB9AC\uBDF0 ID \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC544\uC694.") from error


def parse_comment_id(comment_id: str) -> int:
    """댓글 식별자 문자열을 정수형 ID로 파싱합니다."""
    try:
        return int(comment_id)
    except ValueError as error:
        raise ValueError("\uB313\uAE00 ID \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC544\uC694.") from error


def parse_stamp_id(stamp_id: str) -> int:
    """스탬프 식별자 문자열을 정수형 ID로 파싱합니다."""
    try:
        return int(stamp_id)
    except ValueError as error:
        raise ValueError("\uC2A4\uD0EC\uD504 ID \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC544\uC694.") from error


def to_place_out(place: MapPlace) -> PlaceOut:
    """장소(MapPlace) ORM 객체를 API 응답용 PlaceOut 모델로 변환합니다."""
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
    """사용자(User) ORM 객체를 세션용 SessionUser 모델로 변환합니다."""
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
    """장소 정보를 관리자 조회용 모델(AdminPlaceOut)로 변환합니다."""
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
    """선형 댓글 리스트를 부모-자식 트리 형태의 CommentOut 리스트로 재구성합니다."""
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
