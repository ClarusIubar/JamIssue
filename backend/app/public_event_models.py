"""배너용 공공 행사 응답 모델입니다."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    """API 응답(Response) 모델을 위한 기본 설정(Pydantic Config)을 포함한 부모 클래스입니다."""

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class PublicEventBannerItem(ApiModel):
    """
    홈 화면 등의 배너 영역에 표시될 개별 공공 행사(축제 등) 정보 모델입니다.
    진행 여부(is_ongoing), 연결된 내부 장소 이름(linked_place_name) 등의 가공된 속성을 포함합니다.
    """

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
    """
    클라이언트에서 행사 배너 데이터를 그리기 위해 호출 시 반환되는 종합 응답 모델입니다.
    가져온 데이터의 출처 메타데이터 및 행사 목록(items)을 포함합니다.
    """

    source_ready: bool = Field(alias="sourceReady")
    source_name: str | None = Field(default=None, alias="sourceName")
    imported_at: str | None = Field(default=None, alias="importedAt")
    items: list[PublicEventBannerItem]
