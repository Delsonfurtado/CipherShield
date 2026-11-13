"""
CipherShield Backend Configuration
Pydantic Settings v2 — reads from .env
"""
from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import AnyHttpUrl, EmailStr, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────────
    APP_NAME: str = "CipherShield"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = Field(default=False, validation_alias="CIPHERSHIELD_DEBUG")
    ENVIRONMENT: str = "production"  # development | staging | production

    # ── Supabase ─────────────────────────────────────────────────────────────
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DATABASE: str = "ciphershield"
    JWT_SECRET: str = ""
    JWT_EXPIRE_HOURS: int = 168

    # ── Security ─────────────────────────────────────────────────────────────
    SECRET_KEY: str = ""  # used for server-side symmetric encryption (TOTP secrets, etc.)
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    # ── HIBP ─────────────────────────────────────────────────────────────────
    HIBP_API_KEY: str = ""
    HIBP_API_BASE_URL: str = "https://haveibeenpwned.com/api/v3"
    HIBP_PWNED_PASSWORDS_URL: str = "https://api.pwnedpasswords.com"

    # ── SMTP / Email ──────────────────────────────────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@ciphershield.app"
    SMTP_FROM_NAME: str = "CipherShield"
    SMTP_TLS: bool = True

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_REGISTER: str = "3/minute"
    RATE_LIMIT_DEFAULT: str = "60/minute"
    RATE_LIMIT_BREACH: str = "10/minute"

    # ── Share Links ───────────────────────────────────────────────────────────
    SHARE_LINK_MAX_EXPIRY_DAYS: int = 30
    SHARE_LINK_DEFAULT_EXPIRY_HOURS: int = 24

    # ── Background Tasks ──────────────────────────────────────────────────────
    BREACH_SCAN_INTERVAL_HOURS: int = 24
    BREACH_CACHE_TTL_HOURS: int = 12

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v: str | List[str]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
