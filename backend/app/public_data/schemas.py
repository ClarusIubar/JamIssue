"""Schemas used by the public tourism data import module."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PublicDataModel(BaseModel):
    """Base Pydantic configuration for external public-data payloads."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class PublicSourcePayload(PublicDataModel):
    """Metadata that describes a public-data source."""

    source_key: str = Field(default="jamissue-public-bundle", alias="sourceKey")
    provider: str = "public-json"
    name: str = "JamIssue Public Tourism Bundle"
    source_url: str | None = Field(default=None, alias="sourceUrl")


class PublicPlacePayload(PublicDataModel):
    """Single external tourism place record."""

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
    """Course record bundled with tourism place data."""

    slug: str
    title: str
    mood: str
    duration: str
    note: str
    color: str
    display_order: int = Field(default=0, alias="displayOrder")
    place_slugs: list[str] = Field(default_factory=list, alias="placeSlugs")


class PublicDataBundle(PublicDataModel):
    """Validated import bundle for public tourism data."""

    source: PublicSourcePayload | None = None
    places: list[PublicPlacePayload] = Field(default_factory=list)
    courses: list[PublicCoursePayload] = Field(default_factory=list)


class NormalizedPublicPlace(PublicDataModel):
    """JamIssue-ready place record normalized from an external payload."""

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
