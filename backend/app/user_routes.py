"""User-generated route domain logic."""

from __future__ import annotations

from collections import OrderedDict

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from .db_models import MapPlace, UserRoute, UserRouteLike, UserRoutePlace, UserStamp
from .models import RouteSort, UserRouteCreate, UserRouteLikeResponse, UserRouteOut
from .repository import format_datetime, get_or_create_user, utcnow_naive

MAX_ROUTE_PLACE_COUNT = 6
MIN_ROUTE_PLACE_COUNT = 2


def _normalize_place_ids(place_ids: list[str]) -> list[str]:
    """
    클라이언트가 전달한 장소 식별자(slug) 목록의 중복을 제거하고
    루트 생성에 필요한 최소/최대 장소 개수 조건을 검증합니다.
    """
    ordered_unique = list(OrderedDict.fromkeys(place_id.strip() for place_id in place_ids if place_id.strip()))
    if len(ordered_unique) < MIN_ROUTE_PLACE_COUNT:
        raise ValueError("추천 경로는 최소 2곳 이상을 묶어야 해요.")
    if len(ordered_unique) > MAX_ROUTE_PLACE_COUNT:
        raise ValueError("추천 경로는 최대 6곳까지만 묶을 수 있어요.")
    return ordered_unique


def _to_user_route_out(route: UserRoute, current_user_id: str | None) -> UserRouteOut:
    """
    UserRoute ORM 객체를 API 응답용 UserRouteOut Pydantic 모델로 변환합니다.
    사용자 좋아요 여부(likedByMe)를 판단하기 위해 현재 로그인한 사용자 ID를 함께 받습니다.
    """
    ordered_places = sorted(route.route_places, key=lambda item: item.stop_order)
    liked_by_me = any(like.user_id == current_user_id for like in route.likes) if current_user_id else False
    return UserRouteOut(
        id=str(route.route_id),
        authorId=route.user_id,
        author=route.user.nickname if route.user else "알 수 없음",
        title=route.title,
        description=route.description,
        mood=route.mood,
        likeCount=route.like_count,
        likedByMe=liked_by_me,
        createdAt=format_datetime(route.created_at),
        placeIds=[route_place.place.slug for route_place in ordered_places],
        placeNames=[route_place.place.name for route_place in ordered_places],
    )


def _load_route_or_raise(db: Session, route_id: str) -> UserRoute:
    """
    주어진 식별자(ID)로 UserRoute ORM 객체를 조회합니다.
    올바르지 않은 형식이거나 존재하지 않는 경우 ValueError를 발생시킵니다.
    """
    try:
        route_key = int(route_id)
    except ValueError as error:
        raise ValueError("경로 ID 형식이 올바르지 않아요.") from error

    route = db.scalars(
        select(UserRoute)
        .options(
            joinedload(UserRoute.user),
            joinedload(UserRoute.route_places).joinedload(UserRoutePlace.place),
            joinedload(UserRoute.likes),
        )
        .where(UserRoute.route_id == route_key)
    ).unique().first()
    if not route:
        raise ValueError("경로를 찾지 못했어요.")
    return route


def list_public_user_routes(db: Session, sort: RouteSort, current_user_id: str | None = None) -> list[UserRouteOut]:
    """
    공개(is_public=True)된 커뮤니티(사용자 생성) 루트 목록을 최신순 또는 인기순(좋아요순)으로 정렬하여 반환합니다.
    """
    stmt = (
        select(UserRoute)
        .options(
            joinedload(UserRoute.user),
            joinedload(UserRoute.route_places).joinedload(UserRoutePlace.place),
            joinedload(UserRoute.likes),
        )
        .where(UserRoute.is_public.is_(True))
    )

    if sort == "latest":
        stmt = stmt.order_by(UserRoute.created_at.desc(), UserRoute.route_id.desc())
    else:
        stmt = stmt.order_by(UserRoute.like_count.desc(), UserRoute.created_at.desc(), UserRoute.route_id.desc())

    routes = db.scalars(stmt).unique().all()
    return [_to_user_route_out(route, current_user_id) for route in routes]


def list_user_routes_for_owner(db: Session, user_id: str) -> list[UserRouteOut]:
    """
    특정 사용자(owner)가 작성한 모든 루트 목록을 최신순으로 조회하여 반환합니다.
    마이페이지 등에서 사용됩니다.
    """
    routes = db.scalars(
        select(UserRoute)
        .options(
            joinedload(UserRoute.user),
            joinedload(UserRoute.route_places).joinedload(UserRoutePlace.place),
            joinedload(UserRoute.likes),
        )
        .where(UserRoute.user_id == user_id)
        .order_by(UserRoute.created_at.desc(), UserRoute.route_id.desc())
    ).unique().all()
    return [_to_user_route_out(route, user_id) for route in routes]


