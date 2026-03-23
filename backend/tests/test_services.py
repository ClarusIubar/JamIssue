"""Service 레이어 단위 테스트입니다. DB 연결 없이 Mock 객체를 주입하여 순수 로직만 검증합니다."""

from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock, Mock, patch

import pytest

from app.services.stamp_service import StampService
from app.services.review_service import ReviewService
from app.services.user_service import UserService


# ===========================================================================
# StampService 단위 테스트
# ===========================================================================


class TestStampServiceCalculateDistance:
    """calculate_distance_meters – 순수 수학 함수 (DB 불필요)."""

    def test_same_coordinates_returns_zero(self):
        result = StampService.calculate_distance_meters(36.0, 127.0, 36.0, 127.0)
        assert result == pytest.approx(0.0, abs=1e-6)

    def test_known_distance_hanbat_to_expo(self):
        """한밭수목원(36.3671, 127.3886) → 엑스포다리(36.3765, 127.3868) 간 거리를 검증합니다."""
        distance = StampService.calculate_distance_meters(36.3671, 127.3886, 36.3765, 127.3868)
        assert 1000 < distance < 1200

    def test_far_coordinates_return_large_distance(self):
        """서울(37.5665, 126.9780) → 대전(36.3504, 127.3845) 거리는 100km 이상입니다."""
        distance = StampService.calculate_distance_meters(37.5665, 126.9780, 36.3504, 127.3845)
        assert distance > 100_000

    def test_symmetry(self):
        """거리는 방향에 관계없이 동일해야 합니다."""
        d1 = StampService.calculate_distance_meters(36.0, 127.0, 36.1, 127.1)
        d2 = StampService.calculate_distance_meters(36.1, 127.1, 36.0, 127.0)
        assert d1 == pytest.approx(d2, rel=1e-9)


class TestStampServiceEnsureWithinRadius:
    """ensure_within_radius – 위치 검증 로직 (Mock Place 사용)."""

    def _make_service(self):
        place_repo = Mock()
        stamp_repo = Mock()
        user_repo = Mock()
        return StampService(place_repo, stamp_repo, user_repo)

    def _make_place(self, lat: float, lon: float, name: str = "테스트 장소"):
        place = Mock()
        place.latitude = lat
        place.longitude = lon
        place.name = name
        return place

    def test_raises_permission_error_when_too_far(self):
        svc = self._make_service()
        place = self._make_place(36.3671, 127.3886)
        with pytest.raises(PermissionError, match="현장 반경"):
            svc.ensure_within_radius(place, 37.0, 128.0, 120)

    def test_no_error_when_within_radius(self):
        svc = self._make_service()
        place = self._make_place(36.3671, 127.3886)
        svc.ensure_within_radius(place, 36.3672, 127.3887, 120)

    def test_error_message_includes_place_name(self):
        svc = self._make_service()
        place = self._make_place(36.3671, 127.3886, name="한밭수목원 잼가든")
        with pytest.raises(PermissionError) as exc_info:
            svc.ensure_within_radius(place, 37.0, 128.0, 120)
        assert "한밭수목원 잼가든" in str(exc_info.value)


