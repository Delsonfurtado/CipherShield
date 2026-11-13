"""
CipherShield — Pydantic v2 models for Share Links
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ShareLinkCreate(BaseModel):
    encrypted_data: str = Field(..., description="Encrypted payload to share")
    max_views: Optional[int] = Field(None, ge=1, le=1000)
    expires_in_hours: int = Field(24, ge=1, le=720)
    require_password: bool = False
    encrypted_access_password: Optional[str] = None  # hashed server-side


class ShareLink(BaseModel):
    id: UUID
    user_id: str
    encrypted_data: str
    view_count: int = 0
    max_views: Optional[int] = None
    expires_at: datetime
    is_active: bool = True
    created_at: datetime
    share_url: str


class ShareLinkPublic(BaseModel):
    """Data returned to a viewer — no user_id exposed."""
    id: UUID
    encrypted_data: str
    view_count: int
    max_views: Optional[int] = None
    expires_at: datetime


class ShareLinkListResponse(BaseModel):
    links: List[ShareLink]
    total: int
