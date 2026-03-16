from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.config import Settings
from app.db import Base
from app.db_models import MapPlace, PublicEvent, PublicEventMapLink
from app.public_data.event_service import build_public_event_banner_response, import_public_events


def build_session(tmp_path: Path):
    database_url = f"sqlite:///{tmp_path / 'test.db'}"
    engine = create_engine(database_url, future=True, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    return session_factory()


def write_event_fixture(tmp_path: Path) -> Path:
    fixture_path = tmp_path / 'public_events.json'
    fixture_path.write_text(
        """
{
  "response": {
    "body": {
      "items": {
        "item": [
          {
            "축제명": "대전 빵 축제",
            "개최장소": "대전 엑스포 시민광장",
            "소재지도로명주소": "대전 유성구 엑스포로 107",
            "축제시작일자": "20990320",
            "축제종료일자": "20990322",
            "축제내용": "빵과 디저트, 로컬 브랜드가 함께 모이는 행사",
            "홈페이지주소": "https://example.com/dj-bread"
          },
          {
            "축제명": "서울 샘플 행사",
            "개최장소": "서울광장",
            "소재지도로명주소": "서울 중구 세종대로 110",
            "축제시작일자": "20990325",
            "축제종료일자": "20990326",
            "축제내용": "대전이 아닌 데이터라서 필터링되어야 합니다."
          }
        ]
      }
    }
  }
}
        """.strip(),
        encoding="utf-8",
    )
    return fixture_path


def build_settings(fixture_path: Path) -> Settings:
    return Settings(
        database_url="sqlite:///ignored.db",
        public_event_path=str(fixture_path),
        public_event_city_keyword="대전",
        public_event_limit=6,
    )


def seed_map_place(session) -> None:
    session.add(
        MapPlace(
            slug="expo-plaza",
            name="대전 엑스포 시민광장",
            district="유성구",
            category="landmark",
            latitude=36.3740,
            longitude=127.3860,
            summary="행사와 산책이 모이는 광장",
            description="행사 테스트용 map 장소입니다.",
            vibe_tags=["행사", "광장"],
            visit_time="30분 - 1시간",
            route_hint="행사와 강변 산책을 함께 보기 좋아요.",
            stamp_reward="광장 스탬프",
            hero_label="Expo Plaza",
            jam_color="#ff8fb7",
            accent_color="#8ecbff",
            is_active=True,
        )
    )
    session.commit()


def test_public_event_import_filters_target_city_and_links_map(tmp_path: Path):
    session = build_session(tmp_path)
    seed_map_place(session)
    fixture_path = write_event_fixture(tmp_path)
    settings = build_settings(fixture_path)

    imported = import_public_events(session, settings)

    events = session.scalars(select(PublicEvent)).all()
    links = session.scalars(select(PublicEventMapLink)).all()

    assert imported == 1
    assert len(events) == 1
    assert events[0].title == "대전 빵 축제"
    assert len(links) == 1
    assert links[0].match_method == "name-exact"


def test_public_event_banner_response_returns_live_items(tmp_path: Path):
    session = build_session(tmp_path)
    seed_map_place(session)
    fixture_path = write_event_fixture(tmp_path)
    settings = build_settings(fixture_path)

    response = build_public_event_banner_response(session, settings)

    assert response.source_ready is True
    assert response.source_name == "JamIssue Public Event Feed"
    assert len(response.items) == 1
    assert response.items[0].title == "대전 빵 축제"
    assert response.items[0].date_label == "3월 20일 - 3월 22일"
    assert response.items[0].linked_place_name == "대전 엑스포 시민광장"
