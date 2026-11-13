"""MongoDB-backed authentication and account endpoints."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import jwt
from passlib.context import CryptContext
from app.config import get_settings
from app.dependencies import get_client_ip, get_current_user, limiter
from app.models.auth import ChangeMasterPasswordRequest, DeleteAccountRequest, LoginRequest, RegisterRequest, UpdateProfileRequest
from app.services.audit_service import log_audit_event
from app.services.mongo import get_db

router = APIRouter(prefix="/auth", tags=["Authentication"])
password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def now(): return datetime.now(timezone.utc)
def clean(document):
    document.pop("_id", None); document.pop("password_hash", None)
    document.pop("two_factor_secret", None); document.pop("backup_codes", None)
    return document
def token(profile):
    settings = get_settings()
    claims = {"sub": profile["id"], "email": profile["email"], "role": "authenticated", "aud": "ciphershield", "exp": now() + timedelta(hours=settings.JWT_EXPIRE_HOURS)}
    return jwt.encode(claims, settings.JWT_SECRET, algorithm="HS256")

@router.get("/salt")
async def get_salt_by_email(email: str):
    profile = await get_db().profiles.find_one({"email": email.strip().lower()}, {"argon2_salt": 1, "kdf_params": 1})
    if not profile: raise HTTPException(status_code=404, detail="User not found")
    return {"argon2_salt": profile["argon2_salt"], "kdf_params": profile.get("kdf_params", {})}

@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, payload: RegisterRequest):
    db, email = get_db(), payload.email.strip().lower()
    if await db.profiles.find_one({"email": email}, {"_id": 1}):
        raise HTTPException(status_code=409, detail="An account already exists for this email")
    created, user_id = now(), str(uuid4())
    profile = {"id": user_id, "user_id": user_id, "email": email, "display_name": payload.display_name or email.split("@")[0], "password_hash": password_context.hash(payload.password), "argon2_salt": payload.argon2_salt, "encrypted_vault_key": payload.encrypted_vault_key, "vault_key_iv": payload.kdf_params.get("vault_key_iv", ""), "kdf_params": payload.kdf_params, "two_factor_enabled": False, "inactivity_timeout_minutes": 5, "clipboard_clear_seconds": 30, "created_at": created, "updated_at": created}
    await db.profiles.insert_one(profile)
    await log_audit_event(user_id, "auth.register", ip_address=get_client_ip(request), user_agent=request.headers.get("user-agent"))
    return {"message": "User registered successfully", "user_id": user_id, "email": email}

@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest):
    db = get_db(); profile = await db.profiles.find_one({"email": payload.email.strip().lower()})
    if not profile or not password_context.verify(payload.password, profile["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if profile.get("two_factor_enabled"):
        raise HTTPException(status_code=400, detail="Two-factor login requires completing the 2FA flow")
    access_token = token(profile); created = now()
    await db.sessions.insert_one({"id": str(uuid4()), "user_id": profile["id"], "device_name": request.headers.get("user-agent", "Unknown")[:100], "ip_address": get_client_ip(request), "is_current": True, "created_at": created, "last_active_at": created})
    await log_audit_event(profile["id"], "auth.login", ip_address=get_client_ip(request), user_agent=request.headers.get("user-agent"))
    return {"session": {"access_token": access_token, "refresh_token": "", "expires_in": get_settings().JWT_EXPIRE_HOURS * 3600, "token_type": "bearer"}, "user": clean(profile), "requires_2fa": False}

@router.get("/profile")
async def get_profile(current_user=Depends(get_current_user)):
    profile = await get_db().profiles.find_one({"id": current_user["id"]})
    if not profile: raise HTTPException(status_code=404, detail="Profile not found")
    return clean(profile)

@router.put("/profile")
async def update_profile(payload: UpdateProfileRequest, current_user=Depends(get_current_user)):
    values = {"updated_at": now()}
    if payload.display_name is not None: values["display_name"] = payload.display_name
    if payload.preferences is not None: values["preferences"] = payload.preferences
    await get_db().profiles.update_one({"id": current_user["id"]}, {"$set": values})
    return {"message": "Profile updated successfully"}

@router.post("/change-master-password")
async def change_master_password(payload: ChangeMasterPasswordRequest, current_user=Depends(get_current_user)):
    values = {"encrypted_vault_key": payload.new_encrypted_vault_key, "argon2_salt": payload.new_argon2_salt, "updated_at": now()}
    if payload.new_kdf_params: values["kdf_params"] = payload.new_kdf_params
    await get_db().profiles.update_one({"id": current_user["id"]}, {"$set": values})
    return {"message": "Master password changed and vault key re-wrapped successfully"}

@router.get("/sessions")
async def list_sessions(current_user=Depends(get_current_user)):
    return [clean(row) async for row in get_db().sessions.find({"user_id": current_user["id"]}).sort("created_at", -1)]

@router.delete("/sessions/{session_id}")
async def revoke_session(session_id: str, current_user=Depends(get_current_user)):
    await get_db().sessions.delete_one({"id": session_id, "user_id": current_user["id"]})
    return {"message": "Session revoked"}

@router.delete("/account")
async def delete_account(payload: DeleteAccountRequest, current_user=Depends(get_current_user)):
    db = get_db(); profile = await db.profiles.find_one({"id": current_user["id"]})
    if not profile or not password_context.verify(payload.password, profile["password_hash"]): raise HTTPException(status_code=401, detail="Invalid credentials")
    user_id = current_user["id"]
    for collection in ("vault_items", "item_history", "folders", "tags", "sessions", "audit_logs", "share_links", "notifications"):
        await db[collection].delete_many({"user_id": user_id})
    await db.emergency_contacts.delete_many({"owner_id": user_id})
    await db.profiles.delete_one({"id": user_id})
    return {"message": "Account and all associated encrypted vault items permanently deleted"}
