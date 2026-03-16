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
    ordered_unique = list(OrderedDict.fromkeys(place_id.strip() for place_id in place_ids if place_id.strip()))
    if len(ordered_unique) < MIN_ROUTE_PLACE_COUNT:
        raise ValueError("추천 경로는 최소 2곳 이상을 묶어야 해요.")
    if len(ordered_unique) > MAX_ROUTE_PLACE_COUNT:
        raise ValueError("추천 경로는 최대 6곳까지만 묶을 수 있어요.")
    return ordered_unique


def _to_user_route_out(route: UserRoute, current_user_id: str | None) -> UserRouteOut:
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
    route = _load_route_or_raise(db, route_id)
    if route.user_id != user_id and not is_admin:
        raise PermissionError("내가 만든 경로만 삭제할 수 있어요.")

    db.delete(route)
    db.commit()
