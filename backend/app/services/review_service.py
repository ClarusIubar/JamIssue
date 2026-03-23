"""후기·댓글·좋아요 비즈니스 로직 서비스입니다."""

from __future__ import annotations

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from ..db_models import Feed, UserComment, UserStamp
from ..models import (
    CommentCreate,
    CommentOut,
    MyCommentOut,
    ReviewCreate,
    ReviewLikeResponse,
    ReviewOut,
)
from ..repositories.place_repository import PlaceRepository
from ..repositories.review_repository import ReviewRepository
from ..repositories.stamp_repository import StampRepository
from ..repositories.user_repository import UserRepository

KST = ZoneInfo("Asia/Seoul")

BADGE_BY_MOOD = {
    "설렘": "첫 방문",
    "친구랑": "친구 추천",
    "혼자서": "로컬 탐방",
    "야경 맛집": "야경 성공",
}


def _utcnow_naive() -> datetime:
    return datetime.now(KST).replace(tzinfo=None)


def _to_seoul_date(value: datetime | None = None):
    from datetime import date
    if value is None:
        return datetime.now(KST).date()
    if value.tzinfo is None:
        return value.date()
    return value.astimezone(KST).date()


def _format_datetime(value: datetime | None) -> str:
    if not value:
        return ""
    return value.strftime("%m. %d. %H:%M")


def _format_visit_label(visit_number: int | None) -> str:
    safe = visit_number if visit_number and visit_number > 0 else 1
    return f"{safe}번째 방문"


def _parse_review_id(review_id: str) -> int:
    try:
        return int(review_id)
    except ValueError as error:
        raise ValueError("잘못된 ID 형식이에요.") from error


def _parse_comment_id(comment_id: str) -> int:
    try:
        return int(comment_id)
    except ValueError as error:
        raise ValueError("잘못된 댓글 ID 형식이에요.") from error


def _parse_stamp_id(stamp_id: str) -> int:
    try:
        return int(stamp_id)
    except ValueError as error:
        raise ValueError("잘못된 스탬프 ID 형식이에요.") from error


