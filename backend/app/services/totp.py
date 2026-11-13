"""
CipherShield — TOTP (Time-based One-Time Password) Service
Uses pyotp for TOTP secret generation and verification.
"""
from __future__ import annotations

import logging
import secrets
import string
from typing import List
from urllib.parse import quote

import pyotp

from app.services.crypto import generate_backup_codes

logger = logging.getLogger(__name__)

ISSUER_NAME = "CipherShield"
TOTP_DIGITS = 6
TOTP_INTERVAL = 30  # seconds
TOTP_VALID_WINDOW = 1  # allow ±1 interval for clock drift


def generate_totp_secret() -> str:
    """Generate a cryptographically secure TOTP secret (Base32 encoded)."""
    return pyotp.random_base32(length=32)


def generate_totp_qr_uri(secret: str, user_email: str) -> str:
    """Build the otpauth:// URI for QR code rendering."""
    totp = pyotp.TOTP(secret, digits=TOTP_DIGITS, interval=TOTP_INTERVAL)
    uri = totp.provisioning_uri(
        name=user_email,
        issuer_name=ISSUER_NAME,
    )
    return uri


def verify_totp_code(secret: str, code: str) -> bool:
    """
    Verify a 6-digit TOTP code against the secret.
    Allows one-interval window in each direction to account for clock drift.
    """
    if not code or len(code) != 6 or not code.isdigit():
        return False
    totp = pyotp.TOTP(secret, digits=TOTP_DIGITS, interval=TOTP_INTERVAL)
    return totp.verify(code, valid_window=TOTP_VALID_WINDOW)


def get_manual_entry_key(secret: str) -> str:
    """Format secret for manual entry (groups of 4 chars)."""
    return " ".join(secret[i : i + 4] for i in range(0, len(secret), 4))


def generate_fresh_backup_codes() -> List[str]:
    """Generate 10 × 8-character alphanumeric backup codes."""
    return generate_backup_codes(count=10)
