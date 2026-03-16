"""SQLAlchemy 엔진과 세션 팩토리를 구성합니다."""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from .config import Settings, get_settings


class Base(DeclarativeBase):
    """모든 ORM 모델이 상속하는 기본 베이스입니다."""


settings = get_settings()


def build_engine_options(app_settings: Settings) -> dict[str, object]:
    """DB 종류와 런타임 특성에 맞는 SQLAlchemy 옵션을 구성합니다."""

    engine_options: dict[str, object] = {"future": True}
    connect_args = app_settings.database_connect_args.copy()

    if not app_settings.is_sqlite_database:
        engine_options["pool_pre_ping"] = True
        engine_options["pool_recycle"] = 1800
        engine_options["pool_use_lifo"] = True

    if app_settings.prefer_sqlalchemy_null_pool:
        engine_options["poolclass"] = NullPool

    if connect_args:
        engine_options["connect_args"] = connect_args

    return engine_options


def _enable_sqlite_foreign_keys(engine: Engine, app_settings: Settings) -> None:
    if not app_settings.is_sqlite_database:
        return

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def create_sqlalchemy_engine(app_settings: Settings):
    """정규화된 DB URL과 엔진 옵션으로 SQLAlchemy 엔진을 생성합니다."""

    engine = create_engine(app_settings.normalized_database_url, **build_engine_options(app_settings))
    _enable_sqlite_foreign_keys(engine, app_settings)
    return engine


engine = create_sqlalchemy_engine(settings)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Generator[Session, None, None]:
    """요청 단위 데이터베이스 세션을 열고 닫습니다."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
