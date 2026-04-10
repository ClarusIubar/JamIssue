from sqlalchemy.orm import Session

from ..models import CourseMood, SessionUser
from ..repositories.page_repository import (
    list_course_entries,
    read_bootstrap_bundle,
)
from ..repositories.review_repository import list_review_entries


def read_bootstrap_service(db: Session, session_user: SessionUser | None):
    return read_bootstrap_bundle(db, session_user.id if session_user else None)


def read_courses_service(db: Session, mood: CourseMood | None):
    return list_course_entries(db, mood)


def read_reviews_service(db: Session, place_id: str | None, user_id: str | None, session_user: SessionUser | None):
    return list_review_entries(db, place_id=place_id, user_id=user_id, current_user_id=session_user.id if session_user else None)
