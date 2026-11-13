"""
CipherShield — Pydantic v2 models for Audit Logs
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class AuditAction(str, Enum):
    # Auth
    LOGIN = "auth.login"
    LOGOUT = "auth.logout"
    REGISTER = "auth.register"
    LOGIN_FAILED = "auth.login_failed"
    PASSWORD_CHANGED = "auth.password_changed"
    TOTP_ENABLED = "auth.2fa_enabled"
    TOTP_DISABLED = "auth.2fa_disabled"
    BACKUP_CODES_REGENERATED = "auth.backup_codes_regenerated"
    # Vault
    VAULT_ITEM_CREATED = "vault.item_created"
    VAULT_ITEM_UPDATED = "vault.item_updated"
    VAULT_ITEM_DELETED = "vault.item_deleted"
    VAULT_ITEM_RESTORED = "vault.item_restored"
    VAULT_ITEM_PERMANENT_DELETED = "vault.item_permanent_deleted"
    VAULT_ITEM_VIEWED = "vault.item_viewed"
    # Share
    SHARE_LINK_CREATED = "share.link_created"
    SHARE_LINK_DESTROYED = "share.link_destroyed"
    SHARE_LINK_ACCESSED = "share.link_accessed"
    # Emergency
    EMERGENCY_CONTACT_ADDED = "emergency.contact_added"
    EMERGENCY_CONTACT_REMOVED = "emergency.contact_removed"
    EMERGENCY_ACCESS_REQUESTED = "emergency.access_requested"
    EMERGENCY_ACCESS_APPROVED = "emergency.access_approved"
    EMERGENCY_ACCESS_REJECTED = "emergency.access_rejected"
    # Security
    BREACH_DETECTED = "security.breach_detected"
    ACCOUNT_DELETED = "security.account_deleted"


class AuditLog(BaseModel):
    id: UUID
    user_id: str
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime


class AuditLogListResponse(BaseModel):
    logs: List[AuditLog]
    total: int
    page: int
    per_page: int
    total_pages: int
