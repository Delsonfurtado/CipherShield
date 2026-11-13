"""
CipherShield — Background Cleanup Service
Permanently purges expired share links and soft-deleted items past retention.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from app.services.supabase_client import get_service_client

logger = logging.getLogger(__name__)


async def run_periodic_cleanup() -> None:
    """Run routine database cleanup every hour."""
    while True:
        try:
            supabase = get_service_client()
            now = datetime.now(timezone.utc).isoformat()

            # Mark expired share links as destroyed
            await supabase.table("share_links").update({
                "is_destroyed": True
            }).lt("expires_at", now).eq("is_destroyed", False).execute()

            # Call RPC to purge trash older than 30 days
            try:
                await supabase.rpc("cleanup_deleted_items").execute()
            except Exception as e:
                logger.debug("RPC cleanup_deleted_items: %s", e)

        except Exception as e:
            logger.error("Error running periodic cleanup task: %s", e)

        # Run every hour
        await asyncio.sleep(3600)
