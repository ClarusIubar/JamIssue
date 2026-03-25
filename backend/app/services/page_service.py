from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..config import Settings
from ..models import CategoryFilter, CourseMood, SessionUser, StampToggleRequest
from ..repository_normalized import (
    get_bootstrap,
    get_my_page,
    get_place,
    get_stamps,
    list_courses,
    list_places,
    list_reviews,
    toggle_stamp,
)


def read_bootstrap_service(db: Session, session_user: SessionUser | None):
    """
    앱 초기 구동 시 필요한 데이터(장소, 코스, 스탬프 등)를 한 번에 내려주는 서비스 함수입니다.
    """
    return get_bootstrap(db, session_user.id if session_user else None)


def read_places_service(db: Session, category: CategoryFilter):
    """
    공개 가능한 지도 장소 목록을 카테고리에 맞춰 반환합니다.
    """
    return list_places(db, category)


def read_place_service(db: Session, place_id: str):
    """
    단일 장소 상세 정보를 반환합니다.
    """
    try:
        return get_place(db, place_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


def read_courses_service(db: Session, mood: CourseMood | None):
    """
    운영자가 큐레이션한 코스 목록을 조회합니다. (선택적 분위기 필터 포함)
    """
    return list_courses(db, mood)


def read_reviews_service(db: Session, place_id: str | None, user_id: str | None, session_user: SessionUser | None):
    """
    피드(리뷰) 목록을 조회합니다. 특정 장소나 특정 사용자의 후기만 골라서 볼 수 있습니다.
    """
    return list_reviews(db, place_id=place_id, user_id=user_id, current_user_id=session_user.id if session_user else None)


def read_my_page_service(db: Session, session_user: SessionUser, app_settings: Settings):
    """
    마이페이지 상단 통계, 스탬프, 사용자 후기 등 요약 정보를 반환합니다.
    """
    try:
        return get_my_page(db, session_user.id, app_settings.is_admin(session_user.id))
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


def read_stamps_service(db: Session, session_user: SessionUser | None):
    """
    현재 사용자가 획득한 전체 스탬프 기록 및 여행 세션을 조회합니다.
    """
    return get_stamps(db, session_user.id if session_user else None)


def toggle_stamp_service(db: Session, payload: StampToggleRequest, session_user: SessionUser, app_settings: Settings):
    """
    사용자의 현재 위치(반경)를 검증한 후 장소 스탬프를 획득 처리합니다.
    """
    try:
        return toggle_stamp(
            db,
            session_user.id,
            payload.place_id,
            payload.latitude,
            payload.longitude,
            app_settings.stamp_unlock_radius_meters,
        )
    except PermissionError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
