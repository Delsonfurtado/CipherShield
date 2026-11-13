"""
CipherShield — FastAPI Application Entry Point
Zero-knowledge Password Security Suite backend.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.dependencies import limiter
from app.middleware import RequestIDMiddleware, SecurityHeadersMiddleware
from app.routers.auth import router as auth_router
from app.routers.generator import router as generator_router
from app.routers.health import router as health_router
from app.routers.vault import router as vault_router
from app.services.mongo import close_mongo, init_mongo

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ciphershield")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager for resource initialization and teardown."""
    settings = get_settings()
    logger.info("Initializing %s v%s...", settings.APP_NAME, settings.APP_VERSION)
    
    await init_mongo()

    yield

    # Teardown
    await close_mongo()
    logger.info("Shutdown completed.")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=f"{settings.APP_NAME} API",
        version=settings.APP_VERSION,
        description="Production-grade Zero-Knowledge Password Security Suite API",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # Set up rate limiter
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Security & Context Middlewares
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestIDMiddleware)

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Process-Time-Ms"],
    )

    # Register Routers
    api_prefix = "/api/v1"
    app.include_router(health_router)
    app.include_router(auth_router, prefix=api_prefix)
    app.include_router(vault_router, prefix=api_prefix)
    app.include_router(generator_router, prefix=api_prefix)

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled exception: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error occurred. Please try again later."},
        )

    return app


app = create_app()
