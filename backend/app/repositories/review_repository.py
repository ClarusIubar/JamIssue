"""후기(Feed, FeedLike, UserComment) 데이터 접근 레이어입니다."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..db_models import Feed, FeedLike, MapPlace, UserComment
from .base import BaseRepository


class ReviewRepository(BaseRepository):
    """Feed, FeedLike, UserComment 테이블에 대한 CRUD를 담당합니다."""

    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, review_id: int) -> Feed | None:
        """feed_id 기준으로 후기를 조회합니다."""
        return self.db.get(Feed, review_id)

    def get_with_relations(self, review_id: int) -> Feed | None:
        """연관 관계(user, place, stamp, likes, comments)를 포함하여 후기를 조회합니다."""
        return self.db.scalars(
            select(Feed)
            .options(
                joinedload(Feed.user),
                joinedload(Feed.place),
                joinedload(Feed.stamp),
                joinedload(Feed.likes),
                joinedload(Feed.comments).joinedload(UserComment.user),
            )
            .where(Feed.feed_id == review_id)
        ).unique().first()

    def list(
        self,
        place_id: str | None = None,
        user_id: str | None = None,
    ) -> list[Feed]:
        """장소별 또는 사용자별 후기 목록을 반환합니다."""
        stmt = (
            select(Feed)
            .options(
                joinedload(Feed.user),
                joinedload(Feed.place),
                joinedload(Feed.stamp),
                joinedload(Feed.likes),
                joinedload(Feed.comments).joinedload(UserComment.user),
            )
            .order_by(Feed.created_at.desc(), Feed.feed_id.desc())
        )
        if place_id:
            stmt = stmt.join(Feed.place).where(MapPlace.slug == place_id)
        if user_id:
            stmt = stmt.where(Feed.user_id == user_id)
        return list(self.db.scalars(stmt).unique().all())

    def create(
        self,
        position_id: int,
        user_id: str,
        stamp_id: int,
        body: str,
        mood: str,
        badge: str,
        image_url: str | None,
        now: datetime,
    ) -> Feed:
        """새 후기를 생성합니다."""
        feed = Feed(
            position_id=position_id,
            user_id=user_id,
            stamp_id=stamp_id,
            body=body,
            mood=mood,
            badge=badge,
            image_url=image_url,
            created_at=now,
            updated_at=now,
        )
        self.db.add(feed)
        self.db.commit()
        return feed

    def delete(self, feed: Feed) -> None:
        """후기를 삭제합니다 (cascade로 댓글·좋아요도 삭제됩니다)."""
        self.db.delete(feed)
        self.db.commit()

    def get_like(self, feed_id: int, user_id: str) -> FeedLike | None:
        """특정 사용자의 특정 후기 좋아요 레코드를 조회합니다."""
        return self.db.scalars(
            select(FeedLike).where(FeedLike.feed_id == feed_id, FeedLike.user_id == user_id)
        ).first()

    def add_like(self, feed_id: int, user_id: str, now: datetime) -> FeedLike:
        """좋아요를 추가합니다."""
        like = FeedLike(feed_id=feed_id, user_id=user_id, created_at=now)
        self.db.add(like)
        self.db.commit()
        return like

    def delete_like(self, like: FeedLike) -> None:
        """좋아요를 삭제합니다."""
        self.db.delete(like)
        self.db.commit()

    def count_likes(self, feed_id: int) -> int:
        """특정 후기의 좋아요 수를 반환합니다."""
        return int(
            self.db.scalar(select(func.count()).select_from(FeedLike).where(FeedLike.feed_id == feed_id)) or 0
        )

    def get_comment(self, comment_id: int) -> UserComment | None:
        """comment_id로 댓글을 조회합니다."""
        return self.db.get(UserComment, comment_id)

    def get_comments_for_review(self, review_id: int) -> list[UserComment]:
        """하나의 후기에 달린 댓글 목록을 시간 순으로 반환합니다."""
        return list(
            self.db.scalars(
                select(UserComment)
                .options(joinedload(UserComment.user))
                .where(UserComment.feed_id == review_id)
                .order_by(UserComment.created_at.asc(), UserComment.comment_id.asc())
            ).unique().all()
        )

    def create_comment(
        self,
        feed_id: int,
        user_id: str,
        parent_id: int | None,
        body: str,
        now: datetime,
    ) -> UserComment:
        """새 댓글을 생성합니다."""
        comment = UserComment(
            feed_id=feed_id,
            user_id=user_id,
            parent_id=parent_id,
            body=body,
            is_deleted=False,
            created_at=now,
            updated_at=now,
        )
        self.db.add(comment)
        self.db.commit()
        return comment

    def soft_delete_comment(self, comment: UserComment, now: datetime) -> None:
        """댓글을 소프트 삭제 처리합니다."""
        comment.is_deleted = True
        comment.body = ""
        comment.updated_at = now
        self.db.commit()

    def get_my_comments(self, user_id: str) -> list[UserComment]:
        """특정 사용자가 작성한 모든 댓글을 반환합니다."""
        return list(
            self.db.scalars(
                select(UserComment)
                .options(joinedload(UserComment.feed).joinedload(Feed.place))
                .where(UserComment.user_id == user_id)
                .order_by(UserComment.created_at.desc(), UserComment.comment_id.desc())
            ).unique().all()
        )

    def get_comment_for_review(self, review_id: int, comment_id: int) -> UserComment | None:
        """review_id와 comment_id를 함께 검증하여 댓글을 조회합니다."""
        return self.db.scalars(
            select(UserComment).where(
                UserComment.comment_id == comment_id,
                UserComment.feed_id == review_id,
            )
        ).first()

    def check_existing_daily_feed(self, user_id: str, day_start: datetime, day_end: datetime) -> Feed | None:
        """하루 1회 제한을 위해 오늘 이미 작성된 후기가 있는지 확인합니다."""
        return self.db.scalars(
            select(Feed.feed_id).where(Feed.user_id == user_id, Feed.created_at >= day_start, Feed.created_at < day_end)
        ).first()

    def check_existing_feed_for_stamp(self, stamp_id: int) -> Feed | None:
        """같은 스탬프로 이미 작성된 후기가 있는지 확인합니다."""
        return self.db.scalars(select(Feed).where(Feed.stamp_id == stamp_id)).first()

    def count_all(self) -> int:
        """전체 후기 수를 반환합니다."""
        return int(self.db.scalar(select(func.count()).select_from(Feed)) or 0)

    def count_all_comments(self) -> int:
        """전체 댓글 수를 반환합니다."""
        return int(self.db.scalar(select(func.count()).select_from(UserComment)) or 0)
