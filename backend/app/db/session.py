from pathlib import Path

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


def build_engine(database_url: str) -> Engine:
    url = make_url(database_url)
    options = {}
    if url.get_backend_name() == "sqlite":
        if url.database and url.database != ":memory:":
            Path(url.database).parent.mkdir(parents=True, exist_ok=True)
        else:
            options["poolclass"] = StaticPool
        options["connect_args"] = {"check_same_thread": False, "timeout": 10}
    engine = create_engine(url, **options)
    if url.get_backend_name() == "sqlite":
        event.listen(engine, "connect", _configure_sqlite)
    return engine


def _configure_sqlite(connection, _record) -> None:
    cursor = connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


def build_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False)


def initialize_database(engine: Engine) -> None:
    from alembic import command
    from alembic.config import Config

    from app.db import (
        access_models,  # noqa: F401
        products,  # noqa: F401
        workflow_models,  # noqa: F401
    )

    config = Config()
    config.set_main_option(
        "script_location", str(Path(__file__).resolve().parents[2] / "migrations")
    )
    with engine.connect() as connection:
        # Иначе SQLite CASCADE удалит события при пересоздании родительской таблицы.
        if engine.dialect.name == "sqlite":
            connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
            connection.commit()
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
        connection.commit()
        if engine.dialect.name == "sqlite":
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            if connection.exec_driver_sql("PRAGMA foreign_key_check").fetchall():
                raise RuntimeError("Нарушена целостность БД после миграции")
