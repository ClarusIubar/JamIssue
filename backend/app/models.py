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
    """
    모든 Pydantic 모델의 기본이 되는 클래스.

    속성:
    - model_config: 필드 이름과 alias를 함께 사용하거나, ORM 모델에서 바로 변환할 수 있도록 설정.
    """
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class SessionUser(ApiModel):
    """
    현재 로그인된 사용자의 세션 정보를 나타내는 모델.

    의존성:
    - jwt_auth.py: JWT 토큰 생성 및 검증 시 페이로드로 사용됨.
    - main.py: `get_session_user`를 통해 전역적으로 주입됨.
    """
    id: str
    nickname: str
    email: str | None = None
    provider: str
    profile_image: str | None = Field(default=None, alias='profileImage')
    is_admin: bool = Field(default=False, alias='isAdmin')
    profile_completed_at: str | None = Field(default=None, alias='profileCompletedAt')


class AuthProviderOut(ApiModel):
    """
    클라이언트에게 제공되는 인증 제공자(OAuth) 정보 모델.

    속성:
    - key: 제공자 식별자 (예: 'naver', 'kakao')
    - label: UI에 표시될 이름
    - is_enabled: 해당 제공자가 현재 활성화되어 있는지 여부
    - login_url: 해당 제공자로 로그인하기 위한 URL
    """
    key: ProviderKey
    label: str
    is_enabled: bool = Field(alias='isEnabled')
    login_url: str | None = Field(default=None, alias='loginUrl')


class AuthSessionResponse(ApiModel):
    """
    클라이언트가 인증 상태를 확인할 때 반환되는 통합 세션 응답 모델.

    속성:
    - is_authenticated: 로그인 여부
    - user: 현재 로그인된 사용자 정보 (SessionUser)
    - providers: 사용 가능한 인증 제공자 목록
    """
    is_authenticated: bool = Field(alias='isAuthenticated')
    user: SessionUser | None = None
    providers: list[AuthProviderOut] = Field(default_factory=list)


class PlaceOut(ApiModel):
    """
    지도 및 장소 상세 조회 시 반환되는 장소 정보 모델.

    의존성:
    - page_service.py: 장소 목록 및 상세 데이터 조회 시 사용됨.
    - repository_normalized.py: DB 모델(`MapPlace`)에서 Pydantic 모델로 변환됨.
    """
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
    """
    피드(리뷰)에 달린 댓글 정보를 반환하는 모델.

    관계:
    - 자기 참조(replies)를 통해 대댓글(자식 댓글)을 포함할 수 있음.
    """
    id: str
    user_id: str = Field(alias='userId')
    author: str
    body: str
    parent_id: str | None = Field(default=None, alias='parentId')
    is_deleted: bool = Field(alias='isDeleted')
    created_at: str = Field(alias='createdAt')
    replies: list['CommentOut'] = Field(default_factory=list)


class ReviewOut(ApiModel):
    """
    사용자가 작성한 리뷰(피드) 정보를 반환하는 모델.

    의존성:
    - review_service.py: 리뷰 생성, 조회, 삭제 시 사용됨.

    속성:
    - visit_number: 해당 장소 방문 횟수
    - like_count: 받은 좋아요 수
    - liked_by_me: 현재 사용자가 좋아요를 눌렀는지 여부
    """
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
    """
    리뷰(피드) 좋아요 토글 결과를 반환하는 모델.
    """
    review_id: str = Field(alias='reviewId')
    like_count: int = Field(alias='likeCount')
    liked_by_me: bool = Field(alias='likedByMe')


class StampLogOut(ApiModel):
    """
    사용자의 스탬프 획득 기록을 반환하는 모델.
    """
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
    """
    사용자의 여행 세션(24시간 내 스탬프 묶음) 정보를 반환하는 모델.

    의존성:
    - page_service.py: 마이페이지 등에서 사용자 세션 이력을 보여줄 때 사용.
    """
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
    """
    운영자가 큐레이션한 코스 정보를 반환하는 모델.
    """
    id: str
    title: str
    mood: CourseMood | str
    duration: str
    note: str
    color: str
    place_ids: list[str] = Field(alias='placeIds')


class UserRouteOut(ApiModel):
    """
    사용자가 생성한 루트(커뮤니티 루트) 정보를 반환하는 모델.

    의존성:
    - route_service.py: 루트 목록 조회 및 생성 시 사용됨.
    """
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
    """
    사용자 루트 좋아요 토글 결과를 반환하는 모델.
    """
    route_id: str = Field(alias='routeId')
    like_count: int = Field(alias='likeCount')
    liked_by_me: bool = Field(alias='likedByMe')


class StampState(ApiModel):
    """
    현재 로그인한 사용자의 전체 스탬프 및 세션 상태를 반환하는 모델.

    속성:
    - collected_place_ids: 스탬프를 획득한 장소 ID 목록
    - logs: 스탬프 상세 획득 로그
    - travel_sessions: 연관된 여행 세션 목록
    """
    collected_place_ids: list[str] = Field(alias='collectedPlaceIds')
    logs: list[StampLogOut] = Field(default_factory=list)
    travel_sessions: list[TravelSessionOut] = Field(default_factory=list, alias='travelSessions')