class ReviewService:
    """피드 작성, 댓글 트리 생성, 좋아요 토글 로직을 담당합니다."""

    def __init__(
        self,
        review_repo: ReviewRepository,
        place_repo: PlaceRepository,
        stamp_repo: StampRepository,
        user_repo: UserRepository,
    ) -> None:
        self.review_repo = review_repo
        self.place_repo = place_repo
        self.stamp_repo = stamp_repo
        self.user_repo = user_repo

    # ------------------------------------------------------------------
    # 후기 조회 / 작성 / 삭제
    # ------------------------------------------------------------------

    def list_reviews(
        self,
        place_id: str | None = None,
        user_id: str | None = None,
        current_user_id: str | None = None,
    ) -> list[ReviewOut]:
        """장소별 또는 사용자별 후기 목록을 반환합니다."""
        feeds = self.review_repo.list(place_id=place_id, user_id=user_id)
        return [self._to_review_out(feed, current_user_id) for feed in feeds]

    def create_review(self, payload: ReviewCreate, user_id: str, nickname: str) -> ReviewOut:
        """새 후기를 작성합니다."""
        body = payload.body.strip()
        if not body:
            raise ValueError("후기 본문을 한 줄 이상 입력해 주세요.")

        place = self.place_repo.get_active_by_slug(payload.place_id)
        if not place:
            raise ValueError("장소를 찾을 수 없어요.")

        stamp_id_key = _parse_stamp_id(payload.stamp_id)
        stamp = self.stamp_repo.get_stamp_by_id(stamp_id_key)
        if not stamp or stamp.user_id != user_id:
            raise ValueError("해당 방문 스탬프를 찾을 수 없어요.")
        if stamp.position_id != place.position_id:
            raise ValueError("장소와 스탬프가 일치하지 않아요.")

        if self.review_repo.check_existing_feed_for_stamp(stamp_id_key):
            raise ValueError("같은 방문 인증으로는 피드를 한 번만 남길 수 있어요.")

        now = _utcnow_naive()
        today = _to_seoul_date(now)
        day_start = datetime.combine(today, time.min)
        day_end = day_start + timedelta(days=1)
        if self.review_repo.check_existing_daily_feed(user_id, day_start, day_end):
            raise ValueError("피드는 하루에 하나만 작성할 수 있어요.")

        self.user_repo.get_or_create(user_id, nickname, now=now)
        feed = self.review_repo.create(
            position_id=place.position_id,
            user_id=user_id,
            stamp_id=stamp.stamp_id,
            body=body,
            mood=payload.mood,
            badge=BADGE_BY_MOOD.get(payload.mood, _format_visit_label(stamp.visit_ordinal)),
            image_url=payload.image_url,
            now=now,
        )
        stored_feed = self.review_repo.get_with_relations(feed.feed_id)
        return self._to_review_out(stored_feed, current_user_id=user_id)

    def delete_review(self, review_id: str, user_id: str, *, is_admin: bool = False) -> None:
        """후기를 삭제합니다."""
        review_key = _parse_review_id(review_id)
        feed = self.review_repo.get(review_key)
        if not feed:
            raise ValueError("후기를 찾지 못했어요.")
        if feed.user_id != user_id and not is_admin:
            raise PermissionError("내 후기만 삭제할 수 있어요.")
        self.review_repo.delete(feed)

    # ------------------------------------------------------------------
    # 좋아요 토글
    # ------------------------------------------------------------------

    def toggle_like(self, review_id: str, user_id: str, nickname: str) -> ReviewLikeResponse:
        """후기 좋아요를 토글합니다."""
        review_key = _parse_review_id(review_id)
        feed = self.review_repo.get(review_key)
        if not feed:
            raise ValueError("후기를 찾지 못했어요.")
        if feed.user_id == user_id:
            raise ValueError("내 후기에는 좋아요를 누를 수 없어요.")

        now = _utcnow_naive()
        self.user_repo.get_or_create(user_id, nickname, now=now)
        existing = self.review_repo.get_like(review_key, user_id)

        if existing:
            self.review_repo.delete_like(existing)
            liked_by_me = False
        else:
            self.review_repo.add_like(review_key, user_id, now)
            liked_by_me = True

        like_count = self.review_repo.count_likes(review_key)
        return ReviewLikeResponse(reviewId=str(feed.feed_id), likeCount=like_count, likedByMe=liked_by_me)

    # ------------------------------------------------------------------
    # 댓글
    # ------------------------------------------------------------------

    def get_comments(self, review_id: str) -> list[CommentOut]:
        """하나의 후기 아래 달린 댓글 트리를 반환합니다."""
        review_key = _parse_review_id(review_id)
        comments = self.review_repo.get_comments_for_review(review_key)
        return self._build_comment_tree(comments)

    def create_comment(
        self,
        review_id: str,
        payload: CommentCreate,
        user_id: str,
        nickname: str,
    ) -> list[CommentOut]:
        """댓글 또는 답글을 저장한 뒤 최신 댓글 트리를 반환합니다."""
        body = payload.body.strip()
        if not body:
            raise ValueError("댓글 내용을 입력해 주세요.")

        review_key = _parse_review_id(review_id)
        feed = self.review_repo.get(review_key)
        if not feed:
            raise ValueError("후기를 찾을 수 없어요.")

        parent_id: int | None = None
        if payload.parent_id:
            parent_id = _parse_comment_id(payload.parent_id)
            parent = self.review_repo.get_comment(parent_id)
            if not parent or parent.feed_id != review_key:
                raise ValueError("같은 후기 안에 있는 댓글에만 답글을 달 수 있어요.")
            if parent.parent_id is not None:
                parent_id = parent.parent_id

        now = _utcnow_naive()
        self.user_repo.get_or_create(user_id, nickname, now=now)
        self.review_repo.create_comment(review_key, user_id, parent_id, body, now)
        return self.get_comments(review_id)

    def delete_comment(
        self,
        review_id: str,
        comment_id: str,
        user_id: str,
        *,
        is_admin: bool = False,
    ) -> list[CommentOut]:
        """댓글을 소프트 삭제 처리하고 최신 댓글 트리를 반환합니다."""
        review_key = _parse_review_id(review_id)
        comment_key = _parse_comment_id(comment_id)
        comment = self.review_repo.get_comment_for_review(review_key, comment_key)
        if not comment:
            raise ValueError("댓글을 찾지 못했어요.")
        if comment.user_id != user_id and not is_admin:
            raise PermissionError("내 댓글만 삭제할 수 있어요.")
        if not comment.is_deleted:
            self.review_repo.soft_delete_comment(comment, _utcnow_naive())
        return self.get_comments(review_id)

    def build_my_comments(self, user_id: str) -> list[MyCommentOut]:
        """특정 사용자가 작성한 댓글 목록을 마이페이지 형식으로 반환합니다."""
        comment_rows = self.review_repo.get_my_comments(user_id)
        return [
            MyCommentOut(
                id=str(comment.comment_id),
                reviewId=str(comment.feed_id),
                placeId=comment.feed.place.slug,
                placeName=comment.feed.place.name,
                body="삭제된 댓글입니다." if comment.is_deleted else comment.body,
                isDeleted=comment.is_deleted,
                parentId=str(comment.parent_id) if comment.parent_id else None,
                createdAt=_format_datetime(comment.created_at),
                reviewBody=comment.feed.body,
            )
            for comment in comment_rows
            if comment.feed and comment.feed.place
        ]

    # ------------------------------------------------------------------
    # DTO 변환
    # ------------------------------------------------------------------

    @staticmethod
    def _to_review_out(feed: Feed, current_user_id: str | None = None) -> ReviewOut:
        comments = list(feed.comments or [])
        likes = list(feed.likes or [])
        liked_by_me = any(like.user_id == current_user_id for like in likes) if current_user_id else False
        visit_number = feed.stamp.visit_ordinal if feed.stamp else 1
        return ReviewOut(
            id=str(feed.feed_id),
            userId=feed.user_id,
            placeId=feed.place.slug,
            placeName=feed.place.name,
            author=feed.user.nickname,
            body=feed.body,
            mood=feed.mood,
            badge=feed.badge,
            visitedAt=_format_datetime(feed.created_at),
            imageUrl=feed.image_url,
            commentCount=len(comments),
            likeCount=len(likes),
            likedByMe=liked_by_me,
            stampId=str(feed.stamp_id) if feed.stamp_id else None,
            visitNumber=visit_number,
            visitLabel=_format_visit_label(visit_number),
            travelSessionId=(
                str(feed.stamp.travel_session_id)
                if feed.stamp and feed.stamp.travel_session_id
                else None
            ),
            comments=ReviewService._build_comment_tree(list(feed.comments or [])),
        )

    @staticmethod
    def _build_comment_tree(comments: list[UserComment]) -> list[CommentOut]:
        """댓글 목록을 부모-자식 트리 구조로 변환합니다."""
        ordered = sorted(comments, key=lambda c: (c.created_at, c.comment_id))
        comment_rows_by_id = {c.comment_id: c for c in ordered}
        nodes: dict[int, CommentOut] = {}
        roots: list[CommentOut] = []

        for comment in ordered:
            nodes[comment.comment_id] = CommentOut(
                id=str(comment.comment_id),
                userId=comment.user_id,
                author=comment.user.nickname if comment.user else "이름 없음",
                body="삭제된 댓글입니다." if comment.is_deleted else comment.body,
                parentId=str(comment.parent_id) if comment.parent_id else None,
                isDeleted=comment.is_deleted,
                createdAt=_format_datetime(comment.created_at),
                replies=[],
            )

        for comment in ordered:
            node = nodes[comment.comment_id]
            parent = comment_rows_by_id.get(comment.parent_id) if comment.parent_id else None
            root_parent_id = None
            if parent:
                root_parent_id = parent.parent_id or parent.comment_id
            if root_parent_id and root_parent_id in nodes:
                nodes[root_parent_id].replies.append(node)
            else:
                roots.append(node)

        return roots
