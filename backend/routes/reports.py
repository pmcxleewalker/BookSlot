import csv
import io
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.deps import Actor, get_actor
from core.scheduling import fmt, local_now
from routes.appointments import enrich, scope_query
from routes.clients import client_stats

router = APIRouter()

REVENUE_STATUSES = ("completed", "confirmed")


def revenue_of(a: Dict[str, Any], now_str: str) -> float:
    """Money counts once an appointment is completed, or confirmed and already in the past."""
    status = a.get("status")
    if status == "completed" or (status == "confirmed" and (a.get("start_time") or "") < now_str):
        return float(a.get("total_price") or 0)
    return 0.0


@router.get("/reports/dashboard")
async def dashboard(actor: Actor = Depends(get_actor)):
    tz = actor.tenant.get("timezone")
    now = local_now(tz)
    now_str = fmt(now)
    today = now.date().isoformat()
    month_start = now.replace(day=1).date().isoformat()
    base = scope_query(actor, {"tenant_id": actor.tenant_id})
    active = {"$nin": ["cancelled"]}

    today_count = await db.appointments.count_documents({**base, "status": active,
                                                         "start_time": {"$gte": today, "$lte": f"{today}T23:59:59"}})
    month_appts = await db.appointments.find({**base, "start_time": {"$gte": month_start, "$lte": now_str[:10] + "T23:59:59"}},
                                             {"_id": 0, "status": 1, "total_price": 1, "start_time": 1}).to_list(20000)
    month_count = len([a for a in month_appts if a.get("status") != "cancelled"])
    revenue = round(sum(revenue_of(a, now_str) for a in month_appts), 2)
    client_count = await db.clients.count_documents({"tenant_id": actor.tenant_id})
    upcoming = await db.appointments.find({
        **base, "status": {"$in": ["confirmed", "pending", "pending_approval"]},
        "start_time": {"$gte": now_str, "$lte": fmt(now + timedelta(days=7))},
    }, {"_id": 0}).sort("start_time", 1).to_list(10)
    pending = await db.appointments.count_documents({**base, "status": "pending_approval"})
    return {
        "stats": {
            "today_appointments": today_count,
            "month_appointments": month_count,
            "month_revenue": revenue,
            "total_clients": client_count,
            "pending_approvals": pending,
        },
        "upcoming_appointments": await enrich(actor.tenant_id, upcoming),
        "currency": actor.tenant.get("currency", "EUR"),
    }


def _range(actor: Actor, start_date: Optional[str], end_date: Optional[str]):
    now = local_now(actor.tenant.get("timezone"))
    end_date = end_date or now.date().isoformat()
    start_date = start_date or (now - timedelta(days=30)).date().isoformat()
    try:
        datetime.strptime(start_date, "%Y-%m-%d")
        datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be YYYY-MM-DD")
    return start_date, end_date


async def _appointments(actor: Actor, start_date: str, end_date: str) -> List[Dict[str, Any]]:
    q = scope_query(actor, {"tenant_id": actor.tenant_id, "start_time": {"$gte": start_date, "$lte": f"{end_date}T23:59:59"}})
    return await db.appointments.find(q, {"_id": 0}).sort("start_time", 1).to_list(50000)


@router.get("/reports/detailed")
async def detailed(actor: Actor = Depends(get_actor), start_date: Optional[str] = None, end_date: Optional[str] = None,
                   report_type: str = "overview"):
    actor.require("can_view_reports", "You don't have permission to view reports")
    start_date, end_date = _range(actor, start_date, end_date)
    now_str = fmt(local_now(actor.tenant.get("timezone")))
    appts = await enrich(actor.tenant_id, await _appointments(actor, start_date, end_date))

    total_revenue = 0.0
    by_service: Dict[str, Dict[str, float]] = {}
    by_staff: Dict[str, Dict[str, float]] = {}
    daily: Dict[str, Dict[str, float]] = {}
    hourly: Dict[int, int] = {}
    for a in appts:
        rev = revenue_of(a, now_str)
        total_revenue += rev
        active = a.get("status") != "cancelled"
        for bucket, key in ((by_service, a["service_name"]), (by_staff, a["staff_name"]),
                            (daily, (a.get("start_time") or "")[:10])):
            entry = bucket.setdefault(key, {"revenue": 0.0, "bookings": 0})
            entry["revenue"] += rev
            entry["bookings"] += 1 if active else 0
        if active:
            try:
                hour = int(a["start_time"][11:13])
                hourly[hour] = hourly.get(hour, 0) + 1
            except (KeyError, ValueError):
                pass
    total = len(appts)
    completed = len([a for a in appts if a.get("status") == "completed"])
    cancelled = len([a for a in appts if a.get("status") == "cancelled"])
    no_shows = len([a for a in appts if a.get("status") == "no_show"])
    paid = len([a for a in appts if revenue_of(a, now_str) > 0])
    past_active = len([a for a in appts if a.get("status") != "cancelled" and (a.get("start_time") or "") < now_str])

    def rows(d):
        return [{"name": k, "revenue": round(v["revenue"], 2), "bookings": int(v["bookings"])}
                for k, v in sorted(d.items(), key=lambda x: (-x[1]["revenue"], -x[1]["bookings"]))]

    return {
        "period": {"start": start_date, "end": end_date},
        "currency": actor.tenant.get("currency", "EUR"),
        "summary": {
            "total_revenue": round(total_revenue, 2),
            "total_bookings": total,
            "completed": completed,
            "cancelled": cancelled,
            "no_shows": no_shows,
            "completion_rate": round(completed / past_active * 100, 1) if past_active else 0,
            "cancellation_rate": round(cancelled / total * 100, 1) if total else 0,
            "average_booking_value": round(total_revenue / paid, 2) if paid else 0,
        },
        "by_service": rows(by_service),
        "by_staff": rows(by_staff),
        "daily_trends": [{"date": k, "revenue": round(v["revenue"], 2), "bookings": int(v["bookings"])}
                         for k, v in sorted(daily.items())],
        "busiest_hours": [{"hour": h, "bookings": n} for h, n in sorted(hourly.items())],
    }


