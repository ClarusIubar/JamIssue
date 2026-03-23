"""JamIssue 도메인 조회와 변경 로직입니다."""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, datetime
from math import asin, cos, radians, sin, sqrt
from uuid import uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from .config import Settings
from .db_models import (
    Course,
    CoursePlace,
    Feed,
    FeedLike,
    MapPlace,
    User,
    UserComment,
    UserIdentity,
    UserRoute,
    UserRouteLike,
    UserRoutePlace,
    UserStamp,
)
from .models import (
    AdminPlaceOut,
    AdminSummaryResponse,
    BootstrapResponse,
    CategoryFilter,
    CommentCreate,
    CommentOut,
    CourseMood,
    CourseOut,
    MyPageResponse,
    MyStatsOut,
    PlaceOut,
    PublicImportResponse,
    ReviewCreate,
    ReviewLikeResponse,
    ReviewOut,
    SessionUser,
    StampState,
)
from .naver_oauth import NaverProfile
from .public_data import import_public_bundle as sync_public_bundle
from .public_data import load_public_bundle as load_public_bundle_payload

LEGACY_PROVIDERS = ("demo", "seed")
BADGE_BY_MOOD = {
    "설렘": "첫 방문",
    "친구랑": "친구 추천",
    "혼자서": "로컬 탐방",
    "야경픽": "야경 성공",
}

KST = ZoneInfo("Asia/Seoul")


def utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def to_seoul_date(value: datetime | None = None) -> date:
    if value is None:
        return datetime.now(KST).date()
    if value.tzinfo is None:
        return value.date()
    return value.astimezone(KST).date()


def generate_user_id() -> str:
    return f"user-{uuid4().hex[:20]}"


def _nickname_exists(db: Session, nickname: str, *, exclude_user_id: str | None = None) -> bool:
    stmt = select(User.user_id).where(func.lower(User.nickname) == nickname.lower())
    if exclude_user_id:
        stmt = stmt.where(User.user_id != exclude_user_id)
    return db.scalar(stmt.limit(1)) is not None


def generate_unique_nickname(db: Session, base_nickname: str) -> str:
    """닉네임이 이미 존재하면 유일해질 때까지 숫자 접미사를 붙여 반환합니다."""
    base = base_nickname.strip() or "이름 없음"
    if not _nickname_exists(db, base):
        return base
    # nickname 컬럼은 String(100)이므로 접미사(최대 4자리)를 위해 95자로 자릅니다.
    for suffix in range(2, 10000):
        candidate = f"{base[:95]}{suffix}"
        if not _nickname_exists(db, candidate):
            return candidate
    raise ValueError("사용 가능한 닉네임을 만들 수 없어요.")


def format_datetime(value: datetime) -> str:
    """화면에 맞는 방문 시각 문자열로 바꿉니다."""

    return value.strftime("%m월 %d일 %H:%M")


