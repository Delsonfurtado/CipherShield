"""
CipherShield — Cryptography Unit Tests
"""
from app.services.crypto import (
    generate_backup_codes,
    hash_backup_codes,
    verify_backup_code,
    encrypt_server_secret,
    decrypt_server_secret,
)
from app.services.totp import generate_totp_secret, verify_totp
import pyotp


def test_backup_codes_lifecycle():
    codes = generate_backup_codes(count=5)
    assert len(codes) == 5
    for code in codes:
        assert len(code) == 8

    hashed = hash_backup_codes(codes)
    assert len(hashed) == 5

    # Match first code
    matched, idx = verify_backup_code(codes[0], hashed)
    assert matched is True
    assert idx == 0

    # Match last code
    matched, idx = verify_backup_code(codes[-1], hashed)
    assert matched is True
    assert idx == 4

    # Invalid code
    matched, idx = verify_backup_code("INVALID8", hashed)
    assert matched is False
    assert idx == -1


def test_server_secret_encryption():
    secret = "my-super-secret-totp-seed-12345"
    encrypted = encrypt_server_secret(secret)
    assert encrypted != secret

    decrypted = decrypt_server_secret(encrypted)
    assert decrypted == secret


def test_totp_generation_and_verification():
    secret = generate_totp_secret()
    assert len(secret) == 32

    totp = pyotp.TOTP(secret)
    current_code = totp.now()

    assert verify_totp(secret, current_code) is True
    assert verify_totp(secret, "000000") is False
