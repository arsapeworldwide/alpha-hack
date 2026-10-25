from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.staticfiles import StaticFiles

from app.api import applications, auth, bank, companies, demo, feed, health
from app.core.config import Settings, get_settings
from app.core.errors import ERROR_RESPONSES, install_error_handlers
from app.core.logging import RequestIdMiddleware, configure_logging
from app.db.access_seed import seed_access
from app.db.seed import seed_database
from app.db.session import build_engine, build_session_factory, initialize_database
from app.integrations.providers import build_integrations
from app.services.pipeline import Pipeline


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or get_settings()
    configure_logging(config.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        engine = build_engine(config.database_url)
        pipeline = None
        try:
            initialize_database(engine)
            factory = build_session_factory(engine)
            with factory() as session:
                seed_database(session)
                if config.demo_mode:
                    seed_access(session)
            app.state.settings = config
            app.state.session_factory = factory
            app.state.login_attempts = auth.login_attempts()
            egrul, bki = build_integrations(config, factory)
            pipeline = Pipeline(factory, config, egrul, bki)
            app.state.pipeline = pipeline
            pipeline.recover()
            yield
        finally:
            if pipeline is not None:
                await pipeline.cancel_all()
            engine.dispose()

    app = FastAPI(
        title="Умный кредитный кабинет предпринимателя",
        version="1.0.0",
        description="Контракт согласован с веткой frontend. Все данные синтетические.",
        docs_url=None,
        openapi_url="/api/openapi.json",
        redoc_url=None,
        lifespan=lifespan,
    )
    install_error_handlers(app)
    api = APIRouter(prefix="/api", responses=ERROR_RESPONSES)
    for router in (
        applications.router,
        companies.router,
        demo.router,
        feed.router,
        health.router,
        bank.router,
        auth.router,
    ):
        api.include_router(router)
    app.include_router(api)
    app.mount("/api/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")

    @app.get("/api/docs", include_in_schema=False)
    async def swagger_docs():
        return get_swagger_ui_html(
            openapi_url="/api/openapi.json",
            title="Кредитный кабинет — Swagger",
            swagger_js_url="/api/static/swagger/swagger-ui-bundle.js",
            swagger_css_url="/api/static/swagger/swagger-ui.css",
            swagger_favicon_url="data:,",
            swagger_ui_parameters={"validatorUrl": None},
        )

    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=[
            "Content-Type",
            "Idempotency-Key",
            "X-Bank-Token",
            "X-Request-ID",
            "Authorization",
        ],
        expose_headers=["X-Request-ID"],
    )
    return app


app = create_app()
