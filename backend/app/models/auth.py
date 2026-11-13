"""
CipherShield — Pydantic v2 models for Authentication
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Request models ──────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=12, description="Raw master password (used only to auth with Supabase; vault key is derived client-side)")
    argon2_salt: str = Field(..., description="Base64-encoded Argon2id salt generated client-side")
    encrypted_vault_key: str = Field(..., description="AES-GCM encrypted vault key, Base64 encoded")
    kdf_params: Dict[str, Any] = Field(
        default_factory=lambda: {
            "algorithm": "argon2id",
            "memory": 65536,
            "iterations": 3,
            "parallelism": 4,
            "hash_length": 32,
        }
    )
    display_name: Optional[str] = Field(None, max_length=100)

    @field_validator("argon2_salt")
    @classmethod
    def validate_salt_length(cls, v: str) -> str:
        import base64
        try:
            decoded = base64.b64decode(v + "==")
            if len(decoded) < 16:
                raise ValueError("Salt must be at least 16 bytes")
        except Exception:
            raise ValueError("argon2_salt must be valid base64")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    totp_code: Optional[str] = Field(None, pattern=r"^\d{6}$", description="6-digit TOTP code if 2FA enabled")
    backup_code: Optional[str] = Field(None, min_length=8, max_length=8)


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None


class TOTPVerifyRequest(BaseModel):
    code: str = Field(..., pattern=r"^\d{6}$")


class TOTPDisableRequest(BaseModel):
    code: str = Field(..., pattern=r"^\d{6}$")
    password: str


class BackupCodeVerifyRequest(BaseModel):
    backup_code: str = Field(..., min_length=8, max_length=8)


class ChangeMasterPasswordRequest(BaseModel):
    current_password: str
    new_encrypted_vault_key: str = Field(..., description="Re-wrapped vault key with new master password")
    new_argon2_salt: str
    new_kdf_params: Optional[Dict[str, Any]] = None


class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = Field(None, max_length=100)
    avatar_url: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None


class DeleteAccountRequest(BaseModel):
    password: str
    confirmation: str = Field(..., description="Must equal 'DELETE MY ACCOUNT'")

    @field_validator("confirmation")
    @classmethod
    def check_confirmation(cls, v: str) -> str:
        if v != "DELETE MY ACCOUNT":
            raise ValueError("confirmation must be exactly 'DELETE MY ACCOUNT'")
        return v


# ── Response models ──────────────────────────────────────────────────────────

class UserProfile(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    argon2_salt: str
    encrypted_vault_key: str
    kdf_params: Dict[str, Any]
    two_factor_enabled: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    preferences: Optional[Dict[str, Any]] = None


class AuthSession(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    session: AuthSession
    user: UserProfile
    requires_2fa: bool = False


class TOTPSetupResponse(BaseModel):
    secret: str
    qr_code_uri: str
    manual_entry_key: str


class BackupCodesResponse(BaseModel):
    backup_codes: List[str]
    generated_at: datetime


class SessionInfo(BaseModel):
    id: str
    created_at: datetime
    last_seen_at: Optional[datetime] = None
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    is_current: bool = False


class MessageResponse(BaseModel):
    message: str
    success: bool = True
