"""Schemas used by the public tourism data import module."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PublicDataModel(BaseModel):
    """외부 공공데이터 페이로드를 파싱하기 위한 기본 Pydantic 모델 설정 클래스입니다."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class PublicSourcePayload(PublicDataModel):
    """공공데이터 출처(소스)의 메타데이터를 나타내는 모델입니다."""

    source_key: str = Field(default="jamissue-public-bundle", alias="sourceKey")
    provider: str = "public-json"
    name: str = "JamIssue Public Tourism Bundle"
    source_url: str | None = Field(default=None, alias="sourceUrl")


class PublicPlacePayload(PublicDataModel):
    """외부에서 가져온 개별 관광 장소(Place)의 원본 데이터를 나타내는 모델입니다."""

    external_id: str | None = Field(default=None, alias="externalId")
    slug: str | None = None
    name: str
    district: str = "대전"
    category: str = "landmark"
    latitude: float | None = None
    longitude: float | None = None
    summary: str | None = ""
    description: str | None = ""
    address: str | None = None
    road_address: str | None = Field(default=None, alias="roadAddress")
    image_url: str | None = Field(default=None, alias="imageUrl")
    contact: str | None = None
    source_page_url: str | None = Field(default=None, alias="sourcePageUrl")
    source_updated_at: datetime | None = Field(default=None, alias="sourceUpdatedAt")
    vibe_tags: list[str] = Field(default_factory=list, alias="vibeTags")
    visit_time: str | None = Field(default=None, alias="visitTime")
    route_hint: str | None = Field(default=None, alias="routeHint")
    stamp_reward: str | None = Field(default=None, alias="stampReward")
    hero_label: str | None = Field(default=None, alias="heroLabel")
    jam_color: str | None = Field(default=None, alias="jamColor")
    accent_color: str | None = Field(default=None, alias="accentColor")
    is_active: bool = Field(default=True, alias="isActive")


class PublicCoursePayload(PublicDataModel):
    """관광 장소 데이터와 함께 제공되는 코스(Course) 정보 모델입니다."""

    slug: str
    title: str
    mood: str
    duration: str
    note: str
    color: str
    display_order: int = Field(default=0, alias="displayOrder")
    place_slugs: list[str] = Field(default_factory=list, alias="placeSlugs")


class PublicDataBundle(PublicDataModel):
    """
    공공 관광 데이터를 가져오기 위해 검증된 전체 묶음(번들) 모델입니다.
    소스 정보, 장소 목록, 코스 목록을 포함합니다.
    """

    source: PublicSourcePayload | None = None
    places: list[PublicPlacePayload] = Field(default_factory=list)
    courses: list[PublicCoursePayload] = Field(default_factory=list)


class NormalizedPublicPlace(PublicDataModel):
    """
    외부 데이터를 JamIssue 내부 시스템(MapPlace)에 맞게 정규화한 장소 모델입니다.
    DB 업데이트에 필요한 매핑 정보와 정규화된 페이로드를 포함합니다.
    """

    external_id: str
    map_slug: str = Field(alias="mapSlug")
    display_name: str = Field(alias="displayName")
    district: str
    category: str
    latitude: float | None = None
    longitude: float | None = None
    summary: str
    description: str
    address: str | None = None
    road_address: str | None = Field(default=None, alias="roadAddress")
    image_url: str | None = Field(default=None, alias="imageUrl")
    contact: str | None = None
    source_page_url: str | None = Field(default=None, alias="sourcePageUrl")
    source_updated_at: datetime | None = Field(default=None, alias="sourceUpdatedAt")
    is_active: bool = Field(default=True, alias="isActive")
    map_payload: dict[str, Any] | None = Field(default=None, alias="mapPayload")
    normalized_payload: dict[str, Any] = Field(alias="normalizedPayload")
