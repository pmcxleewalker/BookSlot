"""Services, resources, intake forms and message templates."""
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.db import db
from core.deps import Actor, get_actor
from core.notify import DEFAULT_TEMPLATES, ensure_default_templates
from core.security import new_id, now_iso, pick

router = APIRouter()
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


# ---------- Services ----------
class ServiceIn(BaseModel):
    name: str
    description: Optional[str] = None
    duration: int = 30
    buffer_time: int = 0
    price: float = 0.0
    deposit_required: bool = False
    deposit_amount: float = 0.0
    color: str = "#E34A33"
    category: Optional[str] = None
    is_active: bool = True


def clean_service(data: Dict[str, Any]) -> Dict[str, Any]:
    if "name" in data:
        data["name"] = str(data["name"] or "").strip()[:120]
        if not data["name"]:
            raise HTTPException(status_code=400, detail="Service name is required")
    if "duration" in data:
        try:
            data["duration"] = int(data["duration"])
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Duration must be a number of minutes")
        if not 5 <= data["duration"] <= 720:
            raise HTTPException(status_code=400, detail="Duration must be between 5 and 720 minutes")
    if "buffer_time" in data:
        data["buffer_time"] = max(0, min(int(data["buffer_time"] or 0), 240))
    for key in ("price", "deposit_amount"):
        if key in data:
            try:
                data[key] = round(max(0.0, float(data[key] or 0)), 2)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="Price must be a number")
    if "color" in data and not HEX.match(str(data["color"] or "")):
        data["color"] = "#E34A33"
    for key in ("description", "category"):
        if key in data:
            data[key] = (str(data[key] or "").strip()[:1000]) or None
    return data


@router.get("/services")
async def list_services(actor: Actor = Depends(get_actor), include_inactive: bool = False):
    q: Dict[str, Any] = {"tenant_id": actor.tenant_id}
    if not include_inactive:
        q["is_active"] = True
    services = await db.services.find(q, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"services": services}


@router.post("/services")
async def create_service(body: ServiceIn, actor: Actor = Depends(get_actor)):
    actor.require("can_edit_services", "You don't have permission to edit services")
    data = clean_service(body.model_dump())
    service = {**data, "service_id": new_id("service"), "tenant_id": actor.tenant_id, "created_at": now_iso()}
    await db.services.insert_one({**service})
    return {"service": service}


SERVICE_EDITABLE = list(ServiceIn.model_fields.keys())


@router.put("/services/{service_id}")
async def update_service(service_id: str, updates: Dict[str, Any], actor: Actor = Depends(get_actor)):
    actor.require("can_edit_services", "You don't have permission to edit services")
    data = clean_service(pick(updates, SERVICE_EDITABLE))
    result = await db.services.update_one({"service_id": service_id, "tenant_id": actor.tenant_id}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"service": await db.services.find_one({"service_id": service_id}, {"_id": 0})}


