"""FastAPI request and response models for JamIssue."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


CategoryType = Literal["landmark", "food", "cafe", "night"]
CategoryFilter = Literal["all", "landmark", "food", "cafe", "night"]
CourseMood = Literal["전체", "데이트", "사진", "힐링", "비 오는 날"]
ReviewMood = Literal["설렘", "친구랑", "혼자서", "야경픽"]
ProviderKey = Literal["naver", "kakao"]
RouteSort = Literal["popular", "latest"]


class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class SessionUser(ApiModel):
    id: str
    nickname: str
    email: str | None = None
    provider: str
    profile_image: str | None = Field(default=None, alias="profileImage")
    is_admin: bool = Field(default=False, alias="isAdmin")


class AuthProviderOut(ApiModel):
    key: ProviderKey
    label: str
    is_enabled: bool = Field(alias="isEnabled")
    login_url: str | None = Field(default=None, alias="loginUrl")


class AuthSessionResponse(ApiModel):
    is_authenticated: bool = Field(alias="isAuthenticated")
    user: SessionUser | None = None
    providers: list[AuthProviderOut] = []


class PlaceOut(ApiModel):
    id: str
    name: str
    district: str
    category: CategoryType
    jam_color: str = Field(alias="jamColor")
    accent_color: str = Field(alias="accentColor")
    latitude: float
    longitude: float
    summary: str
    description: str
    vibe_tags: list[str] = Field(alias="vibeTags")
    visit_time: str = Field(alias="visitTime")
    route_hint: str = Field(alias="routeHint")
    stamp_reward: str = Field(alias="stampReward")
    hero_label: str = Field(alias="heroLabel")


class CommentOut(ApiModel):
    id: str
    user_id: str = Field(alias="userId")
    author: str
    body: str
    parent_id: str | None = Field(default=None, alias="parentId")
    is_deleted: bool = Field(alias="isDeleted")
    created_at: str = Field(alias="createdAt")
    replies: list["CommentOut"] = []


class ReviewOut(ApiModel):
    id: str
    user_id: str = Field(alias="userId")
    place_id: str = Field(alias="placeId")
    place_name: str = Field(alias="placeName")
    author: str
    body: str
    mood: ReviewMood
    badge: str
    visited_at: str = Field(alias="visitedAt")
    image_url: str | None = Field(default=None, alias="imageUrl")
    comment_count: int = Field(alias="commentCount")
    like_count: int = Field(default=0, alias="likeCount")
    liked_by_me: bool = Field(default=False, alias="likedByMe")
    comments: list[CommentOut] = []


class ReviewLikeResponse(ApiModel):
    review_id: str = Field(alias="reviewId")
    like_count: int = Field(alias="likeCount")
    liked_by_me: bool = Field(alias="likedByMe")


class CourseOut(ApiModel):
    id: str
    title: str
    mood: CourseMood
    duration: str
    note: str
    color: str
    place_ids: list[str] = Field(alias="placeIds")


class UserRouteOut(ApiModel):
    id: str
    author_id: str = Field(alias="authorId")
    author: str
    title: str
    description: str
    mood: str
    like_count: int = Field(alias="likeCount")
    liked_by_me: bool = Field(alias="likedByMe")
    created_at: str = Field(alias="createdAt")
    place_ids: list[str] = Field(alias="placeIds")
    place_names: list[str] = Field(alias="placeNames")


class UserRouteLikeResponse(ApiModel):
    route_id: str = Field(alias="routeId")
    like_count: int = Field(alias="likeCount")
    liked_by_me: bool = Field(alias="likedByMe")


class StampState(ApiModel):
    collected_place_ids: list[str] = Field(alias="collectedPlaceIds")


class BootstrapResponse(ApiModel):
    places: list[PlaceOut]
    reviews: list[ReviewOut]
    courses: list[CourseOut]
    stamps: StampState
    has_real_data: bool = Field(alias="hasRealData")


class ReviewCreate(ApiModel):
    place_id: str = Field(alias="placeId")
    body: str
    mood: ReviewMood
    image_url: str | None = Field(default=None, alias="imageUrl")


class CommentCreate(ApiModel):
    body: str
    parent_id: str | None = Field(default=None, alias="parentId")


class UserRouteCreate(ApiModel):
    title: str
    description: str
    mood: str
    place_ids: list[str] = Field(alias="placeIds")
    is_public: bool = Field(default=True, alias="isPublic")


class StampToggleRequest(ApiModel):
    place_id: str = Field(alias="placeId")
    latitude: float
    longitude: float


class MyStatsOut(ApiModel):
    review_count: int = Field(alias="reviewCount")
    stamp_count: int = Field(alias="stampCount")
    route_count: int = Field(default=0, alias="routeCount")


class MyPageResponse(ApiModel):
    user: SessionUser
    stats: MyStatsOut
    reviews: list[ReviewOut]
    collected_places: list[PlaceOut] = Field(alias="collectedPlaces")
    routes: list[UserRouteOut] = []


class PlaceVisibilityUpdate(ApiModel):
    is_active: bool = Field(alias="isActive")


class AdminPlaceOut(ApiModel):
    id: str
    name: str
    district: str
    category: CategoryType
    is_active: bool = Field(alias="isActive")
    review_count: int = Field(alias="reviewCount")
    updated_at: str = Field(alias="updatedAt")


class AdminSummaryResponse(ApiModel):
    user_count: int = Field(alias="userCount")
    place_count: int = Field(alias="placeCount")
    review_count: int = Field(alias="reviewCount")
    comment_count: int = Field(alias="commentCount")
    stamp_count: int = Field(alias="stampCount")
    source_ready: bool = Field(alias="sourceReady")
    places: list[AdminPlaceOut]


class UploadResponse(ApiModel):
    url: str
    file_name: str = Field(alias="fileName")
    content_type: str = Field(alias="contentType")


class PublicImportResponse(ApiModel):
    imported_places: int = Field(alias="importedPlaces")
    imported_courses: int = Field(alias="importedCourses")


class HealthResponse(ApiModel):
    status: str
    env: str
    database_url: str = Field(alias="databaseUrl")
    database_provider: str = Field(alias="databaseProvider")
    storage_backend: str = Field(alias="storageBackend")
    storage_path: str = Field(alias="storagePath")
    supabase_configured: bool = Field(alias="supabaseConfigured")


CommentOut.model_rebuild()

