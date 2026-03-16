"""공공 행사 데이터의 정규화 결과 타입입니다."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass(slots=True)
class NormalizedPublicEvent:
    """배너와 행사 테이블에 바로 저장할 수 있는 정규화된 행사 레코드입니다."""

    external_id: str
    title: str
    venue_name: str | None
    district: str
    address: str | None
    road_address: str | None
    latitude: float | None
    longitude: float | None
    starts_at: datetime
    ends_at: datetime
    summary: str
    description: str
    image_url: str | None
    contact: str | None
    source_page_url: str | None
    source_updated_at: datetime | None
    normalized_payload: dict[str, Any]
