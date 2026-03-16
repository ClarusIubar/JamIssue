from pathlib import Path

import app.storage as storage_module
from app.config import Settings
from app.storage import LocalStorageAdapter, SupabaseStorageAdapter, get_storage_adapter


class DummyResponse:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return b''


def test_local_storage_adapter_saves_review_image(tmp_path: Path):
    settings = Settings(storage_backend='local', upload_dir=str(tmp_path / 'uploads'))

    adapter = get_storage_adapter(settings)
    stored = adapter.save_review_image(
        owner_id='naver:tester',
        file_name='sample.png',
        content_type='image/png',
        raw_bytes=b'png-bytes',
    )

    assert isinstance(adapter, LocalStorageAdapter)
    assert stored.url == '/uploads/sample.png'
    assert stored.file_name == 'sample.png'
    assert (tmp_path / 'uploads' / 'sample.png').read_bytes() == b'png-bytes'


def test_supabase_storage_adapter_builds_public_url_and_object_path():
    settings = Settings(
        storage_backend='supabase',
        supabase_url='https://project.supabase.co',
        supabase_service_role_key='service-role-key',
        supabase_storage_bucket='review-images',
    )

    adapter = SupabaseStorageAdapter(settings)

    assert adapter.build_object_path('naver:tester', 'photo 1.png') == 'reviews/naver_tester/photo 1.png'
    assert (
        adapter.build_public_url('reviews/naver_tester/photo 1.png')
        == 'https://project.supabase.co/storage/v1/object/public/review-images/reviews/naver_tester/photo%201.png'
    )


def test_supabase_storage_adapter_posts_to_storage_api(monkeypatch):
    settings = Settings(
        storage_backend='supabase',
        supabase_url='https://project.supabase.co',
        supabase_service_role_key='service-role-key',
        supabase_storage_bucket='review-images',
    )
    adapter = SupabaseStorageAdapter(settings)
    captured = {}

    def fake_urlopen(request):
        captured['url'] = request.full_url
        captured['method'] = request.get_method()
        captured['headers'] = dict(request.header_items())
        captured['body'] = request.data
        return DummyResponse()

    monkeypatch.setattr(storage_module, 'urlopen', fake_urlopen)

    stored = adapter.save_review_image(
        owner_id='naver:tester',
        file_name='sample.png',
        content_type='image/png',
        raw_bytes=b'png-bytes',
    )

    assert captured['url'] == 'https://project.supabase.co/storage/v1/object/review-images/reviews/naver_tester/sample.png'
    assert captured['method'] == 'POST'
    assert captured['headers']['Authorization'] == 'Bearer service-role-key'
    assert captured['headers']['Apikey'] == 'service-role-key'
    assert captured['headers']['X-upsert'] == 'false'
    assert captured['body'] == b'png-bytes'
    assert stored.url == 'https://project.supabase.co/storage/v1/object/public/review-images/reviews/naver_tester/sample.png'
