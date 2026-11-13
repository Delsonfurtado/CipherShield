"""
CipherShield — Supabase client singleton
Provides both anon (user-scoped) and service-role (admin) clients.
"""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import Optional

from supabase import acreate_client
from supabase._async.client import AsyncClient
from supabase.lib.client_options import ClientOptions

from app.config import get_settings

logger = logging.getLogger(__name__)

# Module-level singletons populated on startup
_anon_client: Optional[AsyncClient] = None
_service_client: Optional[AsyncClient] = None


async def init_supabase() -> None:
    """Call once at app startup to initialise both clients."""
    global _anon_client, _service_client

    settings = get_settings()

    if not settings.USE_SUPABASE:
        logger.info("Supabase disabled; local-only mode is using browser storage.")
        return

    missing = [
        name for name, value in (
            ("SUPABASE_URL", settings.SUPABASE_URL),
            ("SUPABASE_ANON_KEY", settings.SUPABASE_ANON_KEY),
            ("SUPABASE_SERVICE_ROLE_KEY", settings.SUPABASE_SERVICE_ROLE_KEY),
            ("SUPABASE_JWT_SECRET", settings.SUPABASE_JWT_SECRET),
        ) if not value
    ]
    if missing:
        raise RuntimeError("Supabase is enabled but these settings are missing: " + ", ".join(missing))

    logger.info("Initialising Supabase clients…")

    _anon_client = await acreate_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_ANON_KEY,
        options=ClientOptions(
            postgrest_client_timeout=10,
            storage_client_timeout=30,
        ),
    )

    _service_client = await acreate_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY,
        options=ClientOptions(
            postgrest_client_timeout=10,
            storage_client_timeout=30,
        ),
    )

    logger.info("Supabase clients initialised ✓")


async def close_supabase() -> None:
    """Call once at app shutdown."""
    global _anon_client, _service_client
    # supabase-py v2 async clients don't expose an explicit close;
    # underlying httpx sessions are managed internally.
    _anon_client = None
    _service_client = None
    logger.info("Supabase clients closed ✓")


def get_anon_client() -> AsyncClient:
    if _anon_client is None:
        raise RuntimeError("Supabase anon client not initialised. Call init_supabase() first.")
    return _anon_client


def get_service_client() -> AsyncClient:
    if _service_client is None:
        raise RuntimeError("Supabase service client not initialised. Call init_supabase() first.")
    return _service_client
