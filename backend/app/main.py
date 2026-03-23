"""JamIssue FastAPI 애플리케이션 진입점입니다."""

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
    delete_account,
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
from .services.upload_service import upload_review_image_service
from .user_routes_normalized import (
    create_user_route,
    delete_user_route,
    list_public_user_routes,
    list_user_routes_for_owner,
    toggle_user_route_like,
)

settings = get_settings()
app = FastAPI(
    title="JamIssue API",
    version="1.0.0",
    summary="대전을 한 입에 고르는 모바일 여행 앱",
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
    "naver": "네이버",
    "kakao": "카카오",
}
SUPPORTED_PROVIDERS = tuple(PROVIDER_LABELS.keys())


@app.on_event("startup")
def on_startup() -> None:
    """로컬 개발환경에서는 업로드 디렉터리와 기본 DB를 준비합니다."""

    if settings.storage_backend == "local":
        settings.upload_path.mkdir(parents=True, exist_ok=True)

    if settings.env == "worker":
        return

    Base.metadata.create_all(bind=get_engine(settings))
    with get_session_factory(settings)() as db:
        seed_database(db, settings)


def get_session_user(request: Request, app_settings: Settings = Depends(get_settings)) -> SessionUser | None:
    auth_header = request.headers.get("Authorization", "")
    header_token = auth_header.removeprefix("Bearer ").strip() if auth_header.startswith("Bearer ") else None
    cookie_token = request.cookies.get(ACCESS_TOKEN_COOKIE)
    session_user = read_access_token(app_settings, header_token or cookie_token)
    if not session_user:
        return None
    return session_user.model_copy(update={"is_admin": app_settings.is_admin(session_user.id)})


def require_session_user(session_user: SessionUser | None = Depends(get_session_user)) -> SessionUser:
    if not session_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="로그인이 필요해요.")
    return session_user


def require_admin_user(
    session_user: SessionUser = Depends(require_session_user),
    app_settings: Settings = Depends(get_settings),
) -> SessionUser:
    if not app_settings.is_admin(session_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="관리자 권한이 필요해요.")
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
    return build_auth_providers(app_settings)


@app.get("/api/auth/me", response_model=AuthSessionResponse, tags=["auth"])
def read_auth_session(
    session_user: SessionUser | None = Depends(get_session_user),
    app_settings: Settings = Depends(get_settings),
) -> AuthSessionResponse:
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
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지원하지 않는 로그인 제공자예요.")

    request.session["post_login_redirect"] = next or app_settings.frontend_url
    request.session.pop("oauth_link_user_id", None)
    request.session.pop("oauth_link_provider", None)

    if provider != "naver":
        if not app_settings.provider_enabled(provider):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"{PROVIDER_LABELS[provider]} 로그인 설정이 비어 있어요.",
            )
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"{PROVIDER_LABELS[provider]} 로그인 연결은 환경 변수만 준비된 상태예요.",
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
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지원하지 않는 로그인 제공자예요.")

    request.session["post_login_redirect"] = next or app_settings.frontend_url
    request.session["oauth_link_user_id"] = session_user.id
    request.session["oauth_link_provider"] = provider

    if provider != "naver":
        if not app_settings.provider_enabled(provider):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"{PROVIDER_LABELS[provider]} 로그인 설정이 비어 있어요.",
            )
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"{PROVIDER_LABELS[provider]} 계정 연결은 환경 변수만 준비된 상태예요.",
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
    clear_auth_cookie(response)
    return build_auth_response(None, app_settings)


@app.get("/api/bootstrap", response_model=BootstrapResponse, tags=["bootstrap"])
def bootstrap(
    db: Session = Depends(get_db),
    session_user: SessionUser | None = Depends(get_session_user),
) -> BootstrapResponse:
    return get_bootstrap(db, session_user.id if session_user else None)


@app.get("/api/places", response_model=list[PlaceOut], tags=["places"])
def read_places(
    category: CategoryFilter = Query(default="all"),
    db: Session = Depends(get_db),
) -> list[PlaceOut]:
    return list_places(db, category)


