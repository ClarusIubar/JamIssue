from collections.abc import Callable

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import CategoryFilter
from ..repositories.place_repository import list_place_entries, read_place_entry


def _raise_not_found(detail: str) -> None:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _run_not_found_policy(action: Callable[[], object]):
    try:
        return action()
    except ValueError as error:
        _raise_not_found(str(error))


def read_places_service(db: Session, category: CategoryFilter):
    return list_place_entries(db, category)


def read_place_service(db: Session, place_id: str):
    return _run_not_found_policy(lambda: read_place_entry(db, place_id))
