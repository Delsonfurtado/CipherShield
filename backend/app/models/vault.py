"""
CipherShield — Pydantic v2 models for Vault items
All vault content is encrypted client-side; server stores opaque ciphertext.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class VaultItemType(str, Enum):
    LOGIN = "login"
    SECURE_NOTE = "secure_note"
    CREDIT_CARD = "credit_card"
    IDENTITY = "identity"
    SSH_KEY = "ssh_key"
    API_KEY = "api_key"
    CUSTOM = "custom"


class BulkOperation(str, Enum):
    DELETE = "delete"
    RESTORE = "restore"
    MOVE = "move"
    TAG = "tag"
    UNTAG = "untag"
    PERMANENT_DELETE = "permanent_delete"


# ── Vault Item ──────────────────────────────────────────────────────────────

class VaultItemCreate(BaseModel):
    encrypted_data: str = Field(..., description="AES-GCM encrypted JSON blob, Base64")
    item_type: VaultItemType = VaultItemType.LOGIN
    folder_id: Optional[UUID] = None
    tag_ids: List[UUID] = Field(default_factory=list)
    is_favorite: bool = False
    client_updated_at: Optional[datetime] = None


class VaultItemUpdate(BaseModel):
    encrypted_data: Optional[str] = None
    item_type: Optional[VaultItemType] = None
    folder_id: Optional[UUID] = None
    tag_ids: Optional[List[UUID]] = None
    is_favorite: Optional[bool] = None
    client_updated_at: Optional[datetime] = None


class VaultItem(BaseModel):
    id: UUID
    user_id: str
    encrypted_data: str
    item_type: VaultItemType
    folder_id: Optional[UUID] = None
    tag_ids: List[UUID] = Field(default_factory=list)
    is_favorite: bool = False
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    client_updated_at: Optional[datetime] = None


class VaultItemHistory(BaseModel):
    id: UUID
    item_id: UUID
    encrypted_data: str
    version: int
    created_at: datetime
    created_by_ip: Optional[str] = None


class VaultItemListResponse(BaseModel):
    items: List[VaultItem]
    total: int
    page: int = 1
    per_page: int = 100


# ── Folders ──────────────────────────────────────────────────────────────────

class FolderCreate(BaseModel):
    encrypted_name: str = Field(..., description="Encrypted folder name")
    parent_id: Optional[UUID] = None
    icon: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


class FolderUpdate(BaseModel):
    encrypted_name: Optional[str] = None
    parent_id: Optional[UUID] = None
    icon: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


class Folder(BaseModel):
    id: UUID
    user_id: str
    encrypted_name: str
    parent_id: Optional[UUID] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    item_count: int = 0
    created_at: datetime
    updated_at: datetime


# ── Tags ─────────────────────────────────────────────────────────────────────

class TagCreate(BaseModel):
    encrypted_name: str
    color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


class Tag(BaseModel):
    id: UUID
    user_id: str
    encrypted_name: str
    color: Optional[str] = None
    item_count: int = 0
    created_at: datetime


# ── Bulk Operations ───────────────────────────────────────────────────────────

class BulkOperationRequest(BaseModel):
    item_ids: List[UUID] = Field(..., min_length=1, max_length=200)
    operation: BulkOperation
    target_folder_id: Optional[UUID] = None
    tag_id: Optional[UUID] = None


class BulkOperationResponse(BaseModel):
    success_count: int
    failed_ids: List[str] = Field(default_factory=list)
    message: str
