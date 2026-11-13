"""
CipherShield — Server-side Cryptography Utilities

NOTE: The vault is zero-knowledge — all vault content is encrypted/decrypted
      client-side. This module only handles server-side concerns:
        • Generating secure random tokens
        • Hashing / verifying backup codes (Argon2id)
        • Encrypting sensitive server-side data (TOTP secrets) with AES-256-GCM
"""
from __future__ import annotations

import base64
import logging
import os
import secrets
import string
from typing import List, Tuple

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import get_settings

logger = logging.getLogger(__name__)

# Argon2id hasher tuned for backup-code hashing (lighter than login KDF)
_ph = PasswordHasher(
    time_cost=2,
    memory_cost=32768,  # 32 MiB
    parallelism=2,
    hash_len=32,
    salt_len=16,
)

BACKUP_CODE_LENGTH = 8
BACKUP_CODE_COUNT = 10
BACKUP_CODE_ALPHABET = string.ascii_uppercase + string.digits


# ── Random token helpers ─────────────────────────────────────────────────────

def generate_secure_token(byte_length: int = 32) -> str:
    """Return URL-safe base64 encoded random token."""
    return secrets.token_urlsafe(byte_length)


def generate_secure_bytes(length: int = 32) -> bytes:
    return os.urandom(length)


# ── Backup codes ─────────────────────────────────────────────────────────────

def generate_backup_codes(count: int = BACKUP_CODE_COUNT) -> List[str]:
    """Generate *count* plaintext backup codes (displayed to user once)."""
    return [
        "".join(secrets.choice(BACKUP_CODE_ALPHABET) for _ in range(BACKUP_CODE_LENGTH))
        for _ in range(count)
    ]


def hash_backup_codes(codes: List[str]) -> List[str]:
    """Hash each backup code with Argon2id. Store hashes, not plaintext."""
    return [_ph.hash(code) for code in codes]


def verify_backup_code(plaintext: str, hashed_codes: List[str]) -> Tuple[bool, int]:
    """
    Check *plaintext* against each hash. Returns (matched, index_of_matched_hash).
    Returns (False, -1) if no match.
    """
    for idx, hashed in enumerate(hashed_codes):
        try:
            if _ph.verify(hashed, plaintext):
                return True, idx
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            continue
    return False, -1


# ── AES-256-GCM encryption (server-side secrets only) ───────────────────────

def _derive_server_key() -> bytes:
    """Derive a 32-byte AES key from SECRET_KEY using HKDF."""
    from cryptography.hazmat.primitives.kdf.hkdf import HKDF
    from cryptography.hazmat.primitives import hashes

    settings = get_settings()
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"ciphershield-server-key-v1",
        info=b"server-side-encryption",
    )
    return hkdf.derive(settings.SECRET_KEY.encode())


def encrypt_server_secret(plaintext: str) -> str:
    """
    Encrypt plaintext with AES-256-GCM using the server SECRET_KEY.
    Returns base64(nonce || ciphertext_with_tag).
    """
    key = _derive_server_key()
    nonce = os.urandom(12)  # 96-bit nonce for GCM
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)
    combined = nonce + ciphertext
    return base64.b64encode(combined).decode()


def decrypt_server_secret(encoded: str) -> str:
    """
    Decrypt a value produced by encrypt_server_secret.
    Raises ValueError on decryption failure.
    """
    try:
        key = _derive_server_key()
        combined = base64.b64decode(encoded)
        nonce, ciphertext = combined[:12], combined[12:]
        aesgcm = AESGCM(key)
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext.decode()
    except Exception as exc:
        logger.error("Failed to decrypt server secret: %s", exc)
        raise ValueError("Decryption failed") from exc
