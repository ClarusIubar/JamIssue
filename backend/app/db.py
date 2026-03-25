"""Database engine and session helpers."""

from __future__ import annotations

from collections.abc import Generator
from typing import cast

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from .config import Settings, get_settings


class Base(DeclarativeBase):
    """모든 SQLAlchemy ORM 모델이 상속받는 기본 클래스입니다."""


settings = get_settings()
_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def build_engine_options(app_settings: Settings) -> dict[str, object]:
    """
    현재 실행 환경에 맞춘 SQLAlchemy 엔진 옵션을 생성합니다.

    파라미터:
    - app_settings: 애플리케이션 설정 객체
    """

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
    """
    SQLite 데이터베이스를 사용할 경우, 외래 키 제약 조건을 명시적으로 활성화합니다.
    """
    if not app_settings.is_sqlite_database:
        return

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def create_sqlalchemy_engine(app_settings: Settings) -> Engine:
    """
    설정된 데이터베이스 URL을 기반으로 SQLAlchemy 엔진을 생성합니다.
    """

    engine = create_engine(app_settings.normalized_database_url, **build_engine_options(app_settings))
    _enable_sqlite_foreign_keys(engine, app_settings)
    return cast(Engine, engine)


def get_engine(app_settings: Settings | None = None) -> Engine:
    """
    지연 초기화(Lazy initialization) 방식으로 생성된 SQLAlchemy 엔진을 반환합니다.
    """

    global _engine
    if _engine is None:
        _engine = create_sqlalchemy_engine(app_settings or settings)
    return _engine


def get_session_factory(app_settings: Settings | None = None) -> sessionmaker[Session]:
    """
    지연 초기화 방식으로 생성된 SQLAlchemy 세션 팩토리를 반환합니다.
    """

    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(
            bind=get_engine(app_settings),
            autoflush=False,
            autocommit=False,
            future=True,
        )
    return _session_factory


def get_db() -> Generator[Session, None, None]:
    """
    요청(Request) 단위의 생명주기를 가지는 SQLAlchemy 세션을 생성하여 제공합니다.
    FastAPI의 의존성 주입(Depends)으로 주로 사용됩니다.
    """

    db = get_session_factory()()
    try:
        yield db
    finally:
        db.close()
