"""MongoDB storage for opaque, client-encrypted vault records."""
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.dependencies import get_current_user
from app.models.vault import BulkOperation, BulkOperationRequest, FolderCreate, FolderUpdate, TagCreate, VaultItemCreate, VaultItemUpdate
from app.services.audit_service import log_audit_event
from app.services.mongo import get_db

router = APIRouter(prefix="/vault", tags=["Vault"])
def now(): return datetime.now(timezone.utc)
def clean(row): row.pop("_id", None); return row

@router.get("/items")
async def list_items(include_deleted: bool = False, folder_id: str | None = None, is_favorite: bool | None = None, item_type: str | None = None, current_user=Depends(get_current_user)):
    query = {"user_id": current_user["id"]}
    if not include_deleted: query["is_deleted"] = False
    if folder_id: query["folder_id"] = folder_id
    if is_favorite is not None: query["is_favorite"] = is_favorite
    if item_type: query["type"] = item_type
    return [clean(row) async for row in get_db().vault_items.find(query).sort("created_at", -1)]

@router.post("/items", status_code=status.HTTP_201_CREATED)
async def create_item(payload: VaultItemCreate, current_user=Depends(get_current_user)):
    created, item_id = now(), str(uuid4())
    row = {"id": item_id, "user_id": current_user["id"], "type": payload.item_type.value, "encrypted_data": payload.encrypted_data, "iv": payload.encrypted_data.split(".")[0] if "." in payload.encrypted_data else "", "folder_id": str(payload.folder_id) if payload.folder_id else None, "tag_ids": [str(tag) for tag in payload.tag_ids], "is_favorite": payload.is_favorite, "is_deleted": False, "deleted_at": None, "created_at": created, "updated_at": created}
    db = get_db(); await db.vault_items.insert_one(row)
    await db.item_history.insert_one({"id": str(uuid4()), "item_id": item_id, "user_id": current_user["id"], "encrypted_data": row["encrypted_data"], "iv": row["iv"], "created_at": created})
    await log_audit_event(current_user["id"], "vault.item_created", "vault_item", item_id)
    return clean(row)

@router.get("/items/{item_id}")
async def get_item(item_id: str, current_user=Depends(get_current_user)):
    item = await get_db().vault_items.find_one({"id": item_id, "user_id": current_user["id"]})
    if not item: raise HTTPException(status_code=404, detail="Vault item not found")
    return clean(item)

@router.put("/items/{item_id}")
async def update_item(item_id: str, payload: VaultItemUpdate, current_user=Depends(get_current_user)):
    db = get_db(); item = await db.vault_items.find_one({"id": item_id, "user_id": current_user["id"]})
    if not item: raise HTTPException(status_code=404, detail="Vault item not found")
    values = {"updated_at": now()}
    if payload.encrypted_data is not None:
        values.update({"encrypted_data": payload.encrypted_data, "iv": payload.encrypted_data.split(".")[0] if "." in payload.encrypted_data else ""})
        await db.item_history.insert_one({"id": str(uuid4()), "item_id": item_id, "user_id": current_user["id"], "encrypted_data": values["encrypted_data"], "iv": values["iv"], "created_at": now()})
    if payload.item_type is not None: values["type"] = payload.item_type.value
    if payload.folder_id is not None: values["folder_id"] = str(payload.folder_id)
    if payload.tag_ids is not None: values["tag_ids"] = [str(tag) for tag in payload.tag_ids]
    if payload.is_favorite is not None: values["is_favorite"] = payload.is_favorite
    await db.vault_items.update_one({"id": item_id, "user_id": current_user["id"]}, {"$set": values})
    return clean({**item, **values})

@router.delete("/items/{item_id}")
async def soft_delete_item(item_id: str, current_user=Depends(get_current_user)):
    await get_db().vault_items.update_one({"id": item_id, "user_id": current_user["id"]}, {"$set": {"is_deleted": True, "deleted_at": now()}})
    return {"message": "Item moved to trash"}

@router.post("/items/{item_id}/restore")
async def restore_item(item_id: str, current_user=Depends(get_current_user)):
    await get_db().vault_items.update_one({"id": item_id, "user_id": current_user["id"]}, {"$set": {"is_deleted": False, "deleted_at": None}})
    return {"message": "Item restored"}

