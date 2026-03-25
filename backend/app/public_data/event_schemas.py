"""공공 행사 데이터의 정규화 결과 타입입니다."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass(slots=True)
class NormalizedPublicEvent:
    """
    외부 공공 행사(축제 등) 데이터를 JamIssue 내부 데이터베이스(PublicEvent) 및 홈 배너 표시에 적합하게
    정규화한 데이터 저장용 데이터 클래스(DataClass) 모델입니다.
    """

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
