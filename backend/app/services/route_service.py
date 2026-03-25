from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import RouteSort, SessionUser, UserRouteCreate
from ..user_routes_normalized import (
    create_user_route,
    delete_user_route,
    list_public_user_routes,
    list_user_routes_for_owner,
    toggle_user_route_like,
)


def read_community_routes_service(db: Session, sort: RouteSort, session_user: SessionUser | None):
    """
    공개된 커뮤니티(사용자) 루트 목록을 주어진 정렬 기준(sort)에 따라 반환합니다.
    """
    return list_public_user_routes(db, sort, session_user.id if session_user else None)


def create_community_route_service(db: Session, payload: UserRouteCreate, session_user: SessionUser):
    """
    새로운 커뮤니티(사용자) 루트를 생성합니다.
    """
    try:
        return create_user_route(db, payload, session_user.id, session_user.nickname)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


def toggle_community_route_like_service(db: Session, route_id: str, session_user: SessionUser):
    """
    지정된 커뮤니티 루트에 대해 좋아요 상태를 토글(추가/취소)합니다.
    """
    try:
        return toggle_user_route_like(db, route_id, session_user.id, session_user.nickname)
    except ValueError as error:
        detail = str(error)
        status_code = status.HTTP_400_BAD_REQUEST
        if "찾지 못" in detail:
            status_code = status.HTTP_404_NOT_FOUND
        raise HTTPException(status_code=status_code, detail=detail) from error


def delete_community_route_service(db: Session, route_id: str, session_user: SessionUser) -> None:
    """
    사용자가 생성한 루트를 삭제합니다. 관리자는 다른 사용자의 루트도 삭제할 수 있습니다.
    """
    try:
        delete_user_route(db, route_id, session_user.id, is_admin=session_user.is_admin)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error


def read_my_routes_service(db: Session, session_user: SessionUser):
    """
    현재 사용자가 생성한 모든 루트 목록을 조회하여 반환합니다.
    """
    return list_user_routes_for_owner(db, session_user.id)
