"""JamIssue FastAPI ?좏뵆由ъ??댁뀡 吏꾩엯?먯엯?덈떎."""

from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from starlette.middleware.sessions import SessionMiddleware

from .config import Settings, get_settings
from .db import Base, get_db, get_engine, get_session_factory
from .jwt_auth import ACCESS_TOKEN_COOKIE, clear_auth_cookie, read_access_token, set_auth_cookie
from .models import (
    AdminPlaceOut,
    AdminSummaryResponse,
    AuthProviderOut,
    AuthSessionResponse,
    BootstrapResponse,
    CategoryFilter,
    CommentCreate,
    CommentOut,
    CourseMood,
    CourseOut,
    HealthResponse,
    MyPageResponse,
    PlaceOut,
    PlaceVisibilityUpdate,
    ProfileUpdateRequest,
    PublicImportResponse,
    ReviewCreate,
    ReviewLikeResponse,
    ReviewOut,
    RouteSort,
    SessionUser,
    StampState,
    StampToggleRequest,
    UploadResponse,
    UserRouteCreate,
    UserRouteLikeResponse,
    UserRouteOut,
)
from .naver_oauth import build_naver_login_url, generate_oauth_state
from .public_event_api import router as public_event_router
from .repository_normalized import (
    create_comment,
    create_review,
    delete_comment,
    delete_review,
    get_bootstrap,
    get_my_page,
    get_place,
    get_review_comments,
    get_stamps,
    list_courses,
    list_places,
    list_reviews,
    toggle_review_like,
    toggle_stamp,
)
from .services.account_service import delete_my_account_service
from .seed import seed_database
from .storage import FileTooLargeError, InvalidFileTypeError, StorageConfigurationError, StorageUploadError
from .services.admin_service import import_public_data_service, patch_admin_place_service, read_admin_summary_service
from .services.auth_service import (
    PROVIDER_LABELS,
    SUPPORTED_PROVIDERS,
    build_auth_providers,
    build_auth_response,
    complete_naver_login,
    get_redirect_target,
    update_profile_session_payload,
)
from .services.page_service import (
    read_bootstrap_service,
    read_courses_service,
    read_my_page_service,
    read_place_service,
    read_places_service,
    read_reviews_service,
    read_stamps_service,
    toggle_stamp_service,
)
from .services.review_service import (
    create_comment_service,
    create_review_service,
    delete_comment_service,
    delete_review_service,
    read_review_comments_service,
    toggle_review_like_service,
)
from .services.upload_service import upload_review_image_service
from .services.route_service import (
    create_community_route_service,
    delete_community_route_service,
    read_community_routes_service,
    read_my_routes_service,
    toggle_community_route_like_service,
)

settings = get_settings()
app = FastAPI(
    title="JamIssue API",
    version="1.0.0",
    summary="??꾩쓣 ???낆뿉 怨좊Ⅴ??紐⑤컮???ы뻾 ??,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    same_site="lax",
    https_only=settings.session_https,
    max_age=60 * 60,
)

if settings.storage_backend == "local":
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    app.mount(settings.upload_base_url, StaticFiles(directory=settings.upload_path), name="uploads")

app.include_router(public_event_router)


@app.exception_handler(InvalidFileTypeError)
async def handle_invalid_file_type(_: Request, exc: InvalidFileTypeError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"detail": str(exc)})


@app.exception_handler(FileTooLargeError)
async def handle_file_too_large(_: Request, exc: FileTooLargeError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, content={"detail": str(exc)})


@app.exception_handler(StorageConfigurationError)
@app.exception_handler(StorageUploadError)
async def handle_storage_errors(_: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content={"detail": str(exc)})

PROVIDER_LABELS = {
    "naver": "?ㅼ씠踰?,
    "kakao": "移댁뭅??,
}
SUPPORTED_PROVIDERS = tuple(PROVIDER_LABELS.keys())


