"""
CipherShield — Breach & Leak Monitoring Router
k-anonymity Pwned Passwords lookups and cached dark-web email exposure checks.
"""
from __future__ import annotations

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.dependencies import get_current_user, limiter
from app.services.hibp import get_hibp_service
from app.services.supabase_client import get_service_client

router = APIRouter(prefix="/breach", tags=["Breach Monitoring"])


@router.get("/pwned-password")
async def check_pwned_password(
    hash_prefix: str = Query(..., min_length=5, max_length=5, description="First 5 hexadecimal characters of the SHA-1 hash"),
):
    """
    Zero-knowledge password breach lookup via HIBP k-anonymity.
    The client hashes the candidate password with SHA-1, sends only the first 5 characters here,
    and searches the returned hash suffixes locally in the browser.
    The server and network never see the password or its full hash.
    """
    hibp = get_hibp_service()
    try:
        raw_response = await hibp.check_password_hash_range(hash_prefix)
        return Response(content=raw_response, media_type="text/plain")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.get("/email-breach")
async def check_email_breach(
    email: str = Query(..., description="Email address to check for data exposures"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Check if an email address appears in publicly known data breaches.
    Cached locally in PostgreSQL to prevent rate-limit exhaustion.
    """
    hibp = get_hibp_service()
    breaches = await hibp.get_email_breaches(email)
    return {
        "email": email,
        "breach_count": len(breaches),
        "breaches": breaches,
    }


@router.post("/scan")
async def trigger_user_breach_scan(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Force a re-scan of the current user's primary email against breach registries.
    """
    hibp = get_hibp_service()
    email = current_user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="User has no email associated")

    breaches = await hibp.get_email_breaches(email, force_refresh=True)
    return {
        "status": "completed",
        "email": email,
        "breaches_found": len(breaches),
        "breaches": breaches,
    }
