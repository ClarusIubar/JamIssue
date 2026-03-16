from sqlalchemy.pool import NullPool

from app.config import Settings
from app.db import build_engine_options


def test_postgres_database_url_is_normalized_and_masked():
    settings = Settings(
        env='worker',
        database_url='postgres://postgres.demo:super-secret@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres',
    )

    assert settings.normalized_database_url.startswith('postgresql+psycopg://')
    assert settings.database_provider == 'supabase-postgres'
    assert settings.uses_supabase_pooler is True
    assert 'super-secret' not in settings.database_display_url
    assert '***' in settings.database_display_url


def test_mysql_database_url_is_normalized():
    settings = Settings(database_url='mysql://jamissue:secret@127.0.0.1:3306/jamissue')

    assert settings.normalized_database_url == 'mysql+pymysql://jamissue:secret@127.0.0.1:3306/jamissue'
    assert settings.database_provider == 'mysql'


def test_engine_options_use_nullpool_for_supabase_pooler():
    settings = Settings(
        env='worker',
        database_url='postgres://postgres.demo:secret@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres',
    )

    engine_options = build_engine_options(settings)

    assert engine_options['poolclass'] is NullPool
    assert engine_options['pool_pre_ping'] is True
    assert engine_options['pool_recycle'] == 1800


def test_sqlite_connect_args_and_storage_target_label(tmp_path):
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        storage_backend='supabase',
        supabase_storage_bucket='review-images',
    )

    assert settings.database_connect_args == {'check_same_thread': False}
    assert settings.storage_target_label == 'supabase://review-images'