@router.delete("/items/{item_id}/permanent")
async def permanent_delete_item(item_id: str, current_user=Depends(get_current_user)):
    db = get_db(); await db.item_history.delete_many({"item_id": item_id, "user_id": current_user["id"]}); await db.vault_items.delete_one({"id": item_id, "user_id": current_user["id"]})
    return {"message": "Item permanently deleted"}

@router.get("/items/{item_id}/history")
async def get_item_history(item_id: str, current_user=Depends(get_current_user)):
    return [clean(row) async for row in get_db().item_history.find({"item_id": item_id, "user_id": current_user["id"]}).sort("created_at", -1)]

@router.get("/folders")
async def list_folders(current_user=Depends(get_current_user)):
    return [clean(row) async for row in get_db().folders.find({"user_id": current_user["id"]}).sort("sort_order", 1)]

@router.post("/folders", status_code=status.HTTP_201_CREATED)
async def create_folder(payload: FolderCreate, current_user=Depends(get_current_user)):
    created = now(); row = {"id": str(uuid4()), "user_id": current_user["id"], "name": payload.encrypted_name, "parent_id": str(payload.parent_id) if payload.parent_id else None, "icon": payload.icon, "color": payload.color, "sort_order": 0, "created_at": created, "updated_at": created}
    await get_db().folders.insert_one(row); return clean(row)

@router.put("/folders/{folder_id}")
async def update_folder(folder_id: str, payload: FolderUpdate, current_user=Depends(get_current_user)):
    values = {"updated_at": now()}
    if payload.encrypted_name is not None: values["name"] = payload.encrypted_name
    if payload.icon is not None: values["icon"] = payload.icon
    if payload.color is not None: values["color"] = payload.color
    await get_db().folders.update_one({"id": folder_id, "user_id": current_user["id"]}, {"$set": values}); return {"message": "Folder updated"}

@router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str, current_user=Depends(get_current_user)):
    db = get_db(); await db.vault_items.update_many({"folder_id": folder_id, "user_id": current_user["id"]}, {"$set": {"folder_id": None}}); await db.folders.delete_one({"id": folder_id, "user_id": current_user["id"]}); return {"message": "Folder deleted"}

@router.get("/tags")
async def list_tags(current_user=Depends(get_current_user)):
    return [clean(row) async for row in get_db().tags.find({"user_id": current_user["id"]})]

@router.post("/tags", status_code=status.HTTP_201_CREATED)
async def create_tag(payload: TagCreate, current_user=Depends(get_current_user)):
    row = {"id": str(uuid4()), "user_id": current_user["id"], "name": payload.encrypted_name, "color": payload.color, "created_at": now()}; await get_db().tags.insert_one(row); return clean(row)

@router.delete("/tags/{tag_id}")
async def delete_tag(tag_id: str, current_user=Depends(get_current_user)):
    await get_db().tags.delete_one({"id": tag_id, "user_id": current_user["id"]}); await get_db().vault_items.update_many({"user_id": current_user["id"]}, {"$pull": {"tag_ids": tag_id}}); return {"message": "Tag deleted"}

@router.post("/items/bulk")
async def bulk_operations(payload: BulkOperationRequest, current_user=Depends(get_current_user)):
    ids, query, db = [str(item) for item in payload.item_ids], {"id": {"$in": [str(item) for item in payload.item_ids]}, "user_id": current_user["id"]}, get_db()
    if payload.operation == BulkOperation.PERMANENT_DELETE: await db.vault_items.delete_many(query)
    elif payload.operation == BulkOperation.DELETE: await db.vault_items.update_many(query, {"$set": {"is_deleted": True, "deleted_at": now()}})
    elif payload.operation == BulkOperation.RESTORE: await db.vault_items.update_many(query, {"$set": {"is_deleted": False, "deleted_at": None}})
    elif payload.operation == BulkOperation.MOVE: await db.vault_items.update_many(query, {"$set": {"folder_id": str(payload.target_folder_id) if payload.target_folder_id else None}})
    return {"success_count": len(ids), "failed_ids": [], "message": "Bulk operation completed"}
