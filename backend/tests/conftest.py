"""
CipherShield — Pytest Configuration & Test Fixtures
"""
import pytest
import os
from typing import AsyncGenerator
import httpx

# Set test environment variables before importing app
os.environ["ENVIRONMENT"] = "development"
os.environ["DEBUG"] = "true"
os.environ["SUPABASE_URL"] = "https://mock-test.supabase.co"
os.environ["SUPABASE_ANON_KEY"] = "mock-anon-key"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "mock-service-role-key"
os.environ["SUPABASE_JWT_SECRET"] = "super-secret-test-jwt-secret-with-sufficient-length-32b"
os.environ["SECRET_KEY"] = "super-secret-test-server-key-minimum-32-chars-long"

from app.main import app


@pytest.fixture
async def client() -> AsyncGenerator[httpx.AsyncClient, None]:
    async with httpx.AsyncClient(app=app, base_url="http://testserver") as ac:
        yield ac
