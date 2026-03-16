"""배너용 공공 행사 응답 모델입니다."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    """API 응답 모델 공통 설정입니다."""

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class PublicEventBannerItem(ApiModel):
    """배너 카드에 들어가는 단일 행사 일정입니다."""

    id: str
    title: str
    venue_name: str | None = Field(default=None, alias="venueName")
    district: str
    start_date: str = Field(alias="startDate")
    end_date: str = Field(alias="endDate")
    date_label: str = Field(alias="dateLabel")
    summary: str
    source_page_url: str | None = Field(default=None, alias="sourcePageUrl")
    linked_place_name: str | None = Field(default=None, alias="linkedPlaceName")
    is_ongoing: bool = Field(alias="isOngoing")


class PublicEventBannerResponse(ApiModel):
    """배너 프리뷰가 읽는 행사 일정 목록 응답입니다."""

    source_ready: bool = Field(alias="sourceReady")
    source_name: str | None = Field(default=None, alias="sourceName")
    imported_at: str | None = Field(default=None, alias="importedAt")
    items: list[PublicEventBannerItem]
