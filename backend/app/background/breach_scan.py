"""
CipherShield — Background Breach Scanner
Periodically checks user accounts against HIBP for newly released breach dumps.
"""
from __future__ import annotations

import asyncio
import logging
from app.config import get_settings
from app.services.supabase_client import get_service_client
from app.services.hibp import get_hibp_service
from app.services.email_service import get_email_service
from app.services.audit_service import log_audit_event

logger = logging.getLogger(__name__)


async def run_periodic_breach_scanner() -> None:
    """
    Background worker loop that scans verified user emails against breach records.
    """
    settings = get_settings()
    hibp = get_hibp_service()
    email_service = get_email_service()

    while True:
        try:
            logger.info("Starting scheduled breach sweep...")
            supabase = get_service_client()
            
            # Retrieve active profiles
            result = await supabase.table("profiles").select("id, email").execute()
            profiles = result.data or []

            for profile in profiles:
                user_id = profile["id"]
                email = profile["email"]
                if not email:
                    continue

                breaches = await hibp.get_email_breaches(email)
                if breaches:
                    latest = breaches[0]
                    breach_name = latest.get("Title", latest.get("Name", "Unknown Breach"))
                    data_classes = latest.get("DataClasses", [])
                    
                    # Create in-app notification
                    await supabase.table("notifications").insert({
                        "user_id": user_id,
                        "type": "breach_alert",
                        "title": f"Security Alert: Email found in {breach_name}",
                        "body": f"Your email was exposed in a breach containing: {', '.join(data_classes[:4])}.",
                        "metadata": {"breach": latest},
                    }).execute()

                    # Audit log
                    await log_audit_event(
                        user_id=user_id,
                        action="security.breach_detected",
                        resource_type="breach",
                        metadata={"breach_name": breach_name},
                    )

                    # Send email alert
                    await email_service.send_breach_alert(email, breach_name, data_classes)

                # Rate limit politeness between checks
                await asyncio.sleep(2.0)

            logger.info("Scheduled breach sweep finished.")
        except Exception as e:
            logger.error("Error in breach scanner background task: %s", e)

        # Sleep for configured interval
        await asyncio.sleep(settings.BREACH_SCAN_INTERVAL_HOURS * 3600)
