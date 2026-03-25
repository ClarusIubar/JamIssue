"""Normalized repository for JamIssue domain flows."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from .config import Settings
from .db_models import (
    Course,
    CoursePlace,
    Feed,
    FeedLike,
    MapPlace,
    TravelSession,
    User,
    UserComment,
    UserIdentity,
    UserRoute,
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
    MyCommentOut,
    MyPageResponse,
    MyStatsOut,
    PlaceOut,
    ProfileUpdateRequest,
    PublicImportResponse,
    ReviewCreate,
    ReviewLikeResponse,
    ReviewOut,
    SessionUser,
    StampLogOut,
    StampState,
    TravelSessionOut,
)
from .naver_oauth import NaverProfile
from .public_data import import_public_bundle as sync_public_bundle
from .public_data import load_public_bundle as load_public_bundle_payload
from .repository_support import (
    BADGE_BY_MOOD,
    LEGACY_PROVIDERS,
    build_comment_tree,
    build_session_duration_label,
    ensure_stamp_can_be_collected,
    format_date,
    format_datetime,
    format_visit_label,
    generate_user_id,
    parse_comment_id,
    parse_review_id,
    parse_stamp_id,
    to_admin_place_out,
    to_place_out,
    to_seoul_date,
    to_session_user,
    utcnow_naive,
)

def get_or_create_user(
    db: Session,
    user_id: str,
    nickname: str | None = None,
    *,
    email: str | None = None,
    provider: str = "demo",
) -> User:
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
        db.commit()
        db.refresh(user)
    return user


def _nickname_exists(db: Session, nickname: str, *, exclude_user_id: str | None = None) -> bool:
    stmt = select(User.user_id).where(func.lower(User.nickname) == nickname.lower())
    if exclude_user_id:
        stmt = stmt.where(User.user_id != exclude_user_id)
    return db.scalar(stmt.limit(1)) is not None


def ensure_unique_nickname(db: Session, nickname: str, *, exclude_user_id: str | None = None) -> str:
    normalized = nickname.strip()
    if len(normalized) < 2:
        raise ValueError("닉네임은 두 글자 이상으로 적어 주세요.")
    if _nickname_exists(db, normalized, exclude_user_id=exclude_user_id):
        raise ValueError("이미 사용 중인 닉네임이에요.")
    return normalized


def build_unique_social_nickname(db: Session, nickname: str, *, exclude_user_id: str | None = None) -> str:
    base = nickname.strip() or "이름 없음"
    if not _nickname_exists(db, base, exclude_user_id=exclude_user_id):
        return base
    for suffix in range(2, 10000):
        candidate = f"{base[:95]}{suffix}"
        if not _nickname_exists(db, candidate, exclude_user_id=exclude_user_id):
            return candidate
    raise ValueError("사용 가능한 닉네임을 만들 수 없어요.")


def upsert_social_user(
    db: Session,
    *,
    provider: str,
    provider_user_id: str,
    nickname: str,
    email: str | None = None,
    profile_image: str | None = None,
) -> User:
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

    safe_nickname = build_unique_social_nickname(db, nickname)
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
    user = db.get(User, user_id)
    if not user:
        raise ValueError("연결할 기존 계정을 찾을 수 없어요.")

    now = utcnow_naive()
    existing_identity = db.scalars(
        select(UserIdentity).where(UserIdentity.provider == provider, UserIdentity.provider_user_id == provider_user_id)
    ).first()
    if existing_identity:
        if existing_identity.user_id != user_id:
            raise ValueError("이미 다른 계정에 연결된 로그인 수단이에요.")
        if existing_identity.email != email or existing_identity.profile_image != profile_image:
            existing_identity.email = email
            existing_identity.profile_image = profile_image
            existing_identity.updated_at = now
            db.commit()
            db.refresh(user)
        return user

    provider_slot = db.scalars(
        select(UserIdentity).where(UserIdentity.user_id == user_id, UserIdentity.provider == provider)
    ).first()
    if provider_slot:
        raise ValueError("이미 같은 제공자의 계정이 연결되어 있어요.")

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
    return link_social_identity(
        db,
        user_id=user_id,
        provider="naver",
        provider_user_id=profile.id,
        email=profile.email,
        profile_image=profile.profile_image,
    )


def update_user_profile(db: Session, user_id: str, payload: ProfileUpdateRequest) -> User:
    user = db.get(User, user_id)
    if not user:
        raise ValueError("사용자 정보를 찾을 수 없어요.")

    nickname = ensure_unique_nickname(db, payload.nickname, exclude_user_id=user_id)
    now = utcnow_naive()
    user.nickname = nickname
    if user.profile_completed_at is None:
        user.profile_completed_at = now
    user.updated_at = now
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ValueError("이미 사용 중인 닉네임이에요.") from error
    db.refresh(user)
    return user

def build_stamp_logs(stamps: list[UserStamp]) -> list[StampLogOut]:
    today_key = to_seoul_date().isoformat()
    ordered_stamps = sorted(stamps, key=lambda item: (item.created_at, item.stamp_id), reverse=True)
    return [
        StampLogOut(
            id=str(stamp.stamp_id),
            placeId=stamp.place.slug,
            placeName=stamp.place.name,
            stampedAt=format_datetime(stamp.created_at),
            stampedDate=format_date(stamp.stamp_date),
            visitNumber=stamp.visit_ordinal,
            visitLabel=format_visit_label(stamp.visit_ordinal),
            travelSessionId=str(stamp.travel_session_id) if stamp.travel_session_id else None,
            isToday=format_date(stamp.stamp_date) == today_key,
        )
        for stamp in ordered_stamps
        if stamp.place and stamp.place.is_active
    ]


def build_travel_sessions(sessions: list[TravelSession], user_stamps: list[UserStamp], owner_routes: list[UserRoute]) -> list[TravelSessionOut]:
    stamps_by_session_id: dict[int, list[UserStamp]] = defaultdict(list)
    for stamp in user_stamps:
        if stamp.travel_session_id:
            stamps_by_session_id[stamp.travel_session_id].append(stamp)

    published_route_id_by_session = {
        route.travel_session_id: str(route.route_id)
        for route in owner_routes
        if route.travel_session_id is not None
    }

    session_payloads: list[TravelSessionOut] = []
    for session in sorted(sessions, key=lambda item: (item.started_at, item.travel_session_id), reverse=True):
        ordered_stamps = sorted(stamps_by_session_id.get(session.travel_session_id, []), key=lambda item: (item.created_at, item.stamp_id))
        unique_place_ids: list[str] = []
        unique_place_names: list[str] = []
        seen_place_ids: set[str] = set()
        for stamp in ordered_stamps:
            if not stamp.place or not stamp.place.is_active:
                continue
            if stamp.place.slug in seen_place_ids:
                continue
            seen_place_ids.add(stamp.place.slug)
            unique_place_ids.append(stamp.place.slug)
            unique_place_names.append(stamp.place.name)

        session_payloads.append(
            TravelSessionOut(
                id=str(session.travel_session_id),
                startedAt=session.started_at.isoformat(),
                endedAt=session.ended_at.isoformat(),
                durationLabel=build_session_duration_label(session),
                stampCount=session.stamp_count,
                placeIds=unique_place_ids,
                placeNames=unique_place_names,
                canPublish=len(unique_place_ids) >= 2,
                publishedRouteId=published_route_id_by_session.get(session.travel_session_id),
                coverPlaceId=unique_place_ids[0] if unique_place_ids else None,
            )
        )
    return session_payloads


def _build_stamp_state(db: Session, user_id: str | None) -> StampState:
    if not user_id:
        return StampState(collectedPlaceIds=[], logs=[], travelSessions=[])

    stamp_rows = db.scalars(
        select(UserStamp)
        .options(joinedload(UserStamp.place))
        .where(UserStamp.user_id == user_id)
        .order_by(UserStamp.created_at.desc(), UserStamp.stamp_id.desc())
    ).unique().all()
    collected_place_ids: list[str] = []
    seen_place_ids: set[str] = set()
    for stamp in stamp_rows:
        if not stamp.place or not stamp.place.is_active:
            continue
        if stamp.place.slug in seen_place_ids:
            continue
        seen_place_ids.add(stamp.place.slug)
        collected_place_ids.append(stamp.place.slug)

    travel_sessions = db.scalars(
        select(TravelSession)
        .where(TravelSession.user_id == user_id)
        .order_by(TravelSession.started_at.desc(), TravelSession.travel_session_id.desc())
    ).all()
    owner_routes = db.scalars(
        select(UserRoute)
        .where(UserRoute.user_id == user_id)
        .order_by(UserRoute.created_at.desc(), UserRoute.route_id.desc())
    ).all()

    return StampState(
        collectedPlaceIds=collected_place_ids,
        logs=build_stamp_logs(stamp_rows),
        travelSessions=build_travel_sessions(travel_sessions, stamp_rows, owner_routes),
    )


def to_review_out(feed: Feed, current_user_id: str | None = None) -> ReviewOut:
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
        visitLabel=format_visit_label(visit_number),
        travelSessionId=str(feed.stamp.travel_session_id) if feed.stamp and feed.stamp.travel_session_id else None,
        comments=build_comment_tree(comments),
    )


def to_course_out(course: Course) -> CourseOut:
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


def list_places(db: Session, category: CategoryFilter = "all") -> list[PlaceOut]:
    stmt = select(MapPlace).where(MapPlace.is_active.is_(True)).order_by(MapPlace.position_id.asc())
    if category != "all":
        stmt = stmt.where(MapPlace.category == category)
    return [to_place_out(place) for place in db.scalars(stmt).all()]


def get_place(db: Session, place_id: str) -> PlaceOut:
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
    review_key = parse_review_id(review_id)
    comments = db.scalars(
        select(UserComment)
        .options(joinedload(UserComment.user))
        .where(UserComment.feed_id == review_key)
        .order_by(UserComment.created_at.asc(), UserComment.comment_id.asc())
    ).unique().all()
    return build_comment_tree(comments)


def create_review(db: Session, payload: ReviewCreate, user_id: str, nickname: str) -> ReviewOut:
    body = payload.body.strip()
    if not body:
        raise ValueError("리뷰 본문을 적어 주세요.")

    place = db.scalars(select(MapPlace).where(MapPlace.slug == payload.place_id, MapPlace.is_active.is_(True))).first()
    if not place:
        raise ValueError("장소를 찾을 수 없어요.")

    stamp = db.scalars(
        select(UserStamp)
        .options(joinedload(UserStamp.place))
        .where(UserStamp.stamp_id == parse_stamp_id(payload.stamp_id))
    ).first()
    if not stamp or stamp.user_id != user_id:
        raise ValueError("해당 방문 스탬프를 찾을 수 없어요.")
    if stamp.position_id != place.position_id:
        raise ValueError("선택한 장소와 스탬프가 일치하지 않아요.")

    existing_feed = db.scalars(select(Feed).where(Feed.stamp_id == stamp.stamp_id)).first()
    if existing_feed:
        raise ValueError("같은 방문 인증으로는 피드를 한 번만 남길 수 있어요.")

    now = utcnow_naive()
    today = to_seoul_date(now)
    day_start = datetime.combine(today, time.min)
    day_end = day_start + timedelta(days=1)
    existing_daily_feed = db.scalars(
        select(Feed.feed_id).where(Feed.user_id == user_id, Feed.created_at >= day_start, Feed.created_at < day_end)
    ).first()
    if existing_daily_feed:
        raise ValueError("피드는 하루에 한 번만 작성할 수 있어요.")

    user = get_or_create_user(db, user_id, nickname)
    feed = Feed(
        position_id=place.position_id,
        user_id=user.user_id,
        stamp_id=stamp.stamp_id,
        body=body,
        mood=payload.mood,
        badge=BADGE_BY_MOOD.get(payload.mood, format_visit_label(stamp.visit_ordinal)),
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
    review_key = parse_review_id(review_id)
    feed = db.scalars(select(Feed).options(joinedload(Feed.likes)).where(Feed.feed_id == review_key)).unique().first()
    if not feed:
        raise ValueError("리뷰를 찾지 못했어요.")
    if feed.user_id == user_id:
        raise ValueError("내 리뷰에는 좋아요를 누를 수 없어요.")

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
    body = payload.body.strip()
    if not body:
        raise ValueError("댓글 내용을 적어 주세요.")

    review_key = parse_review_id(review_id)
    feed = db.get(Feed, review_key)
    if not feed:
        raise ValueError("리뷰를 찾을 수 없어요.")

    parent_id: int | None = None
    if payload.parent_id:
        parent_id = parse_comment_id(payload.parent_id)
        parent = db.get(UserComment, parent_id)
        if not parent or parent.feed_id != review_key:
            raise ValueError("같은 리뷰의 댓글에만 답글을 달 수 있어요.")
        # Enforce 2-level depth: if parent is itself a reply, use its root comment instead
        if parent.parent_id is not None:
            parent_id = parent.parent_id

    user = get_or_create_user(db, user_id, nickname)
    now = utcnow_naive()
    db.add(
        UserComment(
            feed_id=review_key,
            user_id=user.user_id,
            parent_id=parent_id,
            body=body,
            is_deleted=False,
            created_at=now,
            updated_at=now,
        )
    )
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
    review_key = parse_review_id(review_id)
    comment_key = parse_comment_id(comment_id)
    comment = db.scalars(
        select(UserComment).where(UserComment.comment_id == comment_key, UserComment.feed_id == review_key)
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
    review_key = parse_review_id(review_id)
    feed = db.get(Feed, review_key)
    if not feed:
        raise ValueError("리뷰를 찾지 못했어요.")
    if feed.user_id != user_id and not is_admin:
        raise PermissionError("내 리뷰만 삭제할 수 있어요.")
    db.delete(feed)
    db.commit()


def delete_account(db: Session, user_id: str) -> None:
    user = db.get(User, user_id)
    if not user:
        raise ValueError("사용자 정보를 찾지 못했어요.")
    db.delete(user)
    db.commit()


def list_courses(db: Session, mood: CourseMood | None = None) -> list[CourseOut]:
    stmt = (
        select(Course)
        .options(joinedload(Course.course_places).joinedload(CoursePlace.place))
        .order_by(Course.display_order.asc(), Course.course_id.asc())
    )
    if mood and mood != "전체":
        stmt = stmt.where(Course.mood == mood)
    return [to_course_out(course) for course in db.scalars(stmt).unique().all()]


def _find_or_create_travel_session(db: Session, user_id: str, now: datetime, last_stamp: UserStamp | None) -> TravelSession:
    if last_stamp and now - last_stamp.created_at <= timedelta(hours=24):
        if last_stamp.travel_session_id:
            session = db.get(TravelSession, last_stamp.travel_session_id)
            if session:
                session.ended_at = now
                session.last_stamp_at = now
                session.stamp_count += 1
                session.updated_at = now
                return session

        session = TravelSession(
            user_id=user_id,
            started_at=last_stamp.created_at,
            ended_at=now,
            last_stamp_at=now,
            stamp_count=2,
            created_at=now,
            updated_at=now,
        )
        db.add(session)
        db.flush()
        last_stamp.travel_session_id = session.travel_session_id
        return session

    session = TravelSession(
        user_id=user_id,
        started_at=now,
        ended_at=now,
        last_stamp_at=now,
        stamp_count=1,
        created_at=now,
        updated_at=now,
    )
    db.add(session)
    db.flush()
    return session


def get_stamps(db: Session, user_id: str | None) -> StampState:
    return _build_stamp_state(db, user_id)


def toggle_stamp(
    db: Session,
    user_id: str,
    place_id: str,
    latitude: float,
    longitude: float,
    radius_meters: int,
) -> StampState:
    get_or_create_user(db, user_id, user_id)
    place = db.scalars(select(MapPlace).where(MapPlace.slug == place_id, MapPlace.is_active.is_(True))).first()
    if not place:
        raise ValueError("장소를 찾을 수 없어요.")

    now = utcnow_naive()
    stamp_date = to_seoul_date(now)
    existing_today = db.scalars(
        select(UserStamp).where(
            UserStamp.user_id == user_id,
            UserStamp.position_id == place.position_id,
            UserStamp.stamp_date == stamp_date,
        )
    ).first()
    if existing_today:
        return get_stamps(db, user_id)

    ensure_stamp_can_be_collected(place, latitude, longitude, radius_meters)
    visit_count = db.scalar(
        select(func.count()).select_from(UserStamp).where(UserStamp.user_id == user_id, UserStamp.position_id == place.position_id)
    ) or 0
    last_stamp = db.scalars(
        select(UserStamp)
        .where(UserStamp.user_id == user_id)
        .order_by(UserStamp.created_at.desc(), UserStamp.stamp_id.desc())
        .limit(1)
    ).first()
    session = _find_or_create_travel_session(db, user_id, now, last_stamp)

    db.add(
        UserStamp(
            user_id=user_id,
            position_id=place.position_id,
            travel_session_id=session.travel_session_id,
            stamp_date=stamp_date,
            visit_ordinal=int(visit_count) + 1,
            created_at=now,
        )
    )
    db.commit()
    return get_stamps(db, user_id)


def build_my_comments(db: Session, user_id: str) -> list[MyCommentOut]:
    comment_rows = db.scalars(
        select(UserComment)
        .options(joinedload(UserComment.feed).joinedload(Feed.place))
        .where(UserComment.user_id == user_id)
        .order_by(UserComment.created_at.desc(), UserComment.comment_id.desc())
    ).unique().all()
    return [
        MyCommentOut(
            id=str(comment.comment_id),
            reviewId=str(comment.feed_id),
            placeId=comment.feed.place.slug,
            placeName=comment.feed.place.name,
            body="삭제된 댓글입니다." if comment.is_deleted else comment.body,
            isDeleted=comment.is_deleted,
            parentId=str(comment.parent_id) if comment.parent_id else None,
            createdAt=format_datetime(comment.created_at),
            reviewBody=comment.feed.body,
        )
        for comment in comment_rows
        if comment.feed and comment.feed.place
    ]

def get_my_page(db: Session, user_id: str, is_admin: bool) -> MyPageResponse:
    user = db.get(User, user_id)
    if not user:
        raise ValueError("사용자 정보를 찾을 수 없어요.")

    reviews = list_reviews(db, user_id=user_id, current_user_id=user_id)
    stamp_state = get_stamps(db, user_id)
    active_places = db.scalars(select(MapPlace).where(MapPlace.is_active.is_(True)).order_by(MapPlace.position_id.asc())).all()
    visited_place_ids = set(stamp_state.collected_place_ids)
    visited_places = [to_place_out(place) for place in active_places if place.slug in visited_place_ids]
    unvisited_places = [to_place_out(place) for place in active_places if place.slug not in visited_place_ids]

    from .user_routes_normalized import list_user_routes_for_owner

    routes = list_user_routes_for_owner(db, user_id)
    comments = build_my_comments(db, user_id)
    return MyPageResponse(
        user=to_session_user(user, is_admin),
        stats=MyStatsOut(
            reviewCount=len(reviews),
            stampCount=len(stamp_state.logs),
            uniquePlaceCount=len(visited_places),
            totalPlaceCount=len(active_places),
            routeCount=len(routes),
        ),
        reviews=reviews,
        comments=comments,
        stampLogs=stamp_state.logs,
        travelSessions=stamp_state.travel_sessions,
        visitedPlaces=visited_places,
        unvisitedPlaces=unvisited_places,
        collectedPlaces=visited_places,
        routes=routes,
    )


def get_bootstrap(db: Session, user_id: str | None) -> BootstrapResponse:
    places = list_places(db)
    return BootstrapResponse(
        places=places,
        reviews=list_reviews(db, current_user_id=user_id),
        courses=list_courses(db),
        stamps=get_stamps(db, user_id),
        hasRealData=bool(places),
    )


def get_admin_summary(db: Session, settings: Settings) -> AdminSummaryResponse:
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


def update_place_visibility(
    db: Session,
    place_id: str,
    is_active: bool | None = None,
    is_manual_override: bool | None = None,
) -> AdminPlaceOut:
    """장소 노출 여부와 공공데이터 동기화 보호 여부를 변경합니다."""

    place = db.scalars(select(MapPlace).where(MapPlace.slug == place_id)).first()
    if not place:
        raise ValueError("장소를 찾을 수 없어요.")

    changed = False
    if is_active is not None and place.is_active != is_active:
        place.is_active = is_active
        changed = True
    if is_manual_override is not None and place.is_manual_override != is_manual_override:
        place.is_manual_override = is_manual_override
        changed = True
    if changed:
        place.updated_at = utcnow_naive()
        db.commit()

    review_count = db.scalar(select(func.count()).select_from(Feed).where(Feed.position_id == place.position_id)) or 0
    return to_admin_place_out(place, int(review_count))


def cleanup_legacy_demo_content(db: Session) -> None:
    legacy_users = db.scalars(select(User).where(User.provider.in_(LEGACY_PROVIDERS))).all()
    if not legacy_users:
        return
    for user in legacy_users:
        db.delete(user)
    db.commit()


def load_public_bundle(settings: Settings) -> dict:
    return load_public_bundle_payload(settings).model_dump(by_alias=True, exclude_none=True)


def import_public_bundle(db: Session, settings: Settings) -> PublicImportResponse:
    return sync_public_bundle(db, settings)








