"""공공 행사 배너 API 라우터입니다."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .config import Settings, get_settings
from .db import get_db
from .public_data.event_service import build_public_event_banner_response
from .public_event_models import PublicEventBannerResponse

router = APIRouter(tags=["banner"])


@router.get("/api/banner/events", response_model=PublicEventBannerResponse)
def read_public_event_banner(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> PublicEventBannerResponse:
    """배너 프리뷰에 들어갈 최신 공공 행사 일정 목록을 반환합니다."""

    return build_public_event_banner_response(db, settings)
