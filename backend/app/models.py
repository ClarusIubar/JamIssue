"""FastAPI request and response models for JamIssue."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

CategoryType = Literal['landmark', 'food', 'cafe', 'night']
CategoryFilter = Literal['all', 'landmark', 'food', 'cafe', 'night']
CourseMood = Literal['전체', '데이트', '사진', '힐링', '비 오는 날']
ReviewMood = Literal['설렘', '친구랑', '혼자서', '야경 맛집']
ProviderKey = Literal['naver', 'kakao']
RouteSort = Literal['popular', 'latest']


class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class SessionUser(ApiModel):
    id: str
    nickname: str
    email: str | None = None
    provider: str
    profile_image: str | None = Field(default=None, alias='profileImage')
    is_admin: bool = Field(default=False, alias='isAdmin')
    profile_completed_at: str | None = Field(default=None, alias='profileCompletedAt')


class AuthProviderOut(ApiModel):
    key: ProviderKey
    label: str
    is_enabled: bool = Field(alias='isEnabled')
    login_url: str | None = Field(default=None, alias='loginUrl')


class AuthSessionResponse(ApiModel):
    is_authenticated: bool = Field(alias='isAuthenticated')
    user: SessionUser | None = None
    providers: list[AuthProviderOut] = Field(default_factory=list)


class PlaceOut(ApiModel):
    id: str
    position_id: str | None = Field(default=None, alias='positionId')
    name: str
    district: str
    category: CategoryType
    jam_color: str = Field(alias='jamColor')
    accent_color: str = Field(alias='accentColor')
    image_url: str | None = Field(default=None, alias='imageUrl')
    image_storage_path: str | None = Field(default=None, alias='imageStoragePath')
    latitude: float
    longitude: float
    summary: str
    description: str
    vibe_tags: list[str] = Field(alias='vibeTags')
    visit_time: str = Field(alias='visitTime')
    route_hint: str = Field(alias='routeHint')
    stamp_reward: str = Field(alias='stampReward')
    hero_label: str = Field(alias='heroLabel')


class CommentOut(ApiModel):
    id: str
    user_id: str = Field(alias='userId')
    author: str
    body: str
    parent_id: str | None = Field(default=None, alias='parentId')
    is_deleted: bool = Field(alias='isDeleted')
    created_at: str = Field(alias='createdAt')
    replies: list['CommentOut'] = Field(default_factory=list)


class ReviewOut(ApiModel):
    id: str
    user_id: str = Field(alias='userId')
    place_id: str = Field(alias='placeId')
    place_name: str = Field(alias='placeName')
    author: str
    body: str
    mood: ReviewMood | str
    badge: str
    visited_at: str = Field(alias='visitedAt')
    image_url: str | None = Field(default=None, alias='imageUrl')
    comment_count: int = Field(alias='commentCount')
    like_count: int = Field(default=0, alias='likeCount')
    liked_by_me: bool = Field(default=False, alias='likedByMe')
    stamp_id: str | None = Field(default=None, alias='stampId')
    visit_number: int = Field(default=1, alias='visitNumber')
    visit_label: str = Field(alias='visitLabel')
    travel_session_id: str | None = Field(default=None, alias='travelSessionId')
    comments: list[CommentOut] = Field(default_factory=list)


class ReviewLikeResponse(ApiModel):
    review_id: str = Field(alias='reviewId')
    like_count: int = Field(alias='likeCount')
    liked_by_me: bool = Field(alias='likedByMe')


class StampLogOut(ApiModel):
    id: str
    place_id: str = Field(alias='placeId')
    place_name: str = Field(alias='placeName')
    stamped_at: str = Field(alias='stampedAt')
    stamped_date: str = Field(alias='stampedDate')
    visit_number: int = Field(alias='visitNumber')
    visit_label: str = Field(alias='visitLabel')
    travel_session_id: str | None = Field(default=None, alias='travelSessionId')
    is_today: bool = Field(alias='isToday')


class TravelSessionOut(ApiModel):
    id: str
    started_at: str = Field(alias='startedAt')
    ended_at: str = Field(alias='endedAt')
    duration_label: str = Field(alias='durationLabel')
    stamp_count: int = Field(alias='stampCount')
    place_ids: list[str] = Field(alias='placeIds')
    place_names: list[str] = Field(alias='placeNames')
    can_publish: bool = Field(alias='canPublish')
    published_route_id: str | None = Field(default=None, alias='publishedRouteId')
    cover_place_id: str | None = Field(default=None, alias='coverPlaceId')


class CourseOut(ApiModel):
    id: str
    title: str
    mood: CourseMood | str
    duration: str
    note: str
    color: str
    place_ids: list[str] = Field(alias='placeIds')


class UserRouteOut(ApiModel):
    id: str
    author_id: str = Field(alias='authorId')
    author: str
    title: str
    description: str
    mood: str
    like_count: int = Field(alias='likeCount')
    liked_by_me: bool = Field(alias='likedByMe')
    created_at: str = Field(alias='createdAt')
    place_ids: list[str] = Field(alias='placeIds')
    place_names: list[str] = Field(alias='placeNames')
    is_user_generated: bool = Field(alias='isUserGenerated')
    travel_session_id: str | None = Field(default=None, alias='travelSessionId')


class UserRouteLikeResponse(ApiModel):
    route_id: str = Field(alias='routeId')
    like_count: int = Field(alias='likeCount')
    liked_by_me: bool = Field(alias='likedByMe')


class StampState(ApiModel):
    collected_place_ids: list[str] = Field(alias='collectedPlaceIds')
    logs: list[StampLogOut] = Field(default_factory=list)
    travel_sessions: list[TravelSessionOut] = Field(default_factory=list, alias='travelSessions')


class BootstrapResponse(ApiModel):
    places: list[PlaceOut]
    reviews: list[ReviewOut]
    courses: list[CourseOut]
    stamps: StampState
    has_real_data: bool = Field(alias='hasRealData')


class ReviewCreate(ApiModel):
    place_id: str = Field(alias='placeId')
    stamp_id: str = Field(alias='stampId')
    body: str
    mood: ReviewMood | str
    image_url: str | None = Field(default=None, alias='imageUrl')


class CommentCreate(ApiModel):
    body: str
    parent_id: str | None = Field(default=None, alias='parentId')


class UserRouteCreate(ApiModel):
    title: str
    description: str
    mood: str
    travel_session_id: str = Field(alias='travelSessionId')
    is_public: bool = Field(default=True, alias='isPublic')


class StampToggleRequest(ApiModel):
    place_id: str = Field(alias='placeId')
    latitude: float
    longitude: float


class ProfileUpdateRequest(ApiModel):
    nickname: str


class MyCommentOut(ApiModel):
    id: str
    review_id: str = Field(alias='reviewId')
    place_id: str = Field(alias='placeId')
    place_name: str = Field(alias='placeName')
    body: str
    is_deleted: bool = Field(alias='isDeleted')
    parent_id: str | None = Field(default=None, alias='parentId')
    created_at: str = Field(alias='createdAt')
    review_body: str = Field(alias='reviewBody')

class MyStatsOut(ApiModel):
    review_count: int = Field(alias='reviewCount')
    stamp_count: int = Field(alias='stampCount')
    unique_place_count: int = Field(alias='uniquePlaceCount')
    total_place_count: int = Field(alias='totalPlaceCount')
    route_count: int = Field(default=0, alias='routeCount')


class MyPageResponse(ApiModel):
    user: SessionUser
    stats: MyStatsOut
    reviews: list[ReviewOut]
    comments: list[MyCommentOut] = Field(default_factory=list)
    stamp_logs: list[StampLogOut] = Field(default_factory=list, alias='stampLogs')
    travel_sessions: list[TravelSessionOut] = Field(default_factory=list, alias='travelSessions')
    visited_places: list[PlaceOut] = Field(default_factory=list, alias='visitedPlaces')
    unvisited_places: list[PlaceOut] = Field(default_factory=list, alias='unvisitedPlaces')
    collected_places: list[PlaceOut] = Field(default_factory=list, alias='collectedPlaces')
    routes: list[UserRouteOut] = Field(default_factory=list)


class PlaceVisibilityUpdate(ApiModel):
    is_active: bool | None = Field(default=None, alias='isActive')
    is_manual_override: bool | None = Field(default=None, alias='isManualOverride')


class AdminPlaceOut(ApiModel):
    id: str
    name: str
    district: str
    category: CategoryType
    is_active: bool = Field(alias='isActive')
    is_manual_override: bool = Field(alias='isManualOverride')
    review_count: int = Field(alias='reviewCount')
    updated_at: str = Field(alias='updatedAt')


class AdminSummaryResponse(ApiModel):
    user_count: int = Field(alias='userCount')
    place_count: int = Field(alias='placeCount')
    review_count: int = Field(alias='reviewCount')
    comment_count: int = Field(alias='commentCount')
    stamp_count: int = Field(alias='stampCount')
    source_ready: bool = Field(alias='sourceReady')
    places: list[AdminPlaceOut]


class UploadResponse(ApiModel):
    url: str
    file_name: str = Field(alias='fileName')
    content_type: str = Field(alias='contentType')


class PublicImportResponse(ApiModel):
    imported_places: int = Field(alias='importedPlaces')
    imported_courses: int = Field(alias='importedCourses')


class HealthResponse(ApiModel):
    status: str
    env: str
    database_url: str = Field(alias='databaseUrl')
    database_provider: str = Field(alias='databaseProvider')
    storage_backend: str = Field(alias='storageBackend')
    storage_path: str = Field(alias='storagePath')
    supabase_configured: bool = Field(alias='supabaseConfigured')


CommentOut.model_rebuild()

