import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import get_logger, setup_logging
from app.db.session import create_db_engine, create_session_factory, safe_url
from app.schemas import RootResponse
from app.services.health import check_database

logger = get_logger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Application factory. Tests pass their own Settings (temporary database)."""
    settings = settings or get_settings()
    setup_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        engine = create_db_engine(settings.database_url)
        app.state.engine = engine
        app.state.session_factory = create_session_factory(engine)
        logger.info(
            "Starting %s v%s (%s) | database: %s",
            settings.app_name,
            settings.app_version,
            settings.environment,
            safe_url(settings.database_url),
        )
        # Report connectivity at startup, but stay up: /api/health shows the live state.
        try:
            with app.state.session_factory() as session:
                check_database(session)
            logger.info("Database connection verified")
        except Exception:
            logger.error("Database is not reachable at startup; continuing without it")
        try:
            yield
        finally:
            engine.dispose()
            logger.info("Shutdown complete")

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Backend API for the NIRF Insights analytics dashboard (2017-2025).",
        debug=False,  # Starlette's debug mode would return tracebacks; our handlers decide detail.
        lifespan=lifespan,
    )
    app.state.settings = settings

    app.add_middleware(GZipMiddleware, minimum_size=1000)  # the start-up load is ~2 MB of JSON
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            elapsed = (time.perf_counter() - started) * 1000
            logger.error("%s %s -> 500 (%.1f ms)", request.method, request.url.path, elapsed)
            raise
        elapsed = (time.perf_counter() - started) * 1000
        logger.info(
            "%s %s -> %d (%.1f ms)", request.method, request.url.path, response.status_code, elapsed
        )
        return response

    register_exception_handlers(app, debug=settings.debug)
    app.include_router(api_router, prefix=settings.api_prefix)

    @app.get("/", response_model=RootResponse, tags=["Root"], summary="API information")
    def root() -> RootResponse:
        return RootResponse(
            application=settings.app_name,
            version=settings.app_version,
            docs_url="/docs",
            health_url=f"{settings.api_prefix}/health",
        )

    return app


app = create_app()
