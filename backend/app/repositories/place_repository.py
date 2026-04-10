from sqlalchemy.orm import Session

from ..models import CategoryFilter
from ..repository_normalized import get_place, list_places


def list_place_entries(db: Session, category: CategoryFilter):
    return list_places(db, category)


def read_place_entry(db: Session, place_id: str):
    return get_place(db, place_id)
