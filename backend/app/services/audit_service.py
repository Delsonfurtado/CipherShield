"""
CipherShield — Audit Logging Service
Tamper-evident audit log recorder for all sensitive actions and security events.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional
from uuid import UUID

from app.services.mongo import get_db

logger = logging.getLogger(__name__)


async def log_audit_event(
    user_id: str,
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str | UUID] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Log an event into the immutable audit_logs collection.
    """
    try:
        db = get_db()
        row = {
            "user_id": user_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": str(resource_id) if resource_id else None,
            "ip_address": ip_address,
            "device": user_agent[:255] if user_agent else None,
            "metadata": metadata or {},
        }
        await db.audit_logs.insert_one(row)
    except Exception as e:
        logger.error("Failed to write audit log for user %s, action %s: %s", user_id, action, e)
