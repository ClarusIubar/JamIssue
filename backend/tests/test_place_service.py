from types import SimpleNamespace

import pytest
from fastapi import HTTPException, status

from app.services import place_service


def test_read_place_service_maps_missing_place_to_404(monkeypatch):
    def failing_read_place(*_args, **_kwargs):
        raise ValueError("장소를 찾을 수 없어요.")

    monkeypatch.setattr(place_service, "read_place_entry", failing_read_place)

    with pytest.raises(HTTPException) as caught:
        place_service.read_place_service(SimpleNamespace(), "missing-place")

    assert caught.value.status_code == status.HTTP_404_NOT_FOUND
