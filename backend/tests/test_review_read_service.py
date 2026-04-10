from app.services import review_service


def test_read_reviews_service_delegates_to_repository(monkeypatch):
    sentinel = [{"id": "review-1"}]

    session_user = type("SessionUserLike", (), {"id": "user-1"})()

    def fake_list_review_entries(db, *, place_id=None, user_id=None, current_user_id=None):
        assert db == "db-session"
        assert place_id == "place-1"
        assert user_id == "author-1"
        assert current_user_id == "user-1"
        return sentinel

    monkeypatch.setattr(review_service, "list_review_entries", fake_list_review_entries)

    assert review_service.read_reviews_service("db-session", "place-1", "author-1", session_user) == sentinel
