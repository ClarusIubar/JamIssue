from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.config import Settings
from app.db import Base
from app.models import UserRouteCreate
from app.repository import import_public_bundle, toggle_stamp
from app.user_routes import create_user_route, list_public_user_routes, list_user_routes_for_owner, toggle_user_route_like


def build_session(tmp_path: Path):
    database_url = f"sqlite:///{tmp_path / 'user-routes.db'}"
    engine = create_engine(database_url, future=True, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    return session_factory()


def load_seed_data(session):
    settings = Settings(database_url='sqlite:///ignored.db', public_data_path=str(Path(__file__).resolve().parents[1] / 'data/public_bundle.json'))
    import_public_bundle(session, settings)


def collect_two_stamps(session, user_id: str):
    toggle_stamp(session, user_id, 'hanbat-forest', 36.3671, 127.3886, 120)
    toggle_stamp(session, user_id, 'expo-bridge', 36.3765, 127.3868, 120)


def test_user_route_requires_real_stamps_and_lists_for_owner(tmp_path: Path):
    session = build_session(tmp_path)
    load_seed_data(session)
    collect_two_stamps(session, 'route-owner')

    route = create_user_route(
        session,
        UserRouteCreate(
            title='노을 산책 루트',
            description='수목원에서 걷고 다리까지 이어지는 실제 방문 동선이에요.',
            mood='데이트',
            placeIds=['hanbat-forest', 'expo-bridge'],
            isPublic=True,
        ),
        'route-owner',
        '하늘',
    )
    my_routes = list_user_routes_for_owner(session, 'route-owner')

    assert route.author == '하늘'
    assert route.place_ids == ['hanbat-forest', 'expo-bridge']
    assert my_routes[0].id == route.id



def test_user_route_like_updates_popular_sort(tmp_path: Path):
    session = build_session(tmp_path)
    load_seed_data(session)

    collect_two_stamps(session, 'owner-a')
    collect_two_stamps(session, 'owner-b')

    route_a = create_user_route(
        session,
        UserRouteCreate(
            title='꽃길 스타트',
            description='수목원 시작으로 가볍게 걷기 좋은 공개 경로예요.',
            mood='사진',
            placeIds=['hanbat-forest', 'expo-bridge'],
            isPublic=True,
        ),
        'owner-a',
        '민서',
    )
    route_b = create_user_route(
        session,
        UserRouteCreate(
            title='브릿지 중심 루트',
            description='짧게 다녀와도 기억 남는 저녁 코스로 만들었어요.',
            mood='데이트',
            placeIds=['expo-bridge', 'hanbat-forest'],
            isPublic=True,
        ),
        'owner-b',
        '가은',
    )

    toggle_user_route_like(session, route_a.id, 'fan-1', '팬하나')
    popular_routes = list_public_user_routes(session, 'popular', 'fan-1')
    latest_routes = list_public_user_routes(session, 'latest', 'fan-1')

    assert popular_routes[0].id == route_a.id
    assert popular_routes[0].liked_by_me is True
    assert popular_routes[0].like_count == 1
    assert latest_routes[0].id == route_b.id
