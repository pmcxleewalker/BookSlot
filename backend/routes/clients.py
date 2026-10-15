import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.booking import EMAIL_RE, normalize_email
from core.db import db
from core.deps import Actor, get_actor
from core.scheduling import fmt, local_now
from core.security import new_id, now_iso, pick

router = APIRouter()

CLIENT_EDITABLE = ["name", "email", "phone", "notes", "tags", "is_vip", "preferred_staff_id", "service_notes",
                   "important_info", "birthday", "marketing_consent"]


class ClientIn(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    is_vip: bool = False
    preferred_staff_id: Optional[str] = None
    service_notes: Optional[str] = None
    important_info: Optional[str] = None
    birthday: Optional[str] = None
    marketing_consent: bool = False


def clean_client(data: Dict[str, Any]) -> Dict[str, Any]:
    if "name" in data:
        data["name"] = str(data["name"] or "").strip()[:120]
        if not data["name"]:
            raise HTTPException(status_code=400, detail="Client name is required")
    if "email" in data:
        data["email"] = normalize_email(data["email"])
        if data["email"] and not EMAIL_RE.match(data["email"]):
            raise HTTPException(status_code=400, detail="Please enter a valid email address")
    for key in ("phone", "notes", "service_notes", "important_info", "birthday", "preferred_staff_id"):
        if key in data:
            data[key] = (str(data[key] or "").strip()[:2000]) or None
    if "tags" in data:
        data["tags"] = [str(t).strip()[:40] for t in (data["tags"] or []) if str(t).strip()][:20]
    for key in ("is_vip", "marketing_consent"):
        if key in data:
            data[key] = bool(data[key])
    return data


async def client_stats(tenant: Dict[str, Any], clients: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Visits, spend and last visit are calculated from appointments so they're always accurate."""
    if not clients:
        return clients
    now = fmt(local_now(tenant.get("timezone")))
    ids = [c["client_id"] for c in clients]
    emails = [c["email"] for c in clients if c.get("email")]
    query: Dict[str, Any] = {"tenant_id": tenant["tenant_id"], "$or": [{"client_id": {"$in": ids}}]}
    if emails:
        query["$or"].append({"client_email": {"$in": emails}})
    appts = await db.appointments.find(query, {"_id": 0, "client_id": 1, "client_email": 1, "status": 1,
                                               "total_price": 1, "start_time": 1}).to_list(100000)
    by_id = {c["client_id"]: c for c in clients}
    by_email = {c["email"]: c for c in clients if c.get("email")}
    for c in clients:
        c.update({"total_appointments": 0, "total_spent": 0.0, "last_visit": None, "next_appointment": None,
                  "no_shows": 0})
    for a in appts:
        c = by_id.get(a.get("client_id")) or by_email.get((a.get("client_email") or "").lower())
        if not c:
            continue
        status = a.get("status")
        if status == "cancelled":
            continue
        if status == "no_show":
            c["no_shows"] += 1
            continue
        c["total_appointments"] += 1
        start = a.get("start_time") or ""
        if status == "completed" or (status == "confirmed" and start < now):
            c["total_spent"] = round(c["total_spent"] + float(a.get("total_price") or 0), 2)
            if not c["last_visit"] or start > c["last_visit"]:
                c["last_visit"] = start
        elif start >= now and (not c["next_appointment"] or start < c["next_appointment"]):
            c["next_appointment"] = start
    return clients


@router.get("/clients")
async def list_clients(actor: Actor = Depends(get_actor), search: Optional[str] = None):
    actor.require("can_manage_customers", "You don't have permission to view clients")
    query: Dict[str, Any] = {"tenant_id": actor.tenant_id}
    if search:
        pattern = re.escape(search.strip()[:100])
        query["$or"] = [{"name": {"$regex": pattern, "$options": "i"}},
                        {"email": {"$regex": pattern, "$options": "i"}},
                        {"phone": {"$regex": pattern, "$options": "i"}}]
    clients = await db.clients.find(query, {"_id": 0}).sort("name", 1).to_list(5000)
    return {"clients": await client_stats(actor.tenant, clients)}


@router.post("/clients")
async def create_client(body: ClientIn, actor: Actor = Depends(get_actor)):
    actor.require("can_manage_customers", "You don't have permission to manage clients")
    data = clean_client(body.model_dump())
    if data.get("email") and await db.clients.find_one({"tenant_id": actor.tenant_id, "email": data["email"]}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="A client with this email already exists")
    client = {**data, "client_id": new_id("client"), "tenant_id": actor.tenant_id, "created_at": now_iso()}
    await db.clients.insert_one({**client})
    return {"client": (await client_stats(actor.tenant, [client]))[0]}


@router.get("/clients/{client_id}")
async def get_client(client_id: str, actor: Actor = Depends(get_actor)):
    actor.require("can_manage_customers", "You don't have permission to view clients")
    client = await db.clients.find_one({"client_id": client_id, "tenant_id": actor.tenant_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client = (await client_stats(actor.tenant, [client]))[0]
    or_q: List[Dict[str, Any]] = [{"client_id": client_id}]
    if client.get("email"):
        or_q.append({"client_email": client["email"]})
    history = await db.appointments.find({"tenant_id": actor.tenant_id, "$or": or_q}, {"_id": 0}) \
        .sort("start_time", -1).to_list(200)
    services = {s["service_id"]: s["name"] for s in await db.services.find({"tenant_id": actor.tenant_id}, {"_id": 0, "service_id": 1, "name": 1}).to_list(500)}
    staff = {s["staff_id"]: s["name"] for s in await db.staff.find({"tenant_id": actor.tenant_id}, {"_id": 0, "staff_id": 1, "name": 1}).to_list(500)}
    client["service_history"] = [{
        "appointment_id": a["appointment_id"], "date": a["start_time"], "status": a.get("status"),
        "service_name": services.get(a.get("service_id"), "Unknown"), "staff": staff.get(a.get("staff_id"), "Unknown"),
        "price": a.get("total_price", 0), "notes": a.get("notes"),
    } for a in history]
    return {"client": client}


@router.put("/clients/{client_id}")
async def update_client(client_id: str, updates: Dict[str, Any], actor: Actor = Depends(get_actor)):
    actor.require("can_manage_customers", "You don't have permission to manage clients")
    data = clean_client(pick(updates, CLIENT_EDITABLE))
    if data.get("email"):
        dup = await db.clients.find_one({"tenant_id": actor.tenant_id, "email": data["email"],
                                         "client_id": {"$ne": client_id}}, {"_id": 1})
        if dup:
            raise HTTPException(status_code=400, detail="Another client already uses this email")
    result = await db.clients.update_one({"client_id": client_id, "tenant_id": actor.tenant_id}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    client = await db.clients.find_one({"client_id": client_id}, {"_id": 0})
    return {"client": (await client_stats(actor.tenant, [client]))[0]}


@router.delete("/clients/{client_id}")
async def delete_client(client_id: str, actor: Actor = Depends(get_actor)):
    """Delete a client record (e.g. a GDPR erasure request). Past appointments are kept for your
    records but the client's contact details are removed from them."""
    actor.require_manager()
    client = await db.clients.find_one({"client_id": client_id, "tenant_id": actor.tenant_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    await db.clients.delete_one({"client_id": client_id})
    await db.appointments.update_many({"tenant_id": actor.tenant_id, "client_id": client_id}, {"$set": {
        "client_id": None, "client_name": "Deleted client", "client_email": None, "client_phone": None}})
    return {"message": "Client deleted"}