def to_csv(rows: List[Dict[str, Any]]) -> str:
    if not rows:
        return ""
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    for row in rows:
        # neutralise spreadsheet formula injection
        writer.writerow({k: ("'" + v if isinstance(v, str) and v[:1] in "=+-@" else v) for k, v in row.items()})
    return buf.getvalue()


@router.get("/reports/export")
async def export(actor: Actor = Depends(get_actor), format: str = "csv", report_type: str = "appointments",
                 start_date: Optional[str] = None, end_date: Optional[str] = None):
    actor.require("can_view_reports", "You don't have permission to export reports")
    start_date, end_date = _range(actor, start_date, end_date)
    if report_type == "appointments":
        appts = await enrich(actor.tenant_id, await _appointments(actor, start_date, end_date))
        data = [{"Date": a.get("start_time", "")[:10], "Time": a.get("start_time", "")[11:16],
                 "Client": a.get("client_name") or "Walk-in", "Email": a.get("client_email") or "",
                 "Phone": a.get("client_phone") or "", "Service": a["service_name"], "Staff": a["staff_name"],
                 "Status": a.get("status", ""), "Price": a.get("total_price", 0), "Source": a.get("source", ""),
                 "Notes": a.get("notes") or ""} for a in appts]
        filename = f"appointments_{start_date}_{end_date}.csv"
        title = f"Appointments Report ({start_date} to {end_date})"
        columns = ["Date", "Time", "Client", "Service", "Staff", "Status", "Price"]
        summary = {"total_appointments": len(data), "period": f"{start_date} to {end_date}",
                   "total_revenue": round(sum(revenue_of(a, fmt(local_now(actor.tenant.get('timezone')))) for a in appts), 2)}
    elif report_type == "clients":
        actor.require("can_manage_customers")
        clients = await client_stats(actor.tenant, await db.clients.find({"tenant_id": actor.tenant_id}, {"_id": 0}).to_list(20000))
        data = [{"Name": c.get("name", ""), "Email": c.get("email") or "", "Phone": c.get("phone") or "",
                 "VIP": "Yes" if c.get("is_vip") else "No", "Total Visits": c.get("total_appointments", 0),
                 "Total Spent": c.get("total_spent", 0), "Last Visit": (c.get("last_visit") or "")[:10],
                 "Notes": c.get("notes") or "", "Important Info": c.get("important_info") or ""} for c in clients]
        filename = f"clients_{end_date}.csv"
        title = "Clients Report"
        columns = ["Name", "Email", "Phone", "VIP", "Total Visits", "Total Spent"]
        summary = {"total_clients": len(data), "vip_clients": len([c for c in data if c["VIP"] == "Yes"])}
    elif report_type == "revenue":
        report = await detailed(actor, start_date, end_date)
        data = [{"Service": r["name"], "Revenue": r["revenue"], "Bookings": r["bookings"]} for r in report["by_service"]]
        filename = f"revenue_{start_date}_{end_date}.csv"
        if format != "csv":
            return report
        title, columns, summary = "Revenue", ["Service", "Revenue", "Bookings"], report["summary"]
    else:
        raise HTTPException(status_code=400, detail="Unknown report type")

    if format == "csv":
        return {"csv": to_csv(data) or "No data", "filename": filename, "row_count": len(data)}
    return {"data": data, "title": title, "columns": columns, "summary": summary,
            "currency": actor.tenant.get("currency", "EUR")}