def create_user_route(db: Session, payload: UserRouteCreate, user_id: str, nickname: str) -> UserRouteOut:
    """
    새로운 사용자 생성(커뮤니티) 루트를 DB에 저장하고, 저장된 루트 정보를 반환합니다.
    사용자가 이전에 획득한 스탬프 장소 목록에 포함되어 있는지(검증) 확인하는 로직이 포함됩니다.
    """
    title = payload.title.strip()
    description = payload.description.strip()
    if len(title) < 2:
        raise ValueError("경로 제목은 두 글자 이상으로 적어 주세요.")
    if len(description) < 8:
        raise ValueError("경로 소개는 조금 더 자세히 적어 주세요.")

    place_ids = _normalize_place_ids(payload.place_ids)
    stamped_place_ids = set(
        db.scalars(
            select(MapPlace.slug)
            .join(UserStamp, UserStamp.position_id == MapPlace.position_id)
            .where(UserStamp.user_id == user_id)
        ).all()
    )
    missing_stamps = [place_id for place_id in place_ids if place_id not in stamped_place_ids]
    if missing_stamps:
        raise ValueError("내가 실제로 찍은 스탬프 장소만 경로로 공개할 수 있어요.")

    places = db.scalars(select(MapPlace).where(MapPlace.slug.in_(place_ids), MapPlace.is_active.is_(True))).all()
    places_by_slug = {place.slug: place for place in places}
    if len(places_by_slug) != len(place_ids):
        raise ValueError("공개할 수 없는 장소가 포함되어 있어요.")

    user = get_or_create_user(db, user_id, nickname)
    now = utcnow_naive()
    route = UserRoute(
        user_id=user.user_id,
        title=title,
        description=description,
        mood=payload.mood,
        is_public=payload.is_public,
        like_count=0,
        created_at=now,
        updated_at=now,
    )
    db.add(route)
    db.flush()

    for stop_order, place_id in enumerate(place_ids, start=1):
        db.add(
            UserRoutePlace(
                route_id=route.route_id,
                position_id=places_by_slug[place_id].position_id,
                stop_order=stop_order,
                created_at=now,
            )
        )

    db.commit()
    return _to_user_route_out(_load_route_or_raise(db, str(route.route_id)), user_id)


def toggle_user_route_like(db: Session, route_id: str, user_id: str, nickname: str) -> UserRouteLikeResponse:
    """
    특정 커뮤니티 루트에 대한 사용자의 '좋아요' 상태를 토글(추가/취소)합니다.
    자신이 만든 루트이거나 비공개 루트인 경우 예외를 발생시킵니다.
    """
    route = _load_route_or_raise(db, route_id)
    if not route.is_public:
        raise ValueError("비공개 경로에는 좋아요를 누를 수 없어요.")
    if route.user_id == user_id:
        raise ValueError("내가 만든 경로에는 좋아요를 누를 수 없어요.")

    get_or_create_user(db, user_id, nickname)
    existing = db.scalars(
        select(UserRouteLike).where(UserRouteLike.route_id == route.route_id, UserRouteLike.user_id == user_id)
    ).first()

    if existing:
        db.delete(existing)
        route.like_count = max(route.like_count - 1, 0)
        liked_by_me = False
    else:
        db.add(
            UserRouteLike(
                route_id=route.route_id,
                user_id=user_id,
                created_at=utcnow_naive(),
            )
        )
        route.like_count += 1
        liked_by_me = True

    route.updated_at = utcnow_naive()
    db.commit()

    return UserRouteLikeResponse(routeId=str(route.route_id), likeCount=route.like_count, likedByMe=liked_by_me)


def delete_user_route(db: Session, route_id: str, user_id: str, *, is_admin: bool = False) -> None:
    """
    지정된 커뮤니티 루트를 DB에서 완전 삭제합니다.
    본인의 루트이거나 관리자 권한(is_admin=True)일 때만 삭제가 가능합니다.
    """
    route = _load_route_or_raise(db, route_id)
    if route.user_id != user_id and not is_admin:
        raise PermissionError("내가 만든 경로만 삭제할 수 있어요.")

    db.delete(route)
    db.commit()
