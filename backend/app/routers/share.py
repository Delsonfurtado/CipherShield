"""
CipherShield — Encrypted Share Links Router
Zero-knowledge ephemeral shares: Decryption key is in the client URL fragment (#key=...)
and is never transmitted to the server.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, status
from passlib.hash import pbkdf2_sha256

from app.dependencies import get_current_user
from app.models.share import ShareLinkCreate, ShareLinkPublic
from app.services.audit_service import log_audit_event
from app.services.supabase_client import get_service_client

router = APIRouter(prefix="/share", tags=["Share"])


@router.post("/links", status_code=status.HTTP_201_CREATED)
async def create_share_link(
    payload: ShareLinkCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Store an encrypted share blob.
    The secret key is embedded by the sender into the URL fragment (#key=...)
    so the backend cannot decrypt the payload.
    """
    supabase = get_service_client()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=payload.expires_in_hours)
    link_id = str(uuid4())

    passphrase_hash = None
    if payload.require_password and payload.encrypted_access_password:
        passphrase_hash = pbkdf2_sha256.hash(payload.encrypted_access_password)

    row = {
        "id": link_id,
        "user_id": current_user["id"],
        "encrypted_data": payload.encrypted_data,
        "iv": payload.encrypted_data.split(".")[0] if "." in payload.encrypted_data else "",
        "has_passphrase": bool(payload.require_password),
        "passphrase_hash": passphrase_hash,
        "max_views": payload.max_views,
        "view_count": 0,
        "expires_at": expires_at.isoformat(),
        "is_destroyed": False,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }

    await supabase.table("share_links").insert(row).execute()

    await log_audit_event(
        user_id=current_user["id"],
        action="share.link_created",
        resource_type="share_link",
        resource_id=link_id,
    )

    return {
        "id": link_id,
        "expires_at": row["expires_at"],
        "max_views": payload.max_views,
        "requires_passphrase": bool(payload.require_password),
    }


@router.get("/links/{link_id}", response_model=ShareLinkPublic)
async def get_shared_item(link_id: str, passphrase: Optional[str] = None):
    """
    Public recipient endpoint: Retrieve encrypted payload.
    Increments view count and auto-destroys if max_views is reached.
    """
    supabase = get_service_client()
    res = await supabase.table("share_links").select("*").eq("id", link_id).eq("is_destroyed", False).single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Share link not found, expired, or already destroyed")

    data = res.data
    now = datetime.now(timezone.utc)
    expires_at = datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00"))

    if now > expires_at:
        await supabase.table("share_links").update({"is_destroyed": True}).eq("id", link_id).execute()
        raise HTTPException(status_code=410, detail="This share link has expired")

    if data.get("has_passphrase"):
        if not passphrase:
            raise HTTPException(status_code=401, detail="Passphrase required to access this item")
        if not pbkdf2_sha256.verify(passphrase, data.get("passphrase_hash", "")):
            raise HTTPException(status_code=401, detail="Incorrect passphrase")

    new_count = (data.get("view_count") or 0) + 1
    max_views = data.get("max_views")
    is_destroyed = False
    if max_views and new_count >= max_views:
        is_destroyed = True

    await supabase.table("share_links").update({
        "view_count": new_count,
        "is_destroyed": is_destroyed,
        "updated_at": now.isoformat(),
    }).eq("id", link_id).execute()

    return ShareLinkPublic(
        id=UUID(data["id"]),
        encrypted_data=data["encrypted_data"],
        view_count=new_count,
        max_views=max_views,
        expires_at=expires_at,
    )


@router.get("/links")
async def list_user_shares(current_user: Dict[str, Any] = Depends(get_current_user)):
    """List links created by the current user."""
    supabase = get_service_client()
    res = await supabase.table("share_links").select("*").eq("user_id", current_user["id"]).order("created_at", desc=True).execute()
    return res.data or []


@router.delete("/links/{link_id}")
async def revoke_share_link(link_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Prematurely destroy a share link."""
    supabase = get_service_client()
    await supabase.table("share_links").update({"is_destroyed": True}).eq("id", link_id).eq("user_id", current_user["id"]).execute()

    await log_audit_event(
        user_id=current_user["id"],
        action="share.link_destroyed",
        resource_type="share_link",
        resource_id=link_id,
    )
    return {"message": "Share link destroyed"}
