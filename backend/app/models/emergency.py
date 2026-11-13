"""
CipherShield — Pydantic v2 models for Emergency Access
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class EmergencyAccessStatus(str, Enum):
    INVITED = "invited"
    ACCEPTED = "accepted"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class EmergencyAccessLevel(str, Enum):
    VIEW = "view"
    TAKEOVER = "takeover"


class EmergencyContactCreate(BaseModel):
    grantee_email: EmailStr
    access_level: EmergencyAccessLevel = EmergencyAccessLevel.VIEW
    wait_time_hours: int = Field(72, ge=0, le=720, description="Hours owner has to reject before auto-approve")


class EmergencyContact(BaseModel):
    id: UUID
    grantor_id: str
    grantee_id: Optional[str] = None
    grantee_email: str
    access_level: EmergencyAccessLevel
    status: EmergencyAccessStatus
    wait_time_hours: int
    request_initiated_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class EmergencyContactListResponse(BaseModel):
    contacts: List[EmergencyContact]
    total: int