@app.get("/api/places/{place_id}", response_model=PlaceOut, tags=["places"])
def read_place(place_id: str, db: Session = Depends(get_db)) -> PlaceOut:
    try:
        return get_place(db, place_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@app.get("/api/courses", response_model=list[CourseOut], tags=["courses"])
def read_courses(
    mood: CourseMood | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[CourseOut]:
    return list_courses(db, mood)


@app.get("/api/community-routes", response_model=list[UserRouteOut], tags=["community-routes"])
def read_community_routes(
    sort: RouteSort = Query(default="popular"),
    db: Session = Depends(get_db),
    session_user: SessionUser | None = Depends(get_session_user),
) -> list[UserRouteOut]:
    return list_public_user_routes(db, sort, session_user.id if session_user else None)


@app.post("/api/community-routes", response_model=UserRouteOut, status_code=status.HTTP_201_CREATED, tags=["community-routes"])
def write_community_route(
    payload: UserRouteCreate,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
) -> UserRouteOut:
    try:
        return create_user_route(db, payload, session_user.id, session_user.nickname)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@app.post("/api/community-routes/{route_id}/like", response_model=UserRouteLikeResponse, tags=["community-routes"])
def like_community_route(
    route_id: str,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
) -> UserRouteLikeResponse:
    try:
        return toggle_user_route_like(db, route_id, session_user.id, session_user.nickname)
    except ValueError as error:
        detail = str(error)
        status_code = status.HTTP_400_BAD_REQUEST
        if "찾지 못" in detail:
            status_code = status.HTTP_404_NOT_FOUND
        raise HTTPException(status_code=status_code, detail=detail) from error


@app.delete("/api/community-routes/{route_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["community-routes"])
def remove_community_route(
    route_id: str,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
) -> Response:
    try:
        delete_user_route(db, route_id, session_user.id, is_admin=session_user.is_admin)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/my/routes", response_model=list[UserRouteOut], tags=["my"])
def read_my_routes(
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
) -> list[UserRouteOut]:
    return list_user_routes_for_owner(db, session_user.id)


@app.get("/api/reviews", response_model=list[ReviewOut], tags=["reviews"])
def read_reviews(
    place_id: str | None = Query(default=None, alias="placeId"),
    user_id: str | None = Query(default=None, alias="userId"),
    db: Session = Depends(get_db),
    session_user: SessionUser | None = Depends(get_session_user),
) -> list[ReviewOut]:
    return list_reviews(db, place_id=place_id, user_id=user_id, current_user_id=session_user.id if session_user else None)


@app.post("/api/reviews", response_model=ReviewOut, status_code=status.HTTP_201_CREATED, tags=["reviews"])
def write_review(
    payload: ReviewCreate,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
) -> ReviewOut:
    try:
        return create_review(db, payload, session_user.id, session_user.nickname)
    except ValueError as error:
        detail = str(error)
        status_code = status.HTTP_400_BAD_REQUEST
        if "장소" in detail:
            status_code = status.HTTP_404_NOT_FOUND
        raise HTTPException(status_code=status_code, detail=detail) from error


@app.delete("/api/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["reviews"])
def remove_review(
    review_id: str,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
) -> Response:
    try:
        delete_review(db, review_id, session_user.id, is_admin=session_user.is_admin)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/api/reviews/{review_id}/like", response_model=ReviewLikeResponse, tags=["reviews"])
def like_review(
    review_id: str,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
) -> ReviewLikeResponse:
    try:
        return toggle_review_like(db, review_id, session_user.id, session_user.nickname)
    except ValueError as error:
        detail = str(error)
        status_code = status.HTTP_400_BAD_REQUEST
        if "찾지 못" in detail:
            status_code = status.HTTP_404_NOT_FOUND
        raise HTTPException(status_code=status_code, detail=detail) from error


@app.get("/api/reviews/{review_id}/comments", response_model=list[CommentOut], tags=["reviews"])
def read_review_comments(review_id: str, db: Session = Depends(get_db)) -> list[CommentOut]:
    try:
        return get_review_comments(db, review_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@app.post("/api/reviews/{review_id}/comments", response_model=list[CommentOut], tags=["reviews"])
def write_review_comment(
    review_id: str,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
) -> list[CommentOut]:
    try:
        return create_comment(db, review_id, payload, session_user.id, session_user.nickname)
    except ValueError as error:
        detail = str(error)
        status_code = status.HTTP_400_BAD_REQUEST
        if "후기" in detail:
            status_code = status.HTTP_404_NOT_FOUND
        raise HTTPException(status_code=status_code, detail=detail) from error


@app.delete("/api/reviews/{review_id}/comments/{comment_id}", response_model=list[CommentOut], tags=["reviews"])
def remove_review_comment(
    review_id: str,
    comment_id: str,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
) -> list[CommentOut]:
    try:
        return delete_comment(db, review_id, comment_id, session_user.id, is_admin=session_user.is_admin)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error


@app.post("/api/reviews/upload", response_model=UploadResponse, tags=["reviews"])
async def upload_review_image(
    file: UploadFile = File(...),
    session_user: SessionUser = Depends(require_session_user),
    app_settings: Settings = Depends(get_settings),
) -> UploadResponse:
    return await upload_review_image_service(file, session_user, app_settings)


@app.get("/api/my/summary", response_model=MyPageResponse, tags=["my"])
def read_my_summary(
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
    app_settings: Settings = Depends(get_settings),
) -> MyPageResponse:
    try:
        return get_my_page(db, session_user.id, app_settings.is_admin(session_user.id))
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@app.delete("/api/my/account", status_code=status.HTTP_204_NO_CONTENT, tags=["my"])
def remove_my_account(
    response: Response,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
) -> Response:
    try:
        delete_account(db, session_user.id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    clear_auth_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@app.get("/api/stamps", response_model=StampState, tags=["stamps"])
def read_stamps(
    db: Session = Depends(get_db),
    session_user: SessionUser | None = Depends(get_session_user),
) -> StampState:
    return get_stamps(db, session_user.id if session_user else None)


@app.post("/api/stamps/toggle", response_model=StampState, tags=["stamps"])
def write_stamp_toggle(
    payload: StampToggleRequest,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(require_session_user),
    app_settings: Settings = Depends(get_settings),
) -> StampState:
    try:
        return toggle_stamp(
            db,
            session_user.id,
            payload.place_id,
            payload.latitude,
            payload.longitude,
            app_settings.stamp_unlock_radius_meters,
        )
    except PermissionError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@app.get("/api/admin/summary", response_model=AdminSummaryResponse, tags=["admin"])
def read_admin_summary(
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
    app_settings: Settings = Depends(get_settings),
) -> AdminSummaryResponse:
    return read_admin_summary_service(db, app_settings)


@app.patch("/api/admin/places/{place_id}", response_model=AdminPlaceOut, tags=["admin"])
def patch_place_visibility(
    place_id: str,
    payload: PlaceVisibilityUpdate,
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> AdminPlaceOut:
    return patch_admin_place_service(db, place_id, payload)


@app.post("/api/admin/import/public-data", response_model=PublicImportResponse, tags=["admin"])
def import_public_data(
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
    app_settings: Settings = Depends(get_settings),
) -> PublicImportResponse:
    return import_public_data_service(db, app_settings)

