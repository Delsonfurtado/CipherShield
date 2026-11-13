"""
CipherShield — Audit Log Query Router
Immutable history of account operations, views, shares, and logins.
"""
from __future__ import annotations

import math
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user
from app.models.audit import AuditLogListResponse
from app.services.supabase_client import get_service_client

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/logs", response_model=AuditLogListResponse)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=10, le=200),
    action: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Retrieve paginated immutable audit logs for the authenticated user."""
    supabase = get_service_client()
    offset = (page - 1) * per_page

    query = supabase.table("audit_logs").select("*", count="exact").eq("user_id", current_user["id"])
    if action:
        query = query.ilike("action", f"%{action}%")

    res = await query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()

    total = res.count or 0
    total_pages = math.ceil(total / per_page) if per_page else 1

    return AuditLogListResponse(
        logs=res.data or [],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )
