from alembic import context


def run(connection):
    context.configure(connection=connection, render_as_batch=connection.dialect.name == "sqlite")
    with context.begin_transaction():
        context.run_migrations()


if "connection" in context.config.attributes:
    run(context.config.attributes["connection"])
else:
    from app.core.config import Settings
    from app.db.session import build_engine

    engine = build_engine(Settings().database_url)
    try:
        with engine.connect() as connection:
            if engine.dialect.name == "sqlite":
                connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
                connection.commit()
            run(connection)
            connection.commit()
            if engine.dialect.name == "sqlite":
                connection.exec_driver_sql("PRAGMA foreign_keys=ON")
                if connection.exec_driver_sql("PRAGMA foreign_key_check").fetchall():
                    raise RuntimeError("Нарушена целостность БД после миграции")
    finally:
        engine.dispose()