@app.on_event("startup")
def on_startup() -> None:
    """濡쒖뺄 媛쒕컻?섍꼍?먯꽌???낅줈???붾젆?곕━? 湲곕낯 DB瑜?以鍮꾪빀?덈떎."""

    if settings.storage_backend == "local":
        settings.upload_path.mkdir(parents=True, exist_ok=True)

    if settings.env == "worker":
        return

    Base.metadata.create_all(bind=get_engine(settings))
    with get_session_factory(settings)() as db:
        seed_database(db, settings)


def get_session_user(request: Request, app_settings: Settings = Depends(get_settings)) -> SessionUser | None:
    """
    현재 HTTP 요청에서 쿠키 혹은 헤더를 확인해 JWT 토큰을 복호화하고, 유효한 로그인 사용자(SessionUser) 객체를 반환합니다.
    토큰이 없거나 만료되었으면 None을 반환합니다.
    """
    auth_header = request.headers.get("Authorization", "")
    header_token = auth_header.removeprefix("Bearer ").strip() if auth_header.startswith("Bearer ") else None
    cookie_token = request.cookies.get(ACCESS_TOKEN_COOKIE)
    session_user = read_access_token(app_settings, header_token or cookie_token)
    if not session_user:
        return None
    return session_user.model_copy(update={"is_admin": app_settings.is_admin(session_user.id)})


def require_session_user(session_user: SessionUser | None = Depends(get_session_user)) -> SessionUser:
    """
    인증이 필수적인 엔드포인트에서 의존성(Depends)으로 사용됩니다.
    로그인되지 않은 경우 401 UNAUTHORIZED 에러를 발생시킵니다.
    """
    if not session_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="濡쒓렇?몄씠 ?꾩슂?댁슂.")
    return session_user


def require_admin_user(
    session_user: SessionUser = Depends(require_session_user),
    app_settings: Settings = Depends(get_settings),
) -> SessionUser:
    """
    관리자 권한이 필수적인 엔드포인트에서 의존성으로 사용됩니다.
    일반 사용자일 경우 403 FORBIDDEN 에러를 발생시킵니다.
    """
    if not app_settings.is_admin(session_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="愿由ъ옄 沅뚰븳???꾩슂?댁슂.")
    return session_user.model_copy(update={"is_admin": True})


def build_auth_response(session_user: SessionUser | None, app_settings: Settings) -> AuthSessionResponse:
    return AuthSessionResponse(
        isAuthenticated=bool(session_user),
        user=session_user,
        providers=build_auth_providers(app_settings),
    )


def get_redirect_target(request: Request, app_settings: Settings) -> str:
    return request.session.get("post_login_redirect") or app_settings.frontend_url


@app.get("/api/health", response_model=HealthResponse, tags=["system"])
def health_check(app_settings: Settings = Depends(get_settings)) -> HealthResponse:
    """서버가 정상적으로 구동되고 있는지 확인하고, 주요 환경 설정 상태를 반환합니다."""
    return HealthResponse(
        status="ok",
        env=app_settings.env,
        databaseUrl=app_settings.database_display_url,
        databaseProvider=app_settings.database_provider,
        storageBackend=app_settings.storage_provider,
        storagePath=app_settings.storage_target_label,
        supabaseConfigured=app_settings.supabase_configured,
    )


@app.get("/api/auth/providers", response_model=list[AuthProviderOut], tags=["auth"])
def read_auth_providers(app_settings: Settings = Depends(get_settings)) -> list[AuthProviderOut]:
    """사용 가능한 소셜 로그인 제공자 목록을 반환합니다."""
    return build_auth_providers(app_settings)


@app.get("/api/auth/me", response_model=AuthSessionResponse, tags=["auth"])
def read_auth_session(
    session_user: SessionUser | None = Depends(get_session_user),
    app_settings: Settings = Depends(get_settings),
) -> AuthSessionResponse:
    """클라이언트가 현재 로그인 상태를 확인할 수 있도록 세션 정보를 반환합니다."""
    return build_auth_response(session_user, app_settings)


