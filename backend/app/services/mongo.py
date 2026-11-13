"""MongoDB connection lifecycle and collection indexes."""
from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import get_settings

_client: AsyncIOMotorClient | None = None


async def init_mongo() -> None:
    global _client
    settings = get_settings()
    _client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)
    db = get_db()
    await db.command("ping")
    await db.profiles.create_index("email", unique=True)
    await db.vault_items.create_index([("user_id", 1), ("created_at", -1)])
    await db.sessions.create_index([("user_id", 1), ("created_at", -1)])
    await db.audit_logs.create_index([("user_id", 1), ("created_at", -1)])


async def close_mongo() -> None:
    global _client
    if _client:
        _client.close()
    _client = None


def get_db() -> AsyncIOMotorDatabase:
    if _client is None:
        raise RuntimeError("MongoDB is not initialized")
    return _client[get_settings().MONGODB_DATABASE]
