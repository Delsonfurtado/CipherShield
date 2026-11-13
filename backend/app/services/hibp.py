"""
CipherShield — Have I Been Pwned (HIBP) Service
Integrates k-anonymity Pwned Passwords and Breached Account lookups with caching.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
import httpx

from app.config import get_settings
from app.services.supabase_client import get_service_client

logger = logging.getLogger(__name__)


class HIBPService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def check_password_hash_range(self, prefix: str) -> str:
        """
        Query HIBP Pwned Passwords using 5-character SHA-1 hash prefix (k-anonymity).
        The server never receives the full password or full hash.
        Returns the raw multi-line response (suffix:count).
        """
        prefix = prefix.strip().upper()
        if len(prefix) != 5:
            raise ValueError("Hash prefix must be exactly 5 hexadecimal characters.")

        url = f"{self.settings.HIBP_PWNED_PASSWORDS_URL}/range/{prefix}"
        headers = {
            "User-Agent": "CipherShield-Password-Manager",
            "Add-Padding": "true",  # Resists traffic analysis
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                logger.error("HIBP Range API returned %s: %s", resp.status_code, resp.text)
                return ""
            return resp.text

    async def get_email_breaches(self, email: str, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """
        Check if an email has been exposed in known data breaches.
        Utilizes local database cache (breach_cache) to minimize API hits and respect rate limits.
        """
        email_clean = email.strip().lower()
        now = datetime.now(timezone.utc)

        # 1. Check database cache unless force_refresh is requested
        supabase = get_service_client()
        if not force_refresh:
            try:
                cached = await supabase.table("breach_cache").select("*").eq("email", email_clean).maybe_single().execute()
                if cached and cached.data:
                    checked_at = datetime.fromisoformat(cached.data["checked_at"].replace("Z", "+00:00"))
                    ttl = timedelta(hours=self.settings.BREACH_CACHE_TTL_HOURS)
                    if now - checked_at < ttl:
                        return cached.data.get("breaches", [])
            except Exception as e:
                logger.warning("Error reading breach cache: %s", e)

        # 2. Query HIBP API if API key is configured
        if not self.settings.HIBP_API_KEY:
            logger.info("HIBP_API_KEY is not configured; returning mock/sample breach data for dev.")
            # Return empty or minimal structure in dev when no key is provided
            return []

        url = f"{self.settings.HIBP_API_BASE_URL}/breachedaccount/{email_clean}?truncateResponse=false"
        headers = {
            "hibp-api-key": self.settings.HIBP_API_KEY,
            "User-Agent": "CipherShield-Security-Suite",
        }

        breaches: List[Dict[str, Any]] = []
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                breaches = resp.json()
            elif resp.status_code == 404:
                breaches = []  # No breaches found
            elif resp.status_code == 429:
                logger.warning("HIBP rate limit encountered.")
            else:
                logger.error("HIBP API error %s: %s", resp.status_code, resp.text)

        # 3. Upsert into breach_cache
        try:
            await supabase.table("breach_cache").upsert({
                "email": email_clean,
                "breaches": breaches,
                "checked_at": now.isoformat(),
            }, on_conflict="email").execute()
        except Exception as e:
            logger.warning("Error saving to breach_cache: %s", e)

        return breaches


_hibp_service: Optional[HIBPService] = None


def get_hibp_service() -> HIBPService:
    global _hibp_service
    if _hibp_service is None:
        _hibp_service = HIBPService()
    return _hibp_service