@app.patch("/api/auth/profile", response_model=AuthSessionResponse, tags=["auth"])
def patch_auth_profile(
    payload: ProfileUpdateRequest,
    response: Response,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
    app_settings: Settings = Depends(get_settings),
) -> AuthSessionResponse:
    auth_response, access_token = update_profile_session_payload(db, session_user.id, payload, app_settings)
    set_auth_cookie(response, app_settings, access_token)
    return auth_response


@app.get("/api/auth/{provider}/login", tags=["auth"])
def start_login(
    provider: str,
    request: Request,
    next: str | None = None,
    app_settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    """
    선택한 OAuth 제공자(예: naver)의 로그인 페이지로 사용자를 리다이렉트합니다.
    """
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="吏?먰븯吏 ?딅뒗 濡쒓렇???쒓났?먯삁??")

    request.session["post_login_redirect"] = next or app_settings.frontend_url
    request.session.pop("oauth_link_user_id", None)
    request.session.pop("oauth_link_provider", None)

    if provider != "naver":
        if not app_settings.provider_enabled(provider):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"{PROVIDER_LABELS[provider]} 濡쒓렇???ㅼ젙??鍮꾩뼱 ?덉뼱??",
            )
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"{PROVIDER_LABELS[provider]} 濡쒓렇???곌껐? ?섍꼍 蹂?섎쭔 以鍮꾨맂 ?곹깭?덉슂.",
        )

    state = generate_oauth_state()
    request.session["naver_oauth_state"] = state
    return RedirectResponse(build_naver_login_url(app_settings, state), status_code=status.HTTP_302_FOUND)


@app.get("/api/auth/{provider}/link", tags=["auth"])
def start_link_login(
    provider: str,
    request: Request,
    next: str | None = None,
    session_user: SessionUser = Depends(require_session_user),
    app_settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    """
    현재 로그인된 계정에 새로운 외부 소셜 로그인을 추가 연동하기 위한 승인 페이지로 리다이렉트합니다.
    """
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="吏?먰븯吏 ?딅뒗 濡쒓렇???쒓났?먯삁??")

    request.session["post_login_redirect"] = next or app_settings.frontend_url
    request.session["oauth_link_user_id"] = session_user.id
    request.session["oauth_link_provider"] = provider

    if provider != "naver":
        if not app_settings.provider_enabled(provider):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"{PROVIDER_LABELS[provider]} 濡쒓렇???ㅼ젙??鍮꾩뼱 ?덉뼱??",
            )
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"{PROVIDER_LABELS[provider]} 怨꾩젙 ?곌껐? ?섍꼍 蹂?섎쭔 以鍮꾨맂 ?곹깭?덉슂.",
        )

    state = generate_oauth_state()
    request.session["naver_oauth_state"] = state
    return RedirectResponse(build_naver_login_url(app_settings, state), status_code=status.HTTP_302_FOUND)


