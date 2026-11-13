"""
CipherShield — Password Generator & Crypto Tests
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "CipherShield"


@pytest.mark.asyncio
async def test_password_generator_random(client: AsyncClient):
    response = await client.get("/api/v1/generator/generate?mode=random&length=24")
    assert response.status_code == 200
    data = response.json()
    assert len(data["password"]) == 24
    assert data["entropy_bits"] > 100
    assert data["score"] >= 3


@pytest.mark.asyncio
async def test_password_generator_passphrase(client: AsyncClient):
    response = await client.get("/api/v1/generator/generate?mode=passphrase&word_count=5&separator=-")
    assert response.status_code == 200
    data = response.json()
    words = data["password"].split("-")
    assert len(words) == 5
    assert data["entropy_bits"] > 40