class BootstrapResponse(ApiModel):
    """
    앱 초기 구동 시 필요한 데이터(장소, 리뷰, 코스, 스탬프 등)를 한 번에 내려주는 모델.

    의존성:
    - page_service.py: `read_bootstrap_service`에서 조립됨.
    """
    places: list[PlaceOut]
    reviews: list[ReviewOut]
    courses: list[CourseOut]
    stamps: StampState
    has_real_data: bool = Field(alias='hasRealData')


class ReviewCreate(ApiModel):
    """
    리뷰(피드) 작성 요청 데이터를 담는 모델.

    제약사항:
    - 반드시 스탬프(stamp_id)가 있어야 작성 가능함.
    """
    place_id: str = Field(alias='placeId')
    stamp_id: str = Field(alias='stampId')
    body: str
    mood: ReviewMood | str
    image_url: str | None = Field(default=None, alias='imageUrl')


class CommentCreate(ApiModel):
    """
    댓글 작성 요청 데이터를 담는 모델.

    속성:
    - parent_id: 대댓글인 경우 부모 댓글의 ID를 지정.
    """
    body: str
    parent_id: str | None = Field(default=None, alias='parentId')


class UserRouteCreate(ApiModel):
    """
    사용자 루트 생성 요청 데이터를 담는 모델.

    제약사항:
    - 반드시 특정 여행 세션(travel_session_id)을 기반으로 생성되어야 함.
    """
    title: str
    description: str
    mood: str
    travel_session_id: str = Field(alias='travelSessionId')
    is_public: bool = Field(default=True, alias='isPublic')


class StampToggleRequest(ApiModel):
    """
    스탬프 획득/취소 요청 데이터를 담는 모델.

    의존성:
    - 반경 제한 로직에 사용될 현재 사용자 위치(latitude, longitude)를 포함함.
    """
    place_id: str = Field(alias='placeId')
    latitude: float
    longitude: float


class ProfileUpdateRequest(ApiModel):
    """
    사용자 프로필 업데이트 요청 데이터를 담는 모델.
    """
    nickname: str


class MyCommentOut(ApiModel):
    """
    마이페이지에서 내가 작성한 댓글을 조회할 때 반환하는 모델.

    특징:
    - 부모 피드(리뷰)의 정보를 일부 포함함.
    """
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
    """
    마이페이지 상단에 표시될 사용자 활동 통계 모델.
    """
    review_count: int = Field(alias='reviewCount')
    stamp_count: int = Field(alias='stampCount')
    unique_place_count: int = Field(alias='uniquePlaceCount')
    total_place_count: int = Field(alias='totalPlaceCount')
    route_count: int = Field(default=0, alias='routeCount')


class MyPageResponse(ApiModel):
    """
    마이페이지 진입 시 필요한 전체 정보를 한 번에 반환하는 종합 응답 모델.
    """
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
    """
    관리자가 장소 노출 여부를 업데이트할 때 사용하는 모델.
    """
    is_active: bool | None = Field(default=None, alias='isActive')
    is_manual_override: bool | None = Field(default=None, alias='isManualOverride')


class AdminPlaceOut(ApiModel):
    """
    관리자 패널에서 장소 목록을 조회할 때 반환하는 모델.
    """
    id: str
    name: str
    district: str
    category: CategoryType
    is_active: bool = Field(alias='isActive')
    is_manual_override: bool = Field(alias='isManualOverride')
    review_count: int = Field(alias='reviewCount')
    updated_at: str = Field(alias='updatedAt')


class AdminSummaryResponse(ApiModel):
    """
    관리자 패널 대시보드의 전반적인 통계를 반환하는 모델.
    """
    user_count: int = Field(alias='userCount')
    place_count: int = Field(alias='placeCount')
    review_count: int = Field(alias='reviewCount')
    comment_count: int = Field(alias='commentCount')
    stamp_count: int = Field(alias='stampCount')
    source_ready: bool = Field(alias='sourceReady')
    places: list[AdminPlaceOut]


class UploadResponse(ApiModel):
    """
    파일(이미지) 업로드 성공 시 반환되는 모델.

    의존성:
    - storage.py 및 upload_service.py를 통해 처리됨.
    """
    url: str
    file_name: str = Field(alias='fileName')
    content_type: str = Field(alias='contentType')


class PublicImportResponse(ApiModel):
    """
    공공 데이터 가져오기 작업 후 반환되는 결과 모델.
    """
    imported_places: int = Field(alias='importedPlaces')
    imported_courses: int = Field(alias='importedCourses')


class HealthResponse(ApiModel):
    """
    서버 헬스체크 및 환경 상태를 나타내는 응답 모델.
    """
    status: str
    env: str
    database_url: str = Field(alias='databaseUrl')
    database_provider: str = Field(alias='databaseProvider')
    storage_backend: str = Field(alias='storageBackend')
    storage_path: str = Field(alias='storagePath')
    supabase_configured: bool = Field(alias='supabaseConfigured')


CommentOut.model_rebuild()

