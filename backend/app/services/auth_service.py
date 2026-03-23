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
    return AuthSessionResponse(
        isAuthenticated=bool(session_user),
        user=session_user,
        providers=build_auth_providers(app_settings),
    )


def get_redirect_target(request: Request, app_settings: Settings) -> str:
    return request.session.get("post_login_redirect") or app_settings.frontend_url


def update_profile_session_payload(
    db: Session,
    user_id: str,
    payload: ProfileUpdateRequest,
    app_settings: Settings,
) -> tuple[AuthSessionResponse, str]:
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
