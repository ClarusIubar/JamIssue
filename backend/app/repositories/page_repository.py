from sqlalchemy.orm import Session

from ..models import CategoryFilter, CourseMood
from ..repository_normalized import (
    get_bootstrap,
    get_my_page,
    get_place,
    get_stamps,
    list_courses,
    list_places,
    toggle_stamp,
)


def read_bootstrap_bundle(db: Session, user_id: str | None):
    return get_bootstrap(db, user_id)


def list_place_entries(db: Session, category: CategoryFilter):
    return list_places(db, category)


def read_place_entry(db: Session, place_id: str):
    return get_place(db, place_id)


def list_course_entries(db: Session, mood: CourseMood | None):
    return list_courses(db, mood)


def read_my_page_entry(db: Session, user_id: str, is_admin: bool):
    return get_my_page(db, user_id, is_admin)


def read_stamp_state(db: Session, user_id: str | None):
    return get_stamps(db, user_id)


def toggle_stamp_entry(
    db: Session,
    user_id: str,
    place_id: str,
    latitude: float,
    longitude: float,
    unlock_radius_meters: int,
):
    return toggle_stamp(db, user_id, place_id, latitude, longitude, unlock_radius_meters)