def to_place_out(place: MapPlace) -> PlaceOut:
    """장소 ORM 객체를 API 응답 모델로 바꿉니다."""

    return PlaceOut(
        id=place.slug,
        name=place.name,
        district=place.district,
        category=place.category,
        jamColor=place.jam_color,
        accentColor=place.accent_color,
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


def build_comment_tree(comments: list[UserComment]) -> list[CommentOut]:
    """댓글 목록을 부모-자식 트리 구조로 묶습니다."""

    ordered_comments = sorted(comments, key=lambda item: (item.created_at, item.comment_id))
    nodes: dict[int, CommentOut] = {}
    roots: list[CommentOut] = []

    for comment in ordered_comments:
        author_name = comment.user.nickname if comment.user else "알 수 없는 사용자"
        body = "삭제된 댓글입니다." if comment.is_deleted else comment.body
        nodes[comment.comment_id] = CommentOut(
            id=str(comment.comment_id),
            userId=comment.user_id,
            author=author_name,
            body=body,
            parentId=str(comment.parent_id) if comment.parent_id else None,
            isDeleted=comment.is_deleted,
            createdAt=format_datetime(comment.created_at),
            replies=[],
        )

    for comment in ordered_comments:
        node = nodes[comment.comment_id]
        if comment.parent_id and comment.parent_id in nodes:
            nodes[comment.parent_id].replies.append(node)
        else:
            roots.append(node)

    return roots


def to_review_out(feed: Feed, current_user_id: str | None = None) -> ReviewOut:
    """후기 ORM 객체를 화면 응답 모델로 바꿉니다."""

    comments = list(feed.comments or [])
    likes = list(feed.likes or [])
    liked_by_me = any(like.user_id == current_user_id for like in likes) if current_user_id else False
    visit_number = feed.stamp.visit_ordinal if feed.stamp else 1
    return ReviewOut(
        id=str(feed.feed_id),
        userId=feed.user_id,
        placeId=feed.place.slug,
        placeName=feed.place.name,
        author=feed.user.nickname,
        body=feed.body,
        mood=feed.mood,
        badge=feed.badge,
        visitedAt=format_datetime(feed.created_at),
        imageUrl=feed.image_url,
        commentCount=len(comments),
        likeCount=len(likes),
        likedByMe=liked_by_me,
        stampId=str(feed.stamp_id) if feed.stamp_id else None,
        visitNumber=visit_number,
        visitLabel=f"{visit_number}번째 방문",
        travelSessionId=str(feed.stamp.travel_session_id) if feed.stamp and feed.stamp.travel_session_id else None,
        comments=build_comment_tree(comments),
    )


def to_course_out(course: Course) -> CourseOut:
    """코스 ORM 객체를 응답 모델로 바꿉니다."""

    ordered_places = sorted(course.course_places, key=lambda item: item.stop_order)
    return CourseOut(
        id=course.slug,
        title=course.title,
        mood=course.mood,
        duration=course.duration,
        note=course.note,
        color=course.color,
        placeIds=[item.place.slug for item in ordered_places],
    )


def to_session_user(
    user: User,
    is_admin: bool,
    profile_image: str | None = None,
    provider: str | None = None,
) -> SessionUser:
    """사용자 ORM 객체를 세션 응답 모델로 바꿉니다."""

    return SessionUser(
        id=user.user_id,
        nickname=user.nickname,
        email=user.email,
        provider=provider or user.provider,
        profileImage=profile_image,
        isAdmin=is_admin,
    )


def to_admin_place_out(place: MapPlace, review_count: int) -> AdminPlaceOut:
    """관리자 화면용 장소 요약 객체를 만듭니다."""

    return AdminPlaceOut(
        id=place.slug,
        name=place.name,
        district=place.district,
        category=place.category,
        isActive=place.is_active,
        reviewCount=review_count,
        updatedAt=format_datetime(place.updated_at),
    )


def _sync_user_profile(
    user: User,
    nickname: str | None = None,
    *,
    email: str | None = None,
    provider: str | None = None,
) -> bool:
    dirty = False
    if nickname and user.nickname != nickname:
        user.nickname = nickname
        dirty = True
    if email is not None and user.email != email:
        user.email = email
        dirty = True
    if provider and user.provider != provider:
        user.provider = provider
        dirty = True
    if dirty:
        user.updated_at = utcnow_naive()
    return dirty


def get_or_create_user(
    db: Session,
    user_id: str,
    nickname: str | None = None,
    *,
    email: str | None = None,
    provider: str = "demo",
) -> User:
    """내부 user_id 기준으로 사용자를 찾거나 새로 만듭니다."""

    user = db.get(User, user_id)
    if not user:
        user = User(
            user_id=user_id,
            nickname=nickname or user_id,
            email=email,
            provider=provider,
            created_at=utcnow_naive(),
            updated_at=utcnow_naive(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    if _sync_user_profile(user, nickname, email=email, provider=provider):
        db.commit()
        db.refresh(user)

    return user


def upsert_social_user(
    db: Session,
    *,
    provider: str,
    provider_user_id: str,
    nickname: str,
    email: str | None = None,
    profile_image: str | None = None,
) -> User:
    """외부 로그인 식별자를 내부 고유 user_id 계정에 연결합니다."""

    identity = db.scalars(
        select(UserIdentity)
        .options(joinedload(UserIdentity.user))
        .where(UserIdentity.provider == provider, UserIdentity.provider_user_id == provider_user_id)
    ).first()
    now = utcnow_naive()

    if identity:
        user = identity.user
        changed = False
        if user.email != email:
            user.email = email
            changed = True
        if user.provider != provider:
            user.provider = provider
            changed = True
        if identity.email != email:
            identity.email = email
            changed = True
        if identity.profile_image != profile_image:
            identity.profile_image = profile_image
            changed = True
        if changed:
            identity.updated_at = now
            user.updated_at = now
        db.commit()
        db.refresh(user)
        return user

    safe_nickname = generate_unique_nickname(db, nickname)
    user = User(
        user_id=generate_user_id(),
        nickname=safe_nickname,
        email=email,
        provider=provider,
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    db.flush()

    db.add(
        UserIdentity(
            user_id=user.user_id,
            provider=provider,
            provider_user_id=provider_user_id,
            email=email,
            profile_image=profile_image,
            created_at=now,
            updated_at=now,
        )
    )
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ValueError("이미 사용 중인 닉네임이에요.") from error
    db.refresh(user)
    return user


def link_social_identity(
    db: Session,
    *,
    user_id: str,
    provider: str,
    provider_user_id: str,
    email: str | None = None,
    profile_image: str | None = None,
) -> User:
    """이미 로그인한 내부 계정에 외부 로그인 수단을 명시적으로 연결합니다."""

    user = db.get(User, user_id)
    if not user:
        raise ValueError("연결할 내부 계정을 찾을 수 없어요.")

    now = utcnow_naive()
    existing_identity = db.scalars(
        select(UserIdentity).where(UserIdentity.provider == provider, UserIdentity.provider_user_id == provider_user_id)
    ).first()
    if existing_identity:
        if existing_identity.user_id != user_id:
            raise ValueError("이미 다른 계정에 연결된 로그인 수단이에요.")

        dirty = False
        if existing_identity.email != email:
            existing_identity.email = email
            dirty = True
        if existing_identity.profile_image != profile_image:
            existing_identity.profile_image = profile_image
            dirty = True
        if dirty:
            existing_identity.updated_at = now
            db.commit()
            db.refresh(user)
        return user

    provider_slot = db.scalars(
        select(UserIdentity).where(UserIdentity.user_id == user_id, UserIdentity.provider == provider)
    ).first()
    if provider_slot:
        raise ValueError("이미 이 제공자 계정이 연결되어 있어요.")

    if email and not user.email:
        user.email = email
        user.updated_at = now

    db.add(
        UserIdentity(
            user_id=user.user_id,
            provider=provider,
            provider_user_id=provider_user_id,
            email=email,
            profile_image=profile_image,
            created_at=now,
            updated_at=now,
        )
    )
    db.commit()
    db.refresh(user)
    return user


def upsert_naver_user(db: Session, profile: NaverProfile) -> User:
    """네이버 프로필을 기준으로 내부 계정과 소셜 identity를 갱신합니다."""

    nickname = profile.nickname or profile.name or "이름 없음"
    return upsert_social_user(
        db,
        provider="naver",
        provider_user_id=profile.id,
        nickname=nickname,
        email=profile.email,
        profile_image=profile.profile_image,
    )


def link_naver_identity(db: Session, user_id: str, profile: NaverProfile) -> User:
    """네이버 identity를 현재 로그인한 내부 계정에 명시적으로 연결합니다."""

    return link_social_identity(
        db,
        user_id=user_id,
        provider="naver",
        provider_user_id=profile.id,
        email=profile.email,
        profile_image=profile.profile_image,
    )


def calculate_distance_meters(
    start_latitude: float,
    start_longitude: float,
    end_latitude: float,
    end_longitude: float,
) -> float:
    """두 좌표 사이의 거리를 미터 단위로 계산합니다."""

    earth_radius_meters = 6_371_000
    latitude_delta = radians(end_latitude - start_latitude)
    longitude_delta = radians(end_longitude - start_longitude)
    start_latitude_radians = radians(start_latitude)
    end_latitude_radians = radians(end_latitude)

    haversine = (
        sin(latitude_delta / 2) ** 2
        + cos(start_latitude_radians) * cos(end_latitude_radians) * sin(longitude_delta / 2) ** 2
    )
    arc = 2 * asin(sqrt(haversine))
    return earth_radius_meters * arc


def ensure_stamp_can_be_collected(
    place: MapPlace,
    current_latitude: float,
    current_longitude: float,
    radius_meters: int,
) -> None:
    """현재 위치가 스탬프 적립 반경 안인지 검증합니다."""

    distance_meters = calculate_distance_meters(
        current_latitude,
        current_longitude,
        place.latitude,
        place.longitude,
    )

    if distance_meters > radius_meters:
        raise PermissionError(
            f"{place.name} 현장 반경 {radius_meters}m 안에 도착해야 스탬프를 받을 수 있어요. 현재 약 {round(distance_meters)}m 떨어져 있어요."
        )


def list_places(db: Session, category: CategoryFilter = "all") -> list[PlaceOut]:
    """공개할 장소 목록을 카테고리 기준으로 반환합니다."""

    stmt = select(MapPlace).where(MapPlace.is_active.is_(True)).order_by(MapPlace.name.asc())
    if category != "all":
        stmt = stmt.where(MapPlace.category == category)

    return [to_place_out(place) for place in db.scalars(stmt).all()]


def get_place(db: Session, place_id: str) -> PlaceOut:
    """단일 장소 정보를 반환합니다."""

    place = db.scalars(select(MapPlace).where(MapPlace.slug == place_id, MapPlace.is_active.is_(True))).first()
    if not place:
        raise ValueError("장소를 찾을 수 없어요.")
    return to_place_out(place)


def list_reviews(
    db: Session,
    place_id: str | None = None,
    user_id: str | None = None,
    current_user_id: str | None = None,
) -> list[ReviewOut]:
    """장소별 또는 사용자별 후기 목록을 반환합니다."""

    stmt = (
        select(Feed)
        .options(
            joinedload(Feed.user),
            joinedload(Feed.place),
            joinedload(Feed.stamp),
            joinedload(Feed.likes),
            joinedload(Feed.comments).joinedload(UserComment.user),
        )
        .order_by(Feed.created_at.desc(), Feed.feed_id.desc())
    )
    if place_id:
        stmt = stmt.join(Feed.place).where(MapPlace.slug == place_id)
    if user_id:
        stmt = stmt.where(Feed.user_id == user_id)

    feeds = db.scalars(stmt).unique().all()
    return [to_review_out(feed, current_user_id=current_user_id) for feed in feeds]


def get_review_comments(db: Session, review_id: str) -> list[CommentOut]:
    """하나의 후기 아래 달린 댓글 트리를 반환합니다."""

    review_key = parse_review_id(review_id)
    comments = db.scalars(
        select(UserComment)
        .options(joinedload(UserComment.user))
        .where(UserComment.feed_id == review_key)
        .order_by(UserComment.created_at.asc(), UserComment.comment_id.asc())
    ).unique().all()
    return build_comment_tree(comments)


def create_review(db: Session, payload: ReviewCreate, user_id: str, nickname: str) -> ReviewOut:
    """후기를 저장하고 응답 모델로 다시 읽어옵니다."""

    body = payload.body.strip()
    if not body:
        raise ValueError("후기 본문을 한 줄 이상 입력해 주세요.")

    place = db.scalars(select(MapPlace).where(MapPlace.slug == payload.place_id, MapPlace.is_active.is_(True))).first()
    if not place:
        raise ValueError("장소를 찾을 수 없어요.")

    today = to_seoul_date()
    today_stamp = db.scalars(
        select(UserStamp).where(
            UserStamp.user_id == user_id,
            UserStamp.position_id == place.position_id,
            UserStamp.stamp_date == today,
        ).order_by(UserStamp.stamp_id.desc())
    ).first()
    if not today_stamp:
        raise ValueError("오늘의 방문 스탬프가 확인되지 않아 리뷰를 남길 수 없어요.")

    user = get_or_create_user(db, user_id, nickname)
    now = utcnow_naive()
    feed = Feed(
        position_id=place.position_id,
        user_id=user.user_id,
        stamp_id=today_stamp.stamp_id,
        body=body,
        mood=payload.mood,
        badge=BADGE_BY_MOOD.get(payload.mood, "현장 기록"),
        image_url=payload.image_url,
        created_at=now,
        updated_at=now,
    )
    db.add(feed)
    db.commit()

    stored_feed = db.scalars(
        select(Feed)
        .options(
            joinedload(Feed.user),
            joinedload(Feed.place),
            joinedload(Feed.stamp),
            joinedload(Feed.likes),
            joinedload(Feed.comments).joinedload(UserComment.user),
        )
        .where(Feed.feed_id == feed.feed_id)
    ).unique().one()
    return to_review_out(stored_feed, current_user_id=user.user_id)


def toggle_review_like(db: Session, review_id: str, user_id: str, nickname: str) -> ReviewLikeResponse:
    """후기 좋아요를 토글합니다."""

    review_key = parse_review_id(review_id)
    feed = db.scalars(
        select(Feed)
        .options(joinedload(Feed.user), joinedload(Feed.likes))
        .where(Feed.feed_id == review_key)
    ).unique().first()
    if not feed:
        raise ValueError("후기를 찾지 못했어요.")

    if feed.user_id == user_id:
        raise ValueError("내 후기에는 좋아요를 누를 수 없어요.")

    user = get_or_create_user(db, user_id, nickname)
    existing_like = db.scalars(
        select(FeedLike).where(FeedLike.feed_id == feed.feed_id, FeedLike.user_id == user.user_id)
    ).first()

    if existing_like:
        db.delete(existing_like)
        liked_by_me = False
    else:
        db.add(FeedLike(feed_id=feed.feed_id, user_id=user.user_id, created_at=utcnow_naive()))
        liked_by_me = True

    db.commit()
    like_count = db.scalar(select(func.count()).select_from(FeedLike).where(FeedLike.feed_id == feed.feed_id)) or 0
    return ReviewLikeResponse(reviewId=str(feed.feed_id), likeCount=int(like_count), likedByMe=liked_by_me)


def create_comment(db: Session, review_id: str, payload: CommentCreate, user_id: str, nickname: str) -> list[CommentOut]:
    """댓글 또는 답글을 저장한 뒤 최신 댓글 트리를 반환합니다."""

    body = payload.body.strip()
    if not body:
        raise ValueError("댓글 내용을 입력해 주세요.")

    review_key = parse_review_id(review_id)
    feed = db.get(Feed, review_key)
    if not feed:
        raise ValueError("후기를 찾을 수 없어요.")

    parent_id: int | None = None
    if payload.parent_id:
        parent_id = parse_comment_id(payload.parent_id)
        parent = db.get(UserComment, parent_id)
        if not parent or parent.feed_id != review_key:
            raise ValueError("같은 후기 안에 있는 댓글에만 답글을 달 수 있어요.")
        # Enforce 2-level depth: if parent is itself a reply, use its root comment instead
        if parent.parent_id is not None:
            parent_id = parent.parent_id

    user = get_or_create_user(db, user_id, nickname)
    now = utcnow_naive()
    comment = UserComment(
        feed_id=review_key,
        user_id=user.user_id,
        parent_id=parent_id,
        body=body,
        is_deleted=False,
        created_at=now,
        updated_at=now,
    )
    db.add(comment)
    db.commit()
    return get_review_comments(db, review_id)


def delete_comment(
    db: Session,
    review_id: str,
    comment_id: str,
    user_id: str,
    *,
    is_admin: bool = False,
) -> list[CommentOut]:
    """댓글은 soft delete 처리하고 대댓글은 그대로 유지합니다."""

    review_key = parse_review_id(review_id)
    comment_key = parse_comment_id(comment_id)
    comment = db.scalars(
        select(UserComment)
        .where(UserComment.comment_id == comment_key, UserComment.feed_id == review_key)
    ).first()
    if not comment:
        raise ValueError("댓글을 찾지 못했어요.")
    if comment.user_id != user_id and not is_admin:
        raise PermissionError("내 댓글만 삭제할 수 있어요.")

    if not comment.is_deleted:
        comment.is_deleted = True
        comment.body = ""
        comment.updated_at = utcnow_naive()
        db.commit()

    return get_review_comments(db, review_id)


def delete_review(db: Session, review_id: str, user_id: str, *, is_admin: bool = False) -> None:
    """후기를 삭제하면 해당 피드 아래 댓글과 좋아요도 함께 정리합니다."""

    review_key = parse_review_id(review_id)
    feed = db.scalars(
        select(Feed)
        .options(joinedload(Feed.comments), joinedload(Feed.likes))
        .where(Feed.feed_id == review_key)
    ).unique().first()
    if not feed:
        raise ValueError("후기를 찾지 못했어요.")
    if feed.user_id != user_id and not is_admin:
        raise PermissionError("내 후기만 삭제할 수 있어요.")

    db.delete(feed)
    db.commit()


def delete_account(db: Session, user_id: str) -> None:
    """회원 탈퇴 시 user_id 기준으로 후기, 댓글, 스탬프, 경로를 모두 정리합니다."""

    user = db.get(User, user_id)
    if not user:
        raise ValueError("사용자 정보를 찾지 못했어요.")

    owned_feed_ids = db.scalars(select(Feed.feed_id).where(Feed.user_id == user_id)).all()
    owned_route_ids = db.scalars(select(UserRoute.route_id).where(UserRoute.user_id == user_id)).all()
    owned_comment_ids = db.scalars(select(UserComment.comment_id).where(UserComment.user_id == user_id)).all()

    if owned_comment_ids:
        db.execute(
            update(UserComment)
            .where(UserComment.parent_id.in_(owned_comment_ids))
            .values(parent_id=None, updated_at=utcnow_naive())
        )

    db.execute(delete(FeedLike).where(FeedLike.user_id == user_id))
    db.execute(delete(UserRouteLike).where(UserRouteLike.user_id == user_id))
    db.execute(delete(UserStamp).where(UserStamp.user_id == user_id))
    db.execute(delete(UserIdentity).where(UserIdentity.user_id == user_id))

    if owned_route_ids:
        db.execute(delete(UserRouteLike).where(UserRouteLike.route_id.in_(owned_route_ids)))
        db.execute(delete(UserRoutePlace).where(UserRoutePlace.route_id.in_(owned_route_ids)))
        db.execute(delete(UserRoute).where(UserRoute.route_id.in_(owned_route_ids)))

    if owned_feed_ids:
        db.execute(delete(FeedLike).where(FeedLike.feed_id.in_(owned_feed_ids)))
        db.execute(delete(UserComment).where(UserComment.feed_id.in_(owned_feed_ids)))
        db.execute(delete(Feed).where(Feed.feed_id.in_(owned_feed_ids)))

    db.execute(delete(UserComment).where(UserComment.user_id == user_id))
    db.execute(delete(User).where(User.user_id == user_id))
    db.commit()


def list_courses(db: Session, mood: CourseMood | None = None) -> list[CourseOut]:
    """무드 기준 코스 목록을 반환합니다."""

    stmt = (
        select(Course)
        .options(joinedload(Course.course_places).joinedload(CoursePlace.place))
        .order_by(Course.display_order.asc(), Course.course_id.asc())
    )
    if mood and mood != "전체":
        stmt = stmt.where(Course.mood == mood)

    return [to_course_out(course) for course in db.scalars(stmt).unique().all()]


def get_stamps(db: Session, user_id: str | None) -> StampState:
    """현재 사용자가 모은 스탬프 목록을 반환합니다."""

    if not user_id:
        return StampState(collectedPlaceIds=[])

    stamps = db.scalars(
        select(UserStamp)
        .options(joinedload(UserStamp.place))
        .where(UserStamp.user_id == user_id)
        .order_by(UserStamp.created_at.asc(), UserStamp.stamp_id.asc())
    ).unique().all()
    return StampState(collectedPlaceIds=[stamp.place.slug for stamp in stamps])


def toggle_stamp(
    db: Session,
    user_id: str,
    place_id: str,
    latitude: float,
    longitude: float,
    radius_meters: int,
) -> StampState:
    """현장 반경 검증 뒤 스탬프를 적립합니다."""

    get_or_create_user(db, user_id, user_id)
    place = db.scalars(select(MapPlace).where(MapPlace.slug == place_id, MapPlace.is_active.is_(True))).first()
    if not place:
        raise ValueError("장소를 찾을 수 없어요.")

    today = to_seoul_date()
    existing_today = db.scalars(
        select(UserStamp).where(
            UserStamp.user_id == user_id,
            UserStamp.position_id == place.position_id,
            UserStamp.stamp_date == today,
        )
    ).first()
    if existing_today:
        raise ValueError("이미 오늘 스탬프를 획득했습니다.")

    ensure_stamp_can_be_collected(place, latitude, longitude, radius_meters)
    db.add(UserStamp(user_id=user_id, position_id=place.position_id, stamp_date=today, created_at=utcnow_naive()))
    db.commit()
    return get_stamps(db, user_id)


def get_my_page(db: Session, user_id: str, is_admin: bool) -> MyPageResponse:
    """마이페이지에 필요한 계정 요약 정보를 반환합니다."""

    user = db.get(User, user_id)
    if not user:
        raise ValueError("사용자 정보를 찾을 수 없어요.")

    review_items = list_reviews(db, user_id=user_id, current_user_id=user_id)
    stamp_rows = db.scalars(
        select(UserStamp)
        .options(joinedload(UserStamp.place))
        .where(UserStamp.user_id == user_id)
        .order_by(UserStamp.created_at.desc(), UserStamp.stamp_id.desc())
    ).unique().all()
    collected_places = [to_place_out(stamp.place) for stamp in stamp_rows if stamp.place and stamp.place.is_active]
    route_count = db.scalar(select(func.count()).select_from(UserRoute).where(UserRoute.user_id == user_id)) or 0

    return MyPageResponse(
        user=to_session_user(user, is_admin),
        stats=MyStatsOut(reviewCount=len(review_items), stampCount=len(collected_places), routeCount=int(route_count)),
        reviews=review_items,
        collectedPlaces=collected_places,
        routes=[],
    )


def get_bootstrap(db: Session, user_id: str | None) -> BootstrapResponse:
    """첫 진입에 필요한 장소, 코스, 후기, 스탬프를 묶어 보냅니다."""

    places = list_places(db)
    return BootstrapResponse(
        places=places,
        reviews=list_reviews(db, current_user_id=user_id),
        courses=list_courses(db),
        stamps=get_stamps(db, user_id),
        hasRealData=bool(places),
    )


def get_admin_summary(db: Session, settings: Settings) -> AdminSummaryResponse:
    """관리자 화면에 필요한 운영 지표를 집계합니다."""

    user_count = db.scalar(select(func.count()).select_from(User)) or 0
    place_count = db.scalar(select(func.count()).select_from(MapPlace)) or 0
    review_count = db.scalar(select(func.count()).select_from(Feed)) or 0
    comment_count = db.scalar(select(func.count()).select_from(UserComment)) or 0
    stamp_count = db.scalar(select(func.count()).select_from(UserStamp)) or 0

    place_rows = db.execute(
        select(MapPlace, func.count(Feed.feed_id))
        .outerjoin(Feed, Feed.position_id == MapPlace.position_id)
        .group_by(MapPlace.position_id)
        .order_by(MapPlace.is_active.desc(), MapPlace.name.asc())
    ).all()

    return AdminSummaryResponse(
        userCount=int(user_count),
        placeCount=int(place_count),
        reviewCount=int(review_count),
        commentCount=int(comment_count),
        stampCount=int(stamp_count),
        sourceReady=settings.public_data_file_path.exists() or bool(settings.public_data_source_url),
        places=[to_admin_place_out(place, int(count)) for place, count in place_rows],
    )


def update_place_visibility(db: Session, place_id: str, is_active: bool) -> AdminPlaceOut:
    """장소의 공개 여부를 변경합니다."""

    place = db.scalars(select(MapPlace).where(MapPlace.slug == place_id)).first()
    if not place:
        raise ValueError("장소를 찾을 수 없어요.")

    place.is_active = is_active
    place.updated_at = utcnow_naive()
    db.commit()

    review_count = db.scalar(select(func.count()).select_from(Feed).where(Feed.position_id == place.position_id)) or 0
    return to_admin_place_out(place, int(review_count))


def cleanup_legacy_demo_content(db: Session) -> None:
    """예전 데모 계정과 샘플 데이터를 정리합니다."""

    legacy_user_ids = db.scalars(select(User.user_id).where(User.provider.in_(LEGACY_PROVIDERS))).all()
    if not legacy_user_ids:
        return

    feed_ids = db.scalars(select(Feed.feed_id).where(Feed.user_id.in_(legacy_user_ids))).all()
    comment_ids = db.scalars(select(UserComment.comment_id).where(UserComment.user_id.in_(legacy_user_ids))).all()

    if comment_ids:
        db.execute(update(UserComment).where(UserComment.parent_id.in_(comment_ids)).values(parent_id=None, updated_at=utcnow_naive()))
        db.execute(delete(UserComment).where(UserComment.user_id.in_(legacy_user_ids)))

    if feed_ids:
        db.execute(delete(FeedLike).where(FeedLike.feed_id.in_(feed_ids)))
        db.execute(delete(UserComment).where(UserComment.feed_id.in_(feed_ids)))
        db.execute(delete(Feed).where(Feed.feed_id.in_(feed_ids)))

    db.execute(delete(UserStamp).where(UserStamp.user_id.in_(legacy_user_ids)))
    db.execute(delete(UserIdentity).where(UserIdentity.user_id.in_(legacy_user_ids)))
    db.execute(delete(UserRouteLike).where(UserRouteLike.user_id.in_(legacy_user_ids)))
    db.execute(delete(UserRoute).where(UserRoute.user_id.in_(legacy_user_ids)))
    db.execute(delete(User).where(User.user_id.in_(legacy_user_ids)))
    db.commit()


def load_public_bundle(settings: Settings) -> dict:
    """전용 public_data 모듈을 통해 공공데이터 번들을 읽습니다."""

    return load_public_bundle_payload(settings).model_dump(by_alias=True, exclude_none=True)


def import_public_bundle(db: Session, settings: Settings) -> PublicImportResponse:
    """공공데이터 동기화를 전용 모듈에 위임합니다."""

    return sync_public_bundle(db, settings)


def parse_review_id(review_id: str) -> int:
    """문자열 리뷰 ID를 정수 키로 바꿉니다."""

    try:
        return int(review_id)
    except ValueError as error:
        raise ValueError("후기 ID 형식이 올바르지 않아요.") from error


def parse_comment_id(comment_id: str) -> int:
    """문자열 댓글 ID를 정수 키로 바꿉니다."""

    try:
        return int(comment_id)
    except ValueError as error:
        raise ValueError("댓글 ID 형식이 올바르지 않아요.") from error