@app.get("/api/auth/naver/callback", tags=["auth"])
def finish_naver_login(
    request: Request,
    db: Session = Depends(get_db),
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    app_settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    """네이버 로그인 콜백 엔드포인트입니다. 토큰을 발급받아 쿠키에 굽고 앱으로 돌려보냅니다."""
    response, access_token = complete_naver_login(
        request,
        db,
        code=code,
        state=state,
        error=error,
        error_description=error_description,
        app_settings=app_settings,
    )
    if access_token:
        set_auth_cookie(response, app_settings, access_token)
    return response


@app.post("/api/auth/logout", response_model=AuthSessionResponse, tags=["auth"])
def logout(
    response: Response,
    app_settings: Settings = Depends(get_settings),
) -> AuthSessionResponse:
    """클라이언트 쿠키를 삭제하여 로그아웃 처리합니다."""
    clear_auth_cookie(response)
    return build_auth_response(None, app_settings)


@app.get("/api/bootstrap", response_model=BootstrapResponse, tags=["bootstrap"])
def bootstrap(
    db: Session = Depends(get_db),
    session_user: SessionUser | None = Depends(get_session_user),
) -> BootstrapResponse:
    """앱 최초 구동에 필요한 모든 기초 데이터(장소, 후기, 코스, 스탬프 등)를 반환합니다."""
    return read_bootstrap_service(db, session_user)


@app.get("/api/places", response_model=list[PlaceOut], tags=["places"])
def read_places(
    category: CategoryFilter = Query(default="all"),
    db: Session = Depends(get_db),
) -> list[PlaceOut]:
    """카테고리 필터가 적용된 전체 장소 목록을 반환합니다."""
    return read_places_service(db, category)


@app.get("/api/places/{place_id}", response_model=PlaceOut, tags=["places"])
def read_place(place_id: str, db: Session = Depends(get_db)) -> PlaceOut:
    return read_place_service(db, place_id)

@app.get("/api/courses", response_model=list[CourseOut], tags=["courses"])
def read_courses(
    mood: CourseMood | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[CourseOut]:
    """운영자가 큐레이션한 코스 목록을 반환합니다."""
    return read_courses_service(db, mood)


@app.get("/api/community-routes", response_model=list[UserRouteOut], tags=["community-routes"])
def read_community_routes(
    sort: RouteSort = Query(default="popular"),
    db: Session = Depends(get_db),
    session_user: SessionUser | None = Depends(get_session_user),
) -> list[UserRouteOut]:
    """다른 사용자들이 만든 공개 루트(코스) 목록을 조회합니다."""
    return read_community_routes_service(db, sort, session_user)


@app.post("/api/community-routes", response_model=UserRouteOut, status_code=status.HTTP_201_CREATED, tags=["community-routes"])
def write_community_route(
    payload: UserRouteCreate,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
) -> UserRouteOut:
    return create_community_route_service(db, payload, session_user)


@app.post("/api/community-routes/{route_id}/like", response_model=UserRouteLikeResponse, tags=["community-routes"])
def like_community_route(
    route_id: str,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
) -> UserRouteLikeResponse:
    return toggle_community_route_like_service(db, route_id, session_user)


@app.delete("/api/community-routes/{route_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["community-routes"])
def remove_community_route(
    route_id: str,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
) -> Response:
    delete_community_route_service(db, route_id, session_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/my/routes", response_model=list[UserRouteOut], tags=["my"])
def read_my_routes(
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
) -> list[UserRouteOut]:
    return read_my_routes_service(db, session_user)


@app.get("/api/reviews", response_model=list[ReviewOut], tags=["reviews"])
def read_reviews(
    place_id: str | None = Query(default=None, alias="placeId"),
    user_id: str | None = Query(default=None, alias="userId"),
    db: Session = Depends(get_db),
    session_user: SessionUser | None = Depends(get_session_user),
) -> list[ReviewOut]:
    """선택한 장소 혹은 특정 사용자의 리뷰(피드) 목록을 조회합니다."""
    return read_reviews_service(db, place_id, user_id, session_user)


@app.post("/api/reviews", response_model=ReviewOut, status_code=status.HTTP_201_CREATED, tags=["reviews"])
def write_review(
    payload: ReviewCreate,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
) -> ReviewOut:
    """스탬프 획득을 증명하여 새 리뷰를 작성합니다."""
    return create_review_service(db, payload, session_user)

@app.delete("/api/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["reviews"])
def remove_review(
    review_id: str,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
) -> Response:
    """사용자가 자신이 작성한 피드(리뷰)를 삭제합니다."""
    delete_review_service(db, review_id, session_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.post("/api/reviews/{review_id}/like", response_model=ReviewLikeResponse, tags=["reviews"])
def like_review(
    review_id: str,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
) -> ReviewLikeResponse:
    return toggle_review_like_service(db, review_id, session_user)

@app.get("/api/reviews/{review_id}/comments", response_model=list[CommentOut], tags=["reviews"])
def read_review_comments(review_id: str, db: Session = Depends(get_db)) -> list[CommentOut]:
    """특정 리뷰에 달린 모든 댓글 목록(트리 구조)을 조회합니다."""
    return read_review_comments_service(db, review_id)

@app.post("/api/reviews/{review_id}/comments", response_model=list[CommentOut], tags=["reviews"])
def write_review_comment(
    review_id: str,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
) -> list[CommentOut]:
    """특정 리뷰에 새로운 댓글이나 대댓글을 작성합니다."""
    return create_comment_service(db, review_id, payload, session_user)

@app.delete("/api/reviews/{review_id}/comments/{comment_id}", response_model=list[CommentOut], tags=["reviews"])
def remove_review_comment(
    review_id: str,
    comment_id: str,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
) -> list[CommentOut]:
    """사용자가 자신이 작성한 댓글을 삭제(소프트 삭제)합니다."""
    return delete_comment_service(db, review_id, comment_id, session_user)

@app.post("/api/reviews/upload", response_model=UploadResponse, tags=["reviews"])
async def upload_review_image(
    file: UploadFile = File(...),
    session_user: SessionUser = Depends(require_session_user),
    app_settings: Settings = Depends(get_settings),
) -> UploadResponse:
    """리뷰에 첨부할 이미지를 스토리지에 업로드하고 외부 접근 가능 URL을 반환합니다."""
    return await upload_review_image_service(file, session_user, app_settings)


@app.get("/api/my/summary", response_model=MyPageResponse, tags=["my"])
def read_my_summary(
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
    app_settings: Settings = Depends(get_settings),
) -> MyPageResponse:
    """마이페이지에 표시할 사용자 통계, 스탬프 로그, 피드 내역 등을 반환합니다."""
    return read_my_page_service(db, session_user, app_settings)

@app.delete("/api/my/account", status_code=status.HTTP_204_NO_CONTENT, tags=["my"])
def remove_my_account(
    response: Response,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
) -> Response:
    """사용자의 계정을 삭제(탈퇴) 처리하고 연관 데이터를 모두 정리합니다."""
    delete_my_account_service(db, session_user.id)
    clear_auth_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@app.get("/api/stamps", response_model=StampState, tags=["stamps"])
def read_stamps(
    db: Session = Depends(get_db),
    session_user: SessionUser | None = Depends(get_session_user),
) -> StampState:
    """현재 사용자가 모은 전체 스탬프 정보(여행 세션 포함)를 반환합니다."""
    return read_stamps_service(db, session_user)


@app.post("/api/stamps/toggle", response_model=StampState, tags=["stamps"])
def write_stamp_toggle(
    payload: StampToggleRequest,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
    app_settings: Settings = Depends(get_settings),
) -> StampState:
    """사용자의 현재 GPS 좌표를 바탕으로 장소의 반경 안에 있을 경우 스탬프를 적립합니다."""
    return toggle_stamp_service(db, payload, session_user, app_settings)

@app.get("/api/admin/summary", response_model=AdminSummaryResponse, tags=["admin"])
def read_admin_summary(
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
    app_settings: Settings = Depends(get_settings),
) -> AdminSummaryResponse:
    """관리자 대시보드 화면용 운영 지표 요약 및 장소 목록을 반환합니다."""
    return read_admin_summary_service(db, app_settings)


@app.patch("/api/admin/places/{place_id}", response_model=AdminPlaceOut, tags=["admin"])
def patch_place_visibility(
    place_id: str,
    payload: PlaceVisibilityUpdate,
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> AdminPlaceOut:
    """관리자가 특정 장소의 노출(is_active) 상태 등을 변경합니다."""
    return patch_admin_place_service(db, place_id, payload)


@app.post("/api/admin/import/public-data", response_model=PublicImportResponse, tags=["admin"])
def import_public_data(
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
    app_settings: Settings = Depends(get_settings),
) -> PublicImportResponse:
    """관리자가 공공데이터 소스를 수동으로 동기화(Import)하도록 요청합니다."""
    return import_public_data_service(db, app_settings)

