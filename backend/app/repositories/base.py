"""모든 Repository가 상속하는 베이스 클래스입니다."""

from __future__ import annotations

from sqlalchemy.orm import Session


class BaseRepository:
    """SQLAlchemy Session을 생성자로 주입받는 Repository 기반 클래스입니다."""

    def __init__(self, db: Session) -> None:
        self.db = db
