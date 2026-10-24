from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import Settings, get_settings
from app.db.seed import seed_database
from app.db.session import build_engine, build_session_factory, initialize_database


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        engine = build_engine(config.database_url)
        try:
            initialize_database(engine)
            factory = build_session_factory(engine)
            with factory() as session:
                seed_database(session)
            app.state.settings = config
            app.state.session_factory = factory
            yield
        finally:
            engine.dispose()

    app = FastAPI(
        title="Умный кредитный кабинет предпринимателя",
        version="0.1.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Idempotency-Key", "X-Bank-Token", "X-Request-ID"],
    )
    return app


app = create_app()
