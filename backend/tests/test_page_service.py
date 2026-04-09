from types import SimpleNamespace

import pytest
from fastapi import HTTPException, status

from app.config import Settings
from app.models import SessionUser, StampToggleRequest
from app.services import page_service


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


def test_read_place_service_maps_missing_place_to_404(monkeypatch):
    def failing_read_place(*_args, **_kwargs):
        raise ValueError("장소를 찾을 수 없어요.")

    monkeypatch.setattr(page_service, "read_place_entry", failing_read_place)

    with pytest.raises(HTTPException) as caught:
        page_service.read_place_service(SimpleNamespace(), "missing-place")

    assert caught.value.status_code == status.HTTP_404_NOT_FOUND


def test_read_my_page_service_maps_missing_user_to_404(monkeypatch):
    def failing_read_my_page(*_args, **_kwargs):
        raise ValueError("사용자를 찾을 수 없어요.")

    monkeypatch.setattr(page_service, "read_my_page_entry", failing_read_my_page)

    with pytest.raises(HTTPException) as caught:
        page_service.read_my_page_service(SimpleNamespace(), build_session_user(), Settings())

    assert caught.value.status_code == status.HTTP_404_NOT_FOUND


def test_toggle_stamp_service_maps_permission_error_to_403(monkeypatch):
    def failing_toggle_stamp(*_args, **_kwargs):
        raise PermissionError("forbidden")

    monkeypatch.setattr(page_service, "toggle_stamp_entry", failing_toggle_stamp)

    with pytest.raises(HTTPException) as caught:
        page_service.toggle_stamp_service(
            SimpleNamespace(),
            StampToggleRequest(placeId="place-1", latitude=36.35, longitude=127.38),
            build_session_user(),
            Settings(stamp_unlock_radius_meters=120),
        )

    assert caught.value.status_code == status.HTTP_403_FORBIDDEN


def test_toggle_stamp_service_maps_missing_place_to_404(monkeypatch):
    def failing_toggle_stamp(*_args, **_kwargs):
        raise ValueError("장소를 찾을 수 없어요.")

    monkeypatch.setattr(page_service, "toggle_stamp_entry", failing_toggle_stamp)

    with pytest.raises(HTTPException) as caught:
        page_service.toggle_stamp_service(
            SimpleNamespace(),
            StampToggleRequest(placeId="missing-place", latitude=36.35, longitude=127.38),
            build_session_user(),
            Settings(stamp_unlock_radius_meters=120),
        )

    assert caught.value.status_code == status.HTTP_404_NOT_FOUND
