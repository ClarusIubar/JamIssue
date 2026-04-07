from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import CommentCreate, ReviewCreate, ReviewLikeResponse, ReviewOut, SessionUser, UserNotificationOut
from ..notification_broker import notification_broker
from ..repository_normalized import (
    create_comment_with_notifications,
    create_review,
    delete_comment,
    delete_review,
    get_review_comments,
    get_unread_notification_counts,
    toggle_review_like,
)

_PLACE_NOT_FOUND_TOKEN = "\uc7a5\uc18c"
_ENTITY_NOT_FOUND_TOKEN = "\ucc3e\uc744 \uc218"


def _raise_review_value_error(detail: str, *, not_found_tokens: tuple[str, ...] = ()) -> None:
    status_code = status.HTTP_404_NOT_FOUND if any(token in detail for token in not_found_tokens) else status.HTTP_400_BAD_REQUEST
    raise HTTPException(status_code=status_code, detail=detail)


def _raise_not_found(detail: str) -> None:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _raise_forbidden(detail: str) -> None:
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def _publish_comment_notifications(
    db: Session,
    notifications: list[tuple[str, UserNotificationOut]],
) -> None:
    recipient_ids = [recipient_user_id for recipient_user_id, _ in notifications]
    unread_counts = get_unread_notification_counts(db, recipient_ids)

    for recipient_user_id, notification in notifications:
        notification_broker.publish(
            recipient_user_id,
            {
                "event": "notification.created",
                "notification": notification.model_dump(by_alias=True),
                "unreadCount": unread_counts.get(recipient_user_id, 0),
            },
        )


def create_review_service(db: Session, payload: ReviewCreate, session_user: SessionUser) -> ReviewOut:
    try:
        return create_review(db, payload, session_user.id, session_user.nickname)
    except ValueError as error:
        _raise_review_value_error(str(error), not_found_tokens=(_PLACE_NOT_FOUND_TOKEN,))


def delete_review_service(db: Session, review_id: str, session_user: SessionUser) -> None:
    try:
        delete_review(db, review_id, session_user.id, is_admin=session_user.is_admin)
    except ValueError as error:
        _raise_not_found(str(error))
    except PermissionError as error:
        _raise_forbidden(str(error))


def toggle_review_like_service(db: Session, review_id: str, session_user: SessionUser) -> ReviewLikeResponse:
    try:
        return toggle_review_like(db, review_id, session_user.id, session_user.nickname)
    except ValueError as error:
        _raise_review_value_error(str(error), not_found_tokens=(_ENTITY_NOT_FOUND_TOKEN,))


def read_review_comments_service(db: Session, review_id: str):
    try:
        return get_review_comments(db, review_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


def create_comment_service(db: Session, review_id: str, payload: CommentCreate, session_user: SessionUser):
    try:
        comments, notifications = create_comment_with_notifications(db, review_id, payload, session_user.id, session_user.nickname)
        _publish_comment_notifications(db, notifications)
        return comments
    except ValueError as error:
        _raise_review_value_error(str(error), not_found_tokens=(_ENTITY_NOT_FOUND_TOKEN,))


def delete_comment_service(db: Session, review_id: str, comment_id: str, session_user: SessionUser):
    try:
        return delete_comment(db, review_id, comment_id, session_user.id, is_admin=session_user.is_admin)
    except ValueError as error:
        _raise_not_found(str(error))
    except PermissionError as error:
        _raise_forbidden(str(error))
