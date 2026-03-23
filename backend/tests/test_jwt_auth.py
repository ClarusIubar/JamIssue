from app.config import Settings
from app.jwt_auth import auth_cookie_settings, issue_access_token, read_access_token
from app.models import SessionUser


def test_issue_and_read_access_token_round_trip():
    settings = Settings(jwt_secret='unit-test-secret', jwt_access_token_minutes=10)
    user = SessionUser(
        id='user-tester',
        nickname='테스터',
        email='tester@example.com',
        provider='naver',
        profileImage='https://example.com/avatar.png',
        isAdmin=True,
    )

    token = issue_access_token(settings, user)
    restored = read_access_token(settings, token)

    assert restored is not None
    assert restored.id == user.id
    assert restored.nickname == user.nickname
    assert restored.is_admin is True


def test_expired_access_token_returns_none():
    settings = Settings(jwt_secret='unit-test-secret', jwt_access_token_minutes=-1)
    user = SessionUser(
        id='user-expired',
        nickname='만료테스트',
        email='expired@example.com',
        provider='naver',
    )

    token = issue_access_token(settings, user)

    assert read_access_token(settings, token) is None


def test_auth_cookie_settings_share_jwt_expiration_window():
    settings = Settings(jwt_secret='unit-test-secret', jwt_access_token_minutes=10, env='production')

    cookie_settings = auth_cookie_settings(settings)

    assert cookie_settings['max_age'] == settings.access_token_max_age_seconds
    assert cookie_settings['secure'] is True
    assert cookie_settings['samesite'] == 'lax'


def test_auth_cookie_settings_disable_secure_in_local_env():
    settings = Settings(jwt_secret='unit-test-secret', jwt_access_token_minutes=10, env='development', session_https=True)

    cookie_settings = auth_cookie_settings(settings)

    assert cookie_settings['secure'] is False
