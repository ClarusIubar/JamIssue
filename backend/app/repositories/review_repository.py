from sqlalchemy.orm import Session

from ..models import CommentCreate, ReviewCreate
from ..repository_normalized import (
    create_comment_with_notifications,
    create_review,
    delete_comment,
    delete_review,
    get_review_comments,
    list_reviews,
    toggle_review_like,
)


def list_review_entries(
    db: Session,
    *,
    place_id: str | None = None,
    user_id: str | None = None,
    current_user_id: str | None = None,
):
    return list_reviews(db, place_id=place_id, user_id=user_id, current_user_id=current_user_id)


def list_review_comments(db: Session, review_id: str):
    return get_review_comments(db, review_id)


def create_review_entry(db: Session, payload: ReviewCreate, user_id: str, nickname: str):
    return create_review(db, payload, user_id, nickname)


def toggle_review_like_entry(db: Session, review_id: str, user_id: str, nickname: str):
    return toggle_review_like(db, review_id, user_id, nickname)


def create_review_comment_with_notifications(
    db: Session,
    review_id: str,
    payload: CommentCreate,
    user_id: str,
    nickname: str,
):
    return create_comment_with_notifications(db, review_id, payload, user_id, nickname)


def delete_review_comment(db: Session, review_id: str, comment_id: str, user_id: str, *, is_admin: bool = False):
    return delete_comment(db, review_id, comment_id, user_id, is_admin=is_admin)


def delete_review_entry(db: Session, review_id: str, user_id: str, *, is_admin: bool = False) -> None:
    delete_review(db, review_id, user_id, is_admin=is_admin)
