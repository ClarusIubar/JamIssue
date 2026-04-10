from sqlalchemy.orm import Session

from ..models import CourseMood
from ..repository_normalized import (
    get_bootstrap,
    list_courses,
)


def read_bootstrap_bundle(db: Session, user_id: str | None):
    return get_bootstrap(db, user_id)
def list_course_entries(db: Session, mood: CourseMood | None):
    return list_courses(db, mood)
