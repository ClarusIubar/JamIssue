"""User-generated route logic based on travel sessions."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from .db_models import MapPlace, TravelSession, UserRoute, UserRouteLike, UserRoutePlace, UserStamp
from .models import RouteSort, UserRouteCreate, UserRouteLikeResponse, UserRouteOut
from .repository_normalized import format_datetime, get_or_create_user, utcnow_naive

MIN_ROUTE_PLACE_COUNT = 2


def _to_user_route_out(route: UserRoute, current_user_id: str | None) -> UserRouteOut:
    """
    UserRoute 모델(DB 데이터)을 화면 표시용 UserRouteOut 스키마로 변환합니다.
    """
    ordered_places = sorted(route.route_places, key=lambda item: item.stop_order)
    liked_by_me = any(like.user_id == current_user_id for like in route.likes) if current_user_id else False
    return UserRouteOut(
        id=str(route.route_id),
        authorId=route.user_id,
        author=route.user.nickname if route.user else "이름 없음",
        title=route.title,
        description=route.description,
        mood=route.mood,
        likeCount=route.like_count,
        likedByMe=liked_by_me,
        createdAt=format_datetime(route.created_at),
        placeIds=[route_place.place.slug for route_place in ordered_places],
        placeNames=[route_place.place.name for route_place in ordered_places],
        isUserGenerated=route.is_user_generated,
        travelSessionId=str(route.travel_session_id) if route.travel_session_id else None,
    )


def _load_route_or_raise(db: Session, route_id: str) -> UserRoute:
    """
    route_id(경로 식별자)를 기반으로 해당 사용자 경로 레코드를 조회합니다.
    존재하지 않거나 파싱할 수 없는 형식이면 ValueError를 발생시킵니다.
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
    공개된 사용자 루트 목록(커뮤니티 루트 목록)을 지정된 정렬 조건(최신순, 인기순)에 따라 반환합니다.
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
    특정 사용자가 작성한 루트 목록 전체를 반환합니다. (마이페이지용)
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
    특정 여행 세션(TravelSession)을 바탕으로 사용자 작성 루트(UserRoute)를 생성합니다.
    - 해당 세션이 존재하고 소유자가 맞는지
    - 세션에 포함된 스탬프가 최소 개수 기준을 넘는지
    등을 검증 후 저장합니다.
    """
    title = payload.title.strip()
    description = payload.description.strip()
    if len(title) < 2:
        raise ValueError("경로 제목은 두 글자 이상으로 적어 주세요.")
    if len(description) < 8:
        raise ValueError("경로 소개는 조금 더 자세히 적어 주세요.")

    try:
        travel_session_key = int(payload.travel_session_id)
    except ValueError as error:
        raise ValueError("여행 세션 ID 형식이 올바르지 않아요.") from error

    session_row = db.scalars(
        select(TravelSession).where(TravelSession.travel_session_id == travel_session_key, TravelSession.user_id == user_id)
    ).first()
    if not session_row:
        raise ValueError("여행 세션을 찾지 못했어요.")

    existing_route = db.scalars(
        select(UserRoute).where(UserRoute.user_id == user_id, UserRoute.travel_session_id == travel_session_key)
    ).first()
    if existing_route:
        raise ValueError("이미 발행한 여행 코스예요.")

    session_stamp_rows = db.scalars(
        select(UserStamp)
        .options(joinedload(UserStamp.place))
        .where(UserStamp.user_id == user_id, UserStamp.travel_session_id == travel_session_key)
        .order_by(UserStamp.created_at.asc(), UserStamp.stamp_id.asc())
    ).unique().all()

    ordered_places: list[MapPlace] = []
    seen_place_ids: set[int] = set()
    for stamp in session_stamp_rows:
        if stamp.position_id in seen_place_ids or not stamp.place or not stamp.place.is_active:
            continue
        seen_place_ids.add(stamp.position_id)
        ordered_places.append(stamp.place)

    if len(ordered_places) < MIN_ROUTE_PLACE_COUNT:
        raise ValueError("코스에는 최소 두 곳 이상의 스탬프 기록이 필요해요.")

    user = get_or_create_user(db, user_id, nickname)
    now = utcnow_naive()
    route = UserRoute(
        user_id=user.user_id,
        travel_session_id=travel_session_key,
        title=title,
        description=description,
        mood=payload.mood,
        is_public=payload.is_public,
        is_user_generated=True,
        like_count=0,
        created_at=now,
        updated_at=now,
    )
    db.add(route)
    db.flush()

    for stop_order, place in enumerate(ordered_places, start=1):
        db.add(
            UserRoutePlace(
                route_id=route.route_id,
                position_id=place.position_id,
                stop_order=stop_order,
                created_at=now,
            )
        )

    db.commit()
    return _to_user_route_out(_load_route_or_raise(db, str(route.route_id)), user_id)


def toggle_user_route_like(db: Session, route_id: str, user_id: str, nickname: str) -> UserRouteLikeResponse:
    """
    특정 사용자 경로(UserRoute)에 대해 좋아요 상태를 토글(추가/삭제)합니다.
    내가 작성한 경로나 비공개 경로인 경우 에러를 반환합니다.
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
        db.add(UserRouteLike(route_id=route.route_id, user_id=user_id, created_at=utcnow_naive()))
        route.like_count += 1
        liked_by_me = True

    route.updated_at = utcnow_naive()
    db.commit()
    return UserRouteLikeResponse(routeId=str(route.route_id), likeCount=route.like_count, likedByMe=liked_by_me)


def delete_user_route(db: Session, route_id: str, user_id: str, *, is_admin: bool = False) -> None:
    """
    특정 사용자 경로를 영구적으로 삭제(Delete) 처리합니다.
    """
    route = _load_route_or_raise(db, route_id)
    if route.user_id != user_id and not is_admin:
        raise PermissionError("내가 만든 경로만 삭제할 수 있어요.")
    db.delete(route)
    db.commit()
