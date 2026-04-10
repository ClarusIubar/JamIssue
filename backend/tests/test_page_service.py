def test_page_service_imports():
    from app.services import page_service

    assert callable(page_service.read_bootstrap_service)
    assert callable(page_service.read_courses_service)
    assert callable(page_service.read_reviews_service)
