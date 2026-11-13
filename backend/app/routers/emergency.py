"""
CipherShield — Emergency Access Router
Digital inheritance and designated trusted contacts with dispute waiting periods.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_user
from app.models.emergency import (
    EmergencyAccessLevel,
    EmergencyAccessStatus,
    EmergencyContactCreate,
)
from app.services.audit_service import log_audit_event
from app.services.email_service import get_email_service
from app.services.supabase_client import get_service_client

router = APIRouter(prefix="/emergency", tags=["Emergency Access"])


@router.get("/contacts")
async def list_emergency_contacts(current_user: Dict[str, Any] = Depends(get_current_user)):
    """List contacts designated by the user or where the user is a grantee."""
    supabase = get_service_client()
    user_id = current_user["id"]
    res = await supabase.table("emergency_contacts").select("*").eq("owner_id", user_id).execute()
    return res.data or []


@router.post("/contacts", status_code=status.HTTP_201_CREATED)
async def add_emergency_contact(
    payload: EmergencyContactCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Designate a trusted contact with a waiting period (e.g. 48 hours to 30 days)."""
    supabase = get_service_client()
    now = datetime.now(timezone.utc).isoformat()
    contact_id = str(uuid4())

    row = {
        "id": contact_id,
        "owner_id": current_user["id"],
        "contact_email": payload.grantee_email.strip().lower(),
        "waiting_period_hours": payload.wait_time_hours,
        "status": EmergencyAccessStatus.INVITED.value,
        "created_at": now,
        "updated_at": now,
    }

    await supabase.table("emergency_contacts").insert(row).execute()

    await log_audit_event(
        user_id=current_user["id"],
        action="emergency.contact_added",
        resource_type="emergency_contact",
        resource_id=contact_id,
    )
    return row


@router.delete("/contacts/{contact_id}")
async def remove_emergency_contact(contact_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Remove a designated emergency contact."""
    supabase = get_service_client()
    await supabase.table("emergency_contacts").delete().eq("id", contact_id).eq("owner_id", current_user["id"]).execute()

    await log_audit_event(
        user_id=current_user["id"],
        action="emergency.contact_removed",
        resource_type="emergency_contact",
        resource_id=contact_id,
    )
    return {"message": "Emergency contact removed"}


@router.post("/contacts/{contact_id}/request")
async def initiate_access_request(contact_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    """The grantee initiates an emergency access request."""
    supabase = get_service_client()
    now = datetime.now(timezone.utc)

    res = await supabase.table("emergency_contacts").select("*").eq("id", contact_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact = res.data
    owner_id = contact["owner_id"]
    wait_hours = contact.get("waiting_period_hours", 48)

    await supabase.table("emergency_contacts").update({
        "status": EmergencyAccessStatus.PENDING_APPROVAL.value,
        "request_initiated_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }).eq("id", contact_id).execute()

    # Get owner email
    owner_res = await supabase.table("profiles").select("email").eq("id", owner_id).single().execute()
    if owner_res.data:
        email_svc = get_email_service()
        await email_svc.send_emergency_access_alert(
            owner_email=owner_res.data["email"],
            contact_email=contact["contact_email"],
            wait_hours=wait_hours,
            approve_url=f"/emergency?action=approve&id={contact_id}",
            reject_url=f"/emergency?action=reject&id={contact_id}",
        )

    await log_audit_event(
        user_id=owner_id,
        action="emergency.access_requested",
        resource_type="emergency_contact",
        resource_id=contact_id,
    )

    return {"message": "Emergency access request started. Waiting period initiated."}


@router.post("/contacts/{contact_id}/approve")
async def approve_access_request(contact_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Owner approves emergency access request."""
    supabase = get_service_client()
    now = datetime.now(timezone.utc).isoformat()

    await supabase.table("emergency_contacts").update({
        "status": EmergencyAccessStatus.APPROVED.value,
        "approved_at": now,
        "updated_at": now,
    }).eq("id", contact_id).eq("owner_id", current_user["id"]).execute()

    await log_audit_event(
        user_id=current_user["id"],
        action="emergency.access_approved",
        resource_type="emergency_contact",
        resource_id=contact_id,
    )
    return {"message": "Emergency access approved"}


@router.post("/contacts/{contact_id}/reject")
async def reject_access_request(contact_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Owner rejects emergency access request."""
    supabase = get_service_client()
    now = datetime.now(timezone.utc).isoformat()

    await supabase.table("emergency_contacts").update({
        "status": EmergencyAccessStatus.REJECTED.value,
        "updated_at": now,
    }).eq("id", contact_id).eq("owner_id", current_user["id"]).execute()

    await log_audit_event(
        user_id=current_user["id"],
        action="emergency.access_rejected",
        resource_type="emergency_contact",
        resource_id=contact_id,
    )
    return {"message": "Emergency access request rejected"}