class TestStampServiceToggleStamp:
    """toggle_stamp – Repository를 Mock으로 대체하여 비즈니스 로직만 검증합니다."""

    def _make_repos(self):
        place_repo = Mock()
        stamp_repo = Mock()
        user_repo = Mock()
        return place_repo, stamp_repo, user_repo

    def test_raises_value_error_when_place_not_found(self):
        place_repo, stamp_repo, user_repo = self._make_repos()
        place_repo.get_active_by_slug.return_value = None
        user_repo.get_or_create.return_value = Mock()

        svc = StampService(place_repo, stamp_repo, user_repo)
        with pytest.raises(ValueError, match="장소를 찾을 수 없어요"):
            svc.toggle_stamp("user-1", "nonexistent-place", 36.3671, 127.3886, 120)

    def test_raises_permission_error_when_far_from_place(self):
        place_repo, stamp_repo, user_repo = self._make_repos()

        place = Mock()
        place.position_id = 1
        place.latitude = 36.3671
        place.longitude = 127.3886
        place.name = "한밭수목원 잼가든"
        place_repo.get_active_by_slug.return_value = place
        stamp_repo.get_today.return_value = None
        user_repo.get_or_create.return_value = Mock()

        svc = StampService(place_repo, stamp_repo, user_repo)
        with pytest.raises(PermissionError):
            svc.toggle_stamp("user-1", "hanbat-forest", 37.0, 128.0, 120)

    def test_returns_existing_state_when_already_stamped_today(self):
        """오늘 이미 스탬프를 찍은 경우 현재 상태를 그대로 반환합니다."""
        place_repo, stamp_repo, user_repo = self._make_repos()

        place = Mock()
        place.position_id = 1
        place.latitude = 36.3671
        place.longitude = 127.3886
        place_repo.get_active_by_slug.return_value = place

        existing_stamp = Mock()
        stamp_repo.get_today.return_value = existing_stamp
        user_repo.get_or_create.return_value = Mock()

        expected_state = Mock()
        stamp_repo.get_all_with_place.return_value = []
        stamp_repo.list_travel_sessions.return_value = []
        stamp_repo.list_owner_routes.return_value = []

        svc = StampService(place_repo, stamp_repo, user_repo)
        result = svc.toggle_stamp("user-1", "hanbat-forest", 36.3671, 127.3886, 120)

        stamp_repo.add.assert_not_called()
        assert result.collected_place_ids == []

    def test_adds_stamp_when_valid(self):
        """올바른 위치에서 처음 방문하는 경우 스탬프를 적립합니다."""
        place_repo, stamp_repo, user_repo = self._make_repos()

        place = Mock()
        place.position_id = 1
        place.latitude = 36.3671
        place.longitude = 127.3886
        place.name = "한밭수목원 잼가든"
        place_repo.get_active_by_slug.return_value = place

        stamp_repo.get_today.return_value = None
        stamp_repo.count_visits.return_value = 0
        stamp_repo.get_last.return_value = None
        user_repo.get_or_create.return_value = Mock()

        new_session = Mock()
        new_session.travel_session_id = 1
        stamp_repo.create_travel_session.return_value = new_session
        stamp_repo.add.return_value = Mock()
        stamp_repo.get_all_with_place.return_value = []
        stamp_repo.list_travel_sessions.return_value = []
        stamp_repo.list_owner_routes.return_value = []

        svc = StampService(place_repo, stamp_repo, user_repo)
        result = svc.toggle_stamp("user-1", "hanbat-forest", 36.3671, 127.3886, 120)

        stamp_repo.add.assert_called_once()
        call_kwargs = stamp_repo.add.call_args.kwargs
        assert call_kwargs["user_id"] == "user-1"
        assert call_kwargs["position_id"] == 1
        assert call_kwargs["visit_ordinal"] == 1


# ===========================================================================
# UserService 단위 테스트
# ===========================================================================


class TestUserServiceToSessionUser:
    """to_session_user – 정적 변환 메서드 (DB 불필요)."""

    def _make_user(self, **kwargs):
        user = Mock()
        user.user_id = kwargs.get("user_id", "user-123")
        user.nickname = kwargs.get("nickname", "테스트유저")
        user.email = kwargs.get("email", "test@example.com")
        user.provider = kwargs.get("provider", "naver")
        user.profile_completed_at = kwargs.get("profile_completed_at", None)
        return user

    def test_maps_user_fields_correctly(self):
        user = self._make_user()
        result = UserService.to_session_user(user, is_admin=False)
        assert result.id == "user-123"
        assert result.nickname == "테스트유저"
        assert result.email == "test@example.com"
        assert result.provider == "naver"
        assert result.is_admin is False

    def test_admin_flag_is_set(self):
        user = self._make_user()
        result = UserService.to_session_user(user, is_admin=True)
        assert result.is_admin is True

    def test_provider_override(self):
        user = self._make_user(provider="demo")
        result = UserService.to_session_user(user, is_admin=False, provider="naver")
        assert result.provider == "naver"

    def test_profile_image_is_passed(self):
        user = self._make_user()
        result = UserService.to_session_user(user, is_admin=False, profile_image="https://example.com/img.png")
        assert result.profile_image == "https://example.com/img.png"

    def test_profile_completed_at_is_none_when_not_set(self):
        user = self._make_user(profile_completed_at=None)
        result = UserService.to_session_user(user, is_admin=False)
        assert result.profile_completed_at is None

    def test_profile_completed_at_is_iso_string_when_set(self):
        now = datetime(2025, 6, 1, 12, 0, 0)
        user = self._make_user(profile_completed_at=now)
        result = UserService.to_session_user(user, is_admin=False)
        assert result.profile_completed_at == now.isoformat()


