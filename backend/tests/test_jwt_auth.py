from app.config import Settings
from app.jwt_auth import issue_access_token, read_access_token
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