@router.delete("/services/{service_id}")
async def delete_service(service_id: str, actor: Actor = Depends(get_actor)):
    actor.require("can_edit_services", "You don't have permission to edit services")
    result = await db.services.update_one({"service_id": service_id, "tenant_id": actor.tenant_id},
                                          {"$set": {"is_active": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    # remove from staff service lists so it no longer restricts them
    await db.staff.update_many({"tenant_id": actor.tenant_id}, {"$pull": {"services": service_id}})
    return {"message": "Service deleted"}


# ---------- Resources (rooms/equipment) ----------
@router.get("/resources")
async def list_resources(actor: Actor = Depends(get_actor)):
    return {"resources": await db.resources.find({"tenant_id": actor.tenant_id, "is_active": True}, {"_id": 0}).to_list(200)}


@router.post("/resources")
async def create_resource(body: Dict[str, Any], actor: Actor = Depends(get_actor)):
    actor.require_manager()
    data = pick(body, ["name", "description", "resource_type", "capacity"])
    if not str(data.get("name") or "").strip():
        raise HTTPException(status_code=400, detail="Name is required")
    resource = {"resource_type": "room", "capacity": 1, **data, "resource_id": new_id("resource"),
                "tenant_id": actor.tenant_id, "is_active": True, "created_at": now_iso()}
    await db.resources.insert_one({**resource})
    return {"resource": resource}


@router.put("/resources/{resource_id}")
async def update_resource(resource_id: str, body: Dict[str, Any], actor: Actor = Depends(get_actor)):
    actor.require_manager()
    data = pick(body, ["name", "description", "resource_type", "capacity", "is_active"])
    result = await db.resources.update_one({"resource_id": resource_id, "tenant_id": actor.tenant_id}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Resource not found")
    return {"resource": await db.resources.find_one({"resource_id": resource_id}, {"_id": 0})}


@router.delete("/resources/{resource_id}")
async def delete_resource(resource_id: str, actor: Actor = Depends(get_actor)):
    actor.require_manager()
    result = await db.resources.update_one({"resource_id": resource_id, "tenant_id": actor.tenant_id},
                                           {"$set": {"is_active": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Resource not found")
    return {"message": "Resource deleted"}


# ---------- Intake forms ----------
FIELD_TYPES = {"text", "email", "phone", "textarea", "select", "checkbox", "date"}


class FormFieldIn(BaseModel):
    field_id: Optional[str] = None
    label: str
    field_type: str = "text"
    required: bool = False
    options: List[str] = Field(default_factory=list)
    placeholder: Optional[str] = None


class FormIn(BaseModel):
    name: str
    description: Optional[str] = None
    fields: List[FormFieldIn] = Field(default_factory=list)
    is_active: bool = True
    service_ids: List[str] = Field(default_factory=list)  # empty = shown for every service


def clean_form(body: FormIn) -> Dict[str, Any]:
    name = body.name.strip()[:120]
    if not name:
        raise HTTPException(status_code=400, detail="Form name is required")
    if len(body.fields) > 30:
        raise HTTPException(status_code=400, detail="A form can have at most 30 questions")
    fields = []
    for f in body.fields:
        label = f.label.strip()[:200]
        if not label:
            raise HTTPException(status_code=400, detail="Every question needs a label")
        ftype = f.field_type if f.field_type in FIELD_TYPES else "text"
        options = [o.strip()[:100] for o in f.options if o and o.strip()][:30]
        if ftype == "select" and not options:
            raise HTTPException(status_code=400, detail=f"'{label}' needs at least one option")
        fields.append({"field_id": f.field_id or new_id("field", 8), "label": label, "field_type": ftype,
                       "required": bool(f.required), "options": options,
                       "placeholder": (f.placeholder or "").strip()[:200] or None})
    return {"name": name, "description": (body.description or "").strip()[:1000] or None, "fields": fields,
            "is_active": body.is_active, "service_ids": list(dict.fromkeys(body.service_ids))}


@router.get("/forms")
async def list_forms(actor: Actor = Depends(get_actor)):
    return {"forms": await db.forms.find({"tenant_id": actor.tenant_id}, {"_id": 0}).sort("created_at", 1).to_list(100)}


@router.post("/forms")
async def create_form(body: FormIn, actor: Actor = Depends(get_actor)):
    actor.require_manager()
    actor.require_feature("custom_forms")
    form = {**clean_form(body), "form_id": new_id("form"), "tenant_id": actor.tenant_id, "created_at": now_iso()}
    await db.forms.insert_one({**form})
    return {"form": form}


@router.put("/forms/{form_id}")
async def update_form(form_id: str, body: FormIn, actor: Actor = Depends(get_actor)):
    actor.require_manager()
    actor.require_feature("custom_forms")
    result = await db.forms.update_one({"form_id": form_id, "tenant_id": actor.tenant_id},
                                       {"$set": {**clean_form(body), "updated_at": now_iso()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Form not found")
    return {"form": await db.forms.find_one({"form_id": form_id}, {"_id": 0})}


@router.delete("/forms/{form_id}")
async def delete_form(form_id: str, actor: Actor = Depends(get_actor)):
    actor.require_manager()
    result = await db.forms.delete_one({"form_id": form_id, "tenant_id": actor.tenant_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Form not found")
    return {"message": "Form deleted"}


# ---------- Message templates ----------
PLACEHOLDERS = ["client_name", "service_name", "staff_name", "date", "time", "business_name", "address", "phone",
                "confirmation_code", "manage_link", "booking_link", "reason"]


@router.get("/messages/templates")
async def list_templates(actor: Actor = Depends(get_actor)):
    await ensure_default_templates(actor.tenant_id)
    templates = await db.message_templates.find({"tenant_id": actor.tenant_id}, {"_id": 0}).to_list(100)
    order = {(t["type"], t["trigger"]): i for i, t in enumerate(DEFAULT_TEMPLATES)}
    templates.sort(key=lambda t: order.get((t.get("type"), t.get("trigger")), 99))
    return {"templates": templates, "placeholders": PLACEHOLDERS}


@router.put("/messages/templates/{template_id}")
async def update_template(template_id: str, updates: Dict[str, Any], actor: Actor = Depends(get_actor)):
    actor.require_manager()
    data = pick(updates, ["name", "subject", "content", "is_active"])
    if "content" in data:
        data["content"] = str(data["content"] or "")[:5000]
        if not data["content"].strip():
            raise HTTPException(status_code=400, detail="Message content can't be empty")
    if "subject" in data:
        data["subject"] = str(data["subject"] or "")[:200]
    if "is_active" in data:
        data["is_active"] = bool(data["is_active"])
    result = await db.message_templates.update_one({"template_id": template_id, "tenant_id": actor.tenant_id},
                                                   {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"template": await db.message_templates.find_one({"template_id": template_id}, {"_id": 0})}


@router.post("/messages/templates/{template_id}/reset")
async def reset_template(template_id: str, actor: Actor = Depends(get_actor)):
    actor.require_manager()
    tpl = await db.message_templates.find_one({"template_id": template_id, "tenant_id": actor.tenant_id}, {"_id": 0})
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    default = next((t for t in DEFAULT_TEMPLATES if t["type"] == tpl.get("type") and t["trigger"] == tpl.get("trigger")), None)
    if not default:
        raise HTTPException(status_code=400, detail="No default available for this template")
    await db.message_templates.update_one({"template_id": template_id}, {"$set": {
        "subject": default["subject"], "content": default["content"], "name": default["name"]}})
    return {"template": await db.message_templates.find_one({"template_id": template_id}, {"_id": 0})}