class TestUserServiceUpdateProfile:
    """update_profile – 닉네임 유효성 및 중복 검사 로직."""

    def _make_service(self, *, nickname_exists: bool = False):
        user_repo = Mock()
        user_repo.nickname_exists.return_value = nickname_exists
        user = Mock()
        user.profile_completed_at = None
        user_repo.get.return_value = user
        user_repo.update_profile.return_value = user
        return UserService(user_repo), user_repo, user

    def test_raises_when_user_not_found(self):
        svc, user_repo, _ = self._make_service()
        user_repo.get.return_value = None
        from app.models import ProfileUpdateRequest
        with pytest.raises(ValueError, match="사용자 정보"):
            svc.update_profile("nonexistent", ProfileUpdateRequest(nickname="새닉네임"))

    def test_raises_when_nickname_too_short(self):
        svc, _, _ = self._make_service()
        from app.models import ProfileUpdateRequest
        with pytest.raises(ValueError, match="두 글자"):
            svc.update_profile("user-1", ProfileUpdateRequest(nickname="a"))

    def test_raises_when_nickname_duplicate(self):
        svc, _, _ = self._make_service(nickname_exists=True)
        from app.models import ProfileUpdateRequest
        with pytest.raises(ValueError, match="이미 사용 중인 닉네임"):
            svc.update_profile("user-1", ProfileUpdateRequest(nickname="중복닉네임"))

    def test_succeeds_with_valid_unique_nickname(self):
        svc, user_repo, user = self._make_service(nickname_exists=False)
        from app.models import ProfileUpdateRequest
        result = svc.update_profile("user-1", ProfileUpdateRequest(nickname="새별명"))
        user_repo.update_profile.assert_called_once()
        assert result is user


class TestUserServiceDeleteAccount:
    """delete_account – 계정 삭제 로직."""

    def test_raises_when_user_not_found(self):
        user_repo = Mock()
        user_repo.get.return_value = None
        svc = UserService(user_repo)
        with pytest.raises(ValueError, match="사용자 정보"):
            svc.delete_account("nonexistent")

    def test_calls_repo_delete_when_user_exists(self):
        user_repo = Mock()
        user = Mock()
        user_repo.get.return_value = user
        svc = UserService(user_repo)
        svc.delete_account("user-1")
        user_repo.delete.assert_called_once_with(user)


# ===========================================================================
# ReviewService 단위 테스트
# ===========================================================================


class TestReviewServiceBuildCommentTree:
    """_build_comment_tree – 댓글 트리 빌드 로직 (DB 불필요, 정적 메서드)."""

    def _make_comment(self, comment_id, parent_id, body, is_deleted=False):
        comment = Mock()
        comment.comment_id = comment_id
        comment.parent_id = parent_id
        comment.body = body
        comment.is_deleted = is_deleted
        comment.user_id = "user-1"
        comment.user = Mock()
        comment.user.nickname = "테스트유저"
        comment.created_at = datetime(2025, 1, 1, 12, 0, comment_id)
        return comment

    def test_single_root_comment(self):
        comments = [self._make_comment(1, None, "루트 댓글")]
        tree = ReviewService._build_comment_tree(comments)
        assert len(tree) == 1
        assert tree[0].body == "루트 댓글"
        assert tree[0].replies == []

    def test_reply_attached_to_parent(self):
        root = self._make_comment(1, None, "루트 댓글")
        reply = self._make_comment(2, 1, "대댓글")
        tree = ReviewService._build_comment_tree([root, reply])
        assert len(tree) == 1
        assert len(tree[0].replies) == 1
        assert tree[0].replies[0].body == "대댓글"

    def test_deleted_comment_body_is_masked(self):
        deleted = self._make_comment(1, None, "원본 내용", is_deleted=True)
        tree = ReviewService._build_comment_tree([deleted])
        assert tree[0].body == "삭제된 댓글입니다."

    def test_deep_reply_flattened_to_depth_one(self):
        """대댓글의 답글은 부모(루트) 아래로 귀속되어야 합니다."""
        root = self._make_comment(1, None, "루트")
        depth1 = self._make_comment(2, 1, "대댓글")
        depth2 = self._make_comment(3, 2, "대댓글의 답글")
        tree = ReviewService._build_comment_tree([root, depth1, depth2])
        assert len(tree) == 1
        assert len(tree[0].replies) == 2

    def test_multiple_roots(self):
        c1 = self._make_comment(1, None, "첫 번째 루트")
        c2 = self._make_comment(2, None, "두 번째 루트")
        tree = ReviewService._build_comment_tree([c1, c2])
        assert len(tree) == 2
