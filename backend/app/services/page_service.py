from collections.abc import Callable

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..config import Settings
from ..models import CategoryFilter, CourseMood, SessionUser, StampToggleRequest
from ..repositories.page_repository import (
    list_course_entries,
    list_place_entries,
    read_bootstrap_bundle,
    read_my_page_entry,
    read_place_entry,
    read_stamp_state,
    toggle_stamp_entry,
)
from ..repositories.review_repository import list_review_entries


def _raise_not_found(detail: str) -> None:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _raise_forbidden(detail: str) -> None:
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def _run_not_found_policy(action: Callable[[], object]):
    try:
        return action()
    except ValueError as error:
        _raise_not_found(str(error))


def _run_stamp_policy(action: Callable[[], object]):
    try:
        return action()
    except PermissionError as error:
        _raise_forbidden(str(error))
    except ValueError as error:
        _raise_not_found(str(error))


def read_bootstrap_service(db: Session, session_user: SessionUser | None):
    return read_bootstrap_bundle(db, session_user.id if session_user else None)


def read_places_service(db: Session, category: CategoryFilter):
    return list_place_entries(db, category)


def read_place_service(db: Session, place_id: str):
    return _run_not_found_policy(lambda: read_place_entry(db, place_id))


def read_courses_service(db: Session, mood: CourseMood | None):
    return list_course_entries(db, mood)


def read_reviews_service(db: Session, place_id: str | None, user_id: str | None, session_user: SessionUser | None):
    return list_review_entries(db, place_id=place_id, user_id=user_id, current_user_id=session_user.id if session_user else None)


def read_my_page_service(db: Session, session_user: SessionUser, app_settings: Settings):
    return _run_not_found_policy(lambda: read_my_page_entry(db, session_user.id, app_settings.is_admin(session_user.id)))


def read_stamps_service(db: Session, session_user: SessionUser | None):
    return read_stamp_state(db, session_user.id if session_user else None)


def toggle_stamp_service(db: Session, payload: StampToggleRequest, session_user: SessionUser, app_settings: Settings):
    return _run_stamp_policy(
        lambda: toggle_stamp_entry(
            db,
            session_user.id,
            payload.place_id,
            payload.latitude,
            payload.longitude,
            app_settings.stamp_unlock_radius_meters,
        ),
    )
