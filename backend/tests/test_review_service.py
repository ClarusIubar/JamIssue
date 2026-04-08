from types import SimpleNamespace

import pytest
from fastapi import HTTPException, status

from app.models import CommentCreate, ReviewCreate, SessionUser, UserNotificationOut
from app.services import review_service


def build_session_user() -> SessionUser:
    return SessionUser(
        id="user-1",
        nickname="tester",
        email="tester@example.com",
        provider="kakao",
        profileImage=None,
        isAdmin=False,
        profileCompletedAt=None,
    )


def build_notification(notification_id: str) -> UserNotificationOut:
    return UserNotificationOut(
        id=notification_id,
        type="comment-reply",
        title="reply",
        body="A reply was posted.",
        createdAt="04. 07. 10:15",
        isRead=False,
        reviewId="11",
        commentId="21",
        routeId=None,
        actorName="ga-eun",
    )


def test_create_review_service_maps_missing_place_to_404(monkeypatch):
    def failing_create_review(*_args, **_kwargs):
        raise ValueError("\uc7a5\uc18c\ub97c \ucc3e\uc744 \uc218 \uc5c6\uc5b4\uc694.")

    monkeypatch.setattr(review_service, "create_review_entry", failing_create_review)

    with pytest.raises(HTTPException) as caught:
        review_service.create_review_service(
            db=SimpleNamespace(),
            payload=ReviewCreate(
                placeId="place-1",
                stampId="stamp-1",
                body="body",
                mood="\ud63c\uc790\uc11c",
                imageUrl=None,
            ),
            session_user=build_session_user(),
        )

    assert caught.value.status_code == status.HTTP_404_NOT_FOUND


def test_create_comment_service_publishes_notifications(monkeypatch):
    comments = [{"id": "comment-1"}]
    notifications = [
        ("user-2", build_notification("notification-1")),
        ("user-3", build_notification("notification-2")),
    ]
    publish_calls: list[tuple[str, dict]] = []

    monkeypatch.setattr(
        review_service,
        "create_review_comment_with_notifications",
        lambda *_args, **_kwargs: (comments, notifications),
    )
    monkeypatch.setattr(
        review_service,
        "get_unread_notification_counts",
        lambda _db, user_ids: {user_id: index + 1 for index, user_id in enumerate(user_ids)},
    )
    monkeypatch.setattr(
        review_service.notification_broker,
        "publish",
        lambda user_id, payload: publish_calls.append((user_id, payload)),
    )

    result = review_service.create_comment_service(
        db=SimpleNamespace(),
        review_id="11",
        payload=CommentCreate(body="body", parentId=None),
        session_user=build_session_user(),
    )

    assert result == comments
    assert publish_calls == [
        (
            "user-2",
            {
                "event": "notification.created",
                "notification": notifications[0][1].model_dump(by_alias=True),
                "unreadCount": 1,
            },
        ),
        (
            "user-3",
            {
                "event": "notification.created",
                "notification": notifications[1][1].model_dump(by_alias=True),
                "unreadCount": 2,
            },
        ),
    ]


def test_create_comment_service_maps_missing_review_to_404(monkeypatch):
    def failing_create_comment(*_args, **_kwargs):
        raise ValueError("\ub9ac\ubdf0\ub97c \ucc3e\uc744 \uc218 \uc5c6\uc5b4\uc694.")

    monkeypatch.setattr(review_service, "create_review_comment_with_notifications", failing_create_comment)

    with pytest.raises(HTTPException) as caught:
        review_service.create_comment_service(
            db=SimpleNamespace(),
            review_id="11",
            payload=CommentCreate(body="body", parentId=None),
            session_user=build_session_user(),
        )

    assert caught.value.status_code == status.HTTP_404_NOT_FOUND


def test_create_comment_service_maps_invalid_reply_target_to_400(monkeypatch):
    def failing_create_comment(*_args, **_kwargs):
        raise ValueError("같은 리뷰의 댓글에만 답글을 달 수 있어요.")

    monkeypatch.setattr(review_service, "create_review_comment_with_notifications", failing_create_comment)

    with pytest.raises(HTTPException) as caught:
        review_service.create_comment_service(
            db=SimpleNamespace(),
            review_id="11",
            payload=CommentCreate(body="body", parentId="21"),
            session_user=build_session_user(),
        )

    assert caught.value.status_code == status.HTTP_400_BAD_REQUEST


def test_toggle_review_like_service_maps_missing_review_to_404(monkeypatch):
    def failing_toggle_review_like(*_args, **_kwargs):
        raise ValueError("\ub9ac\ubdf0\ub97c \ucc3e\uc744 \uc218 \uc5c6\uc5b4\uc694.")

    monkeypatch.setattr(review_service, "toggle_review_like_entry", failing_toggle_review_like)

    with pytest.raises(HTTPException) as caught:
        review_service.toggle_review_like_service(
            db=SimpleNamespace(),
            review_id="11",
            session_user=build_session_user(),
        )

    assert caught.value.status_code == status.HTTP_404_NOT_FOUND


def test_delete_review_service_maps_permission_error_to_403(monkeypatch):
    def failing_delete_review(*_args, **_kwargs):
        raise PermissionError("forbidden")

    monkeypatch.setattr(review_service, "delete_review_entry", failing_delete_review)

    with pytest.raises(HTTPException) as caught:
        review_service.delete_review_service(
            db=SimpleNamespace(),
            review_id="11",
            session_user=build_session_user(),
        )

    assert caught.value.status_code == status.HTTP_403_FORBIDDEN


def test_delete_comment_service_maps_permission_error_to_403(monkeypatch):
    def failing_delete_comment(*_args, **_kwargs):
        raise PermissionError("forbidden")

    monkeypatch.setattr(review_service, "delete_review_comment", failing_delete_comment)

    with pytest.raises(HTTPException) as caught:
        review_service.delete_comment_service(
            db=SimpleNamespace(),
            review_id="11",
            comment_id="21",
            session_user=build_session_user(),
        )

    assert caught.value.status_code == status.HTTP_403_FORBIDDEN


def test_delete_comment_service_maps_missing_comment_to_404(monkeypatch):
    def failing_delete_comment(*_args, **_kwargs):
        raise ValueError("missing")

    monkeypatch.setattr(review_service, "delete_review_comment", failing_delete_comment)

    with pytest.raises(HTTPException) as caught:
        review_service.delete_comment_service(
            db=SimpleNamespace(),
            review_id="11",
            comment_id="21",
            session_user=build_session_user(),
        )

    assert caught.value.status_code == status.HTTP_404_NOT_FOUND


def test_read_review_comments_service_maps_invalid_review_id_to_400(monkeypatch):
    def failing_get_review_comments(*_args, **_kwargs):
        raise ValueError("리뷰 ID 형식이 올바르지 않아요.")

    monkeypatch.setattr(review_service, "list_review_comments", failing_get_review_comments)

    with pytest.raises(HTTPException) as caught:
        review_service.read_review_comments_service(
            db=SimpleNamespace(),
            review_id="bad-id",
        )

    assert caught.value.status_code == status.HTTP_400_BAD_REQUEST
