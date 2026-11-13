"""
CipherShield — In-App Notifications Router
"""
from __future__ import annotations

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.services.supabase_client import get_service_client

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/")
async def list_notifications(
    unread_only: bool = False,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List in-app alerts and security warnings."""
    supabase = get_service_client()
    query = supabase.table("notifications").select("*").eq("user_id", current_user["id"])
    if unread_only:
        query = query.eq("is_read", False)

    res = await query.order("created_at", desc=True).limit(50).execute()
    return res.data or []


@router.put("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Mark a notification as read."""
    supabase = get_service_client()
    await supabase.table("notifications").update({"is_read": True}).eq("id", notification_id).eq("user_id", current_user["id"]).execute()
    return {"message": "Notification marked as read"}


@router.put("/read-all")
async def mark_all_notifications_read(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Mark all notifications as read."""
    supabase = get_service_client()
    await supabase.table("notifications").update({"is_read": True}).eq("user_id", current_user["id"]).execute()
    return {"message": "All notifications marked as read"}
