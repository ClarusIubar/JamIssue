from fastapi import HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from starlette.requests import Request

from ..config import Settings
from ..jwt_auth import issue_access_token
from ..models import AuthProviderOut, AuthSessionResponse, ProfileUpdateRequest, SessionUser
from ..naver_oauth import build_redirect_url, exchange_code_for_token, fetch_naver_profile
from ..repository_normalized import link_naver_identity, to_session_user, update_user_profile, upsert_naver_user

PROVIDER_LABELS = {
    "naver": "네이버",
    "kakao": "카카오",
}
SUPPORTED_PROVIDERS = tuple(PROVIDER_LABELS.keys())


def build_auth_providers(app_settings: Settings) -> list[AuthProviderOut]:
    """
    설정에 따라 사용 가능한 소셜 인증 제공자 목록(AuthProviderOut)을 구성하여 반환합니다.
    """
    providers: list[AuthProviderOut] = []
    for provider in SUPPORTED_PROVIDERS:
        providers.append(
            AuthProviderOut(
                key=provider,
                label=PROVIDER_LABELS[provider],
                isEnabled=app_settings.provider_enabled(provider),
                loginUrl=f"/api/auth/{provider}/login",
            )
        )
    return providers


def build_auth_response(session_user: SessionUser | None, app_settings: Settings) -> AuthSessionResponse:
    """
    현재 세션의 인증 상태와 사용자 정보, 사용 가능한 인증 제공자를 묶어 AuthSessionResponse로 반환합니다.
    """
    return AuthSessionResponse(
        isAuthenticated=bool(session_user),
        user=session_user,
        providers=build_auth_providers(app_settings),
    )


def get_redirect_target(request: Request, app_settings: Settings) -> str:
    """
    로그인 완료 후 돌아갈 대상 URL을 세션에서 찾아 반환합니다. 없으면 기본 프론트엔드 URL을 사용합니다.
    """
    return request.session.get("post_login_redirect") or app_settings.frontend_url


def update_profile_session_payload(
    db: Session,
    user_id: str,
    payload: ProfileUpdateRequest,
    app_settings: Settings,
) -> tuple[AuthSessionResponse, str]:
    """
    사용자의 프로필(닉네임 등)을 업데이트하고, 변경된 정보를 바탕으로 새 JWT 액세스 토큰과 응답 객체를 발급합니다.

    의존성:
    - repository_normalized.update_user_profile 호출
    - jwt_auth.issue_access_token 호출
    """
    try:
        user = update_user_profile(db, user_id, payload)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error

    next_session_user = to_session_user(user, app_settings.is_admin(user.user_id), provider=user.provider)
    access_token = issue_access_token(app_settings, next_session_user)
    return build_auth_response(next_session_user, app_settings), access_token


def complete_naver_login(
    request: Request,
    db: Session,
    *,
    code: str | None,
    state: str | None,
    error: str | None,
    error_description: str | None,
    app_settings: Settings,
) -> tuple[RedirectResponse, str | None]:
    """
    네이버 로그인 콜백을 처리합니다.
    토큰 교환 및 프로필 조회를 수행한 후, 새 계정을 생성하거나 기존 계정과 연결하고,
    완료 시 발급된 액세스 토큰 및 클라이언트로의 리다이렉트 응답을 반환합니다.

    의존성:
    - naver_oauth.py: 토큰 교환 및 프로필 조회 함수 사용
    - repository_normalized.py: upsert_naver_user, link_naver_identity 사용
    """
    redirect_target = get_redirect_target(request, app_settings)
    expected_state = request.session.pop("naver_oauth_state", None)
    link_user_id = request.session.pop("oauth_link_user_id", None)
    link_provider = request.session.pop("oauth_link_provider", None)

    if error:
        return (
            RedirectResponse(
                build_redirect_url(redirect_target, auth="naver-error", reason=error_description or error),
                status_code=status.HTTP_302_FOUND,
            ),
            None,
        )

    if not code or not state or state != expected_state:
        return (
            RedirectResponse(
                build_redirect_url(redirect_target, auth="naver-error", reason="state-mismatch"),
                status_code=status.HTTP_302_FOUND,
            ),
            None,
        )

    try:
        token_payload = exchange_code_for_token(app_settings, code, state)
        profile = fetch_naver_profile(token_payload["access_token"])
        if link_user_id and link_provider == "naver":
            user = link_naver_identity(db, link_user_id, profile)
            success_code = "naver-linked"
        else:
            user = upsert_naver_user(db, profile)
            success_code = "naver-success"
    except (HTTPException, ValueError) as oauth_error:
        detail = oauth_error.detail if isinstance(oauth_error, HTTPException) else str(oauth_error)
        return (
            RedirectResponse(
                build_redirect_url(redirect_target, auth="naver-error", reason=detail),
                status_code=status.HTTP_302_FOUND,
            ),
            None,
        )

    session_user = to_session_user(
        user,
        app_settings.is_admin(user.user_id),
        profile.profile_image,
        provider="naver",
    )
    access_token = issue_access_token(app_settings, session_user)
    response = RedirectResponse(
        build_redirect_url(redirect_target, auth=success_code),
        status_code=status.HTTP_302_FOUND,
    )
    return response, access_token
