"""
Analytics and Reporting for TimeSlot Pro
Provides business insights, booking analytics, and staff performance metrics
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from fastapi import APIRouter, HTTPException, Request, Query

from models import BookingStatus
from plan_gating import check_feature_access, PlanFeature

analytics_router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


async def get_date_range(period: str) -> tuple:
    """Get start and end dates for a period"""
    now = datetime.now(timezone.utc)
    
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif period == "week":
        start = now - timedelta(days=7)
        end = now
    elif period == "month":
        start = now - timedelta(days=30)
        end = now
    elif period == "quarter":
        start = now - timedelta(days=90)
        end = now
    elif period == "year":
        start = now - timedelta(days=365)
        end = now
    else:
        start = now - timedelta(days=30)
        end = now
    
    return start, end


def get_db():
    from server import db
    return db


async def require_auth_helper(request: Request):
    from auth import require_auth
    from server import db
    return await require_auth(request, db)


@analytics_router.get("/overview")
async def get_analytics_overview(
    request: Request,
    period: str = Query("month", enum=["today", "week", "month", "quarter", "year"])
):
    """Get overview analytics for the business"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    tenant_id = user.tenant_id
    start_date, end_date = await get_date_range(period)
    
    # Get previous period for comparison
    period_length = (end_date - start_date).days
    prev_start = start_date - timedelta(days=period_length)
    prev_end = start_date
    
    # Current period stats
    total_bookings = await db.appointments.count_documents({
        "tenant_id": tenant_id,
        "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
    })
    
    completed_bookings = await db.appointments.count_documents({
        "tenant_id": tenant_id,
        "status": BookingStatus.COMPLETED.value,
        "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
    })
    
    cancelled_bookings = await db.appointments.count_documents({
        "tenant_id": tenant_id,
        "status": BookingStatus.CANCELLED.value,
        "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
    })
    
    no_shows = await db.appointments.count_documents({
        "tenant_id": tenant_id,
        "status": BookingStatus.NO_SHOW.value,
        "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
    })
    
    # Revenue calculation
    revenue_pipeline = [
        {
            "$match": {
                "tenant_id": tenant_id,
                "status": BookingStatus.COMPLETED.value,
                "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
            }
        },
        {
            "$group": {
                "_id": None,
                "total": {"$sum": "$price"}
            }
        }
    ]
    revenue_result = await db.appointments.aggregate(revenue_pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    # New clients
    new_clients = await db.clients.count_documents({
        "tenant_id": tenant_id,
        "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
    })
    
    # Previous period for comparison
    prev_bookings = await db.appointments.count_documents({
        "tenant_id": tenant_id,
        "created_at": {"$gte": prev_start.isoformat(), "$lte": prev_end.isoformat()}
    })
    
    prev_revenue_result = await db.appointments.aggregate([
        {
            "$match": {
                "tenant_id": tenant_id,
                "status": BookingStatus.COMPLETED.value,
                "created_at": {"$gte": prev_start.isoformat(), "$lte": prev_end.isoformat()}
            }
        },
        {"$group": {"_id": None, "total": {"$sum": "$price"}}}
    ]).to_list(1)
    prev_revenue = prev_revenue_result[0]["total"] if prev_revenue_result else 0
    
    # Calculate changes
    booking_change = ((total_bookings - prev_bookings) / prev_bookings * 100) if prev_bookings > 0 else 0
    revenue_change = ((total_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
    
    # Cancellation rate
    cancellation_rate = (cancelled_bookings / total_bookings * 100) if total_bookings > 0 else 0
    no_show_rate = (no_shows / total_bookings * 100) if total_bookings > 0 else 0
    
    return {
        "period": period,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "metrics": {
            "total_bookings": total_bookings,
            "completed_bookings": completed_bookings,
            "cancelled_bookings": cancelled_bookings,
            "no_shows": no_shows,
            "total_revenue": round(total_revenue, 2),
            "new_clients": new_clients,
            "cancellation_rate": round(cancellation_rate, 1),
            "no_show_rate": round(no_show_rate, 1),
        },
        "comparison": {
            "booking_change_percent": round(booking_change, 1),
            "revenue_change_percent": round(revenue_change, 1),
            "prev_bookings": prev_bookings,
            "prev_revenue": round(prev_revenue, 2),
        }
    }


@analytics_router.get("/bookings-by-day")
async def get_bookings_by_day(
    request: Request,
    period: str = Query("month", enum=["week", "month", "quarter"])
):
    """Get daily booking counts for charting"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    start_date, end_date = await get_date_range(period)
    
    # Generate all dates in range
    dates = []
    current = start_date
    while current <= end_date:
        dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    
    # Get bookings grouped by day
    bookings = await db.appointments.find(
        {
            "tenant_id": user.tenant_id,
            "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
        },
        {"_id": 0, "created_at": 1, "status": 1}
    ).to_list(10000)
    
    # Count by day
    day_counts = {d: {"total": 0, "completed": 0, "cancelled": 0} for d in dates}
    for b in bookings:
        day = b["created_at"][:10]
        if day in day_counts:
            day_counts[day]["total"] += 1
            if b["status"] == BookingStatus.COMPLETED.value:
                day_counts[day]["completed"] += 1
            elif b["status"] == BookingStatus.CANCELLED.value:
                day_counts[day]["cancelled"] += 1
    
    return {
        "period": period,
        "data": [
            {"date": d, **counts}
            for d, counts in sorted(day_counts.items())
        ]
    }


@analytics_router.get("/revenue-by-day")
async def get_revenue_by_day(
    request: Request,
    period: str = Query("month", enum=["week", "month", "quarter"])
):
    """Get daily revenue for charting"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    await check_feature_access(db, user.tenant_id, PlanFeature.BASIC_REPORTS)
    
    start_date, end_date = await get_date_range(period)
    
    # Get completed appointments with revenue
    appointments = await db.appointments.find(
        {
            "tenant_id": user.tenant_id,
            "status": BookingStatus.COMPLETED.value,
            "start_time": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
        },
        {"_id": 0, "start_time": 1, "price": 1}
    ).to_list(10000)
    
    # Group by day
    revenue_by_day = {}
    for apt in appointments:
        day = apt["start_time"][:10]
        revenue_by_day[day] = revenue_by_day.get(day, 0) + apt.get("price", 0)
    
    # Fill in missing days
    current = start_date
    data = []
    while current <= end_date:
        day = current.strftime("%Y-%m-%d")
        data.append({
            "date": day,
            "revenue": round(revenue_by_day.get(day, 0), 2)
        })
        current += timedelta(days=1)
    
    return {"period": period, "data": data}


@analytics_router.get("/services")
async def get_service_analytics(
    request: Request,
    period: str = Query("month", enum=["week", "month", "quarter", "year"])
):
    """Get analytics by service"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    start_date, end_date = await get_date_range(period)
    
    # Get all services
    services = await db.services.find(
        {"tenant_id": user.tenant_id, "is_active": True},
        {"_id": 0, "service_id": 1, "name": 1}
    ).to_list(100)
    
    service_map = {s["service_id"]: s["name"] for s in services}
    
    # Get appointments grouped by service
    pipeline = [
        {
            "$match": {
                "tenant_id": user.tenant_id,
                "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
            }
        },
        {
            "$group": {
                "_id": "$service_id",
                "total_bookings": {"$sum": 1},
                "completed": {
                    "$sum": {"$cond": [{"$eq": ["$status", BookingStatus.COMPLETED.value]}, 1, 0]}
                },
                "revenue": {
                    "$sum": {
                        "$cond": [{"$eq": ["$status", BookingStatus.COMPLETED.value]}, "$price", 0]
                    }
                }
            }
        },
        {"$sort": {"total_bookings": -1}}
    ]
    
    results = await db.appointments.aggregate(pipeline).to_list(100)
    
    return {
        "period": period,
        "services": [
            {
                "service_id": r["_id"],
                "service_name": service_map.get(r["_id"], "Unknown"),
                "total_bookings": r["total_bookings"],
                "completed": r["completed"],
                "revenue": round(r["revenue"], 2)
            }
            for r in results
        ]
    }


@analytics_router.get("/staff")
async def get_staff_analytics(
    request: Request,
    period: str = Query("month", enum=["week", "month", "quarter", "year"])
):
    """Get analytics by staff member"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    start_date, end_date = await get_date_range(period)
    
    # Get all staff
    staff_list = await db.staff.find(
        {"tenant_id": user.tenant_id, "is_active": True},
        {"_id": 0, "staff_id": 1, "name": 1, "color": 1}
    ).to_list(100)
    
    staff_map = {s["staff_id"]: {"name": s["name"], "color": s.get("color", "#2E473B")} for s in staff_list}
    
    # Get appointments grouped by staff
    pipeline = [
        {
            "$match": {
                "tenant_id": user.tenant_id,
                "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
            }
        },
        {
            "$group": {
                "_id": "$staff_id",
                "total_bookings": {"$sum": 1},
                "completed": {
                    "$sum": {"$cond": [{"$eq": ["$status", BookingStatus.COMPLETED.value]}, 1, 0]}
                },
                "no_shows": {
                    "$sum": {"$cond": [{"$eq": ["$status", BookingStatus.NO_SHOW.value]}, 1, 0]}
                },
                "revenue": {
                    "$sum": {
                        "$cond": [{"$eq": ["$status", BookingStatus.COMPLETED.value]}, "$price", 0]
                    }
                }
            }
        },
        {"$sort": {"revenue": -1}}
    ]
    
    results = await db.appointments.aggregate(pipeline).to_list(100)
    
    return {
        "period": period,
        "staff": [
            {
                "staff_id": r["_id"],
                "staff_name": staff_map.get(r["_id"], {}).get("name", "Unknown"),
                "color": staff_map.get(r["_id"], {}).get("color", "#2E473B"),
                "total_bookings": r["total_bookings"],
                "completed": r["completed"],
                "no_shows": r["no_shows"],
                "revenue": round(r["revenue"], 2),
                "completion_rate": round(r["completed"] / r["total_bookings"] * 100, 1) if r["total_bookings"] > 0 else 0
            }
            for r in results
        ]
    }


@analytics_router.get("/clients")
async def get_client_analytics(
    request: Request,
    period: str = Query("month", enum=["week", "month", "quarter", "year"])
):
    """Get client analytics - top clients, new vs returning"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    start_date, end_date = await get_date_range(period)
    
    # New clients in period
    new_clients = await db.clients.count_documents({
        "tenant_id": user.tenant_id,
        "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
    })
    
    # Total clients
    total_clients = await db.clients.count_documents({
        "tenant_id": user.tenant_id,
        "is_active": True
    })
    
    # Top clients by bookings in period
    pipeline = [
        {
            "$match": {
                "tenant_id": user.tenant_id,
                "client_id": {"$ne": None},
                "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
            }
        },
        {
            "$group": {
                "_id": "$client_id",
                "booking_count": {"$sum": 1},
                "total_spent": {
                    "$sum": {"$cond": [{"$eq": ["$status", BookingStatus.COMPLETED.value]}, "$price", 0]}
                },
                "client_name": {"$first": "$client_name"}
            }
        },
        {"$sort": {"total_spent": -1}},
        {"$limit": 10}
    ]
    
    top_clients = await db.appointments.aggregate(pipeline).to_list(10)
    
    return {
        "period": period,
        "summary": {
            "total_clients": total_clients,
            "new_clients": new_clients,
            "returning_clients": total_clients - new_clients if total_clients > new_clients else 0
        },
        "top_clients": [
            {
                "client_id": c["_id"],
                "client_name": c["client_name"],
                "booking_count": c["booking_count"],
                "total_spent": round(c["total_spent"], 2)
            }
            for c in top_clients
        ]
    }


@analytics_router.get("/peak-hours")
async def get_peak_hours(
    request: Request,
    period: str = Query("month", enum=["week", "month", "quarter"])
):
    """Get booking distribution by hour and day of week"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    await check_feature_access(db, user.tenant_id, PlanFeature.BASIC_REPORTS)
    
    start_date, end_date = await get_date_range(period)
    
    # Get all appointments in period
    appointments = await db.appointments.find(
        {
            "tenant_id": user.tenant_id,
            "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
        },
        {"_id": 0, "start_time": 1}
    ).to_list(10000)
    
    # Count by hour
    hour_counts = {h: 0 for h in range(24)}
    day_counts = {d: 0 for d in range(7)}  # 0=Monday
    
    for apt in appointments:
        try:
            dt = datetime.fromisoformat(apt["start_time"].replace("Z", "+00:00"))
            hour_counts[dt.hour] += 1
            day_counts[dt.weekday()] += 1
        except:
            pass
    
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    return {
        "period": period,
        "by_hour": [
            {"hour": h, "count": c, "label": f"{h:02d}:00"}
            for h, c in hour_counts.items()
        ],
        "by_day": [
            {"day": d, "name": day_names[d], "count": day_counts[d]}
            for d in range(7)
        ]
    }


@analytics_router.get("/receptionist")
async def get_receptionist_analytics(
    request: Request,
    period: str = Query("month", enum=["week", "month", "quarter"])
):
    """Get AI receptionist analytics"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    await check_feature_access(db, user.tenant_id, PlanFeature.AI_ASSISTANT)
    
    start_date, end_date = await get_date_range(period)
    
    # Total conversations
    total_conversations = await db.conversations.count_documents({
        "tenant_id": user.tenant_id,
        "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
    })
    
    # By status
    resolved = await db.conversations.count_documents({
        "tenant_id": user.tenant_id,
        "status": "resolved",
        "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
    })
    
    handoffs = await db.conversations.count_documents({
        "tenant_id": user.tenant_id,
        "handoff_reason": {"$ne": None},
        "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
    })
    
    # Booking conversions
    booking_intents = await db.conversations.count_documents({
        "tenant_id": user.tenant_id,
        "booking_intent_detected": True,
        "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
    })
    
    bookings_created = await db.conversations.count_documents({
        "tenant_id": user.tenant_id,
        "related_appointment_id": {"$ne": None},
        "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
    })
    
    # Average resolution time
    resolution_pipeline = [
        {
            "$match": {
                "tenant_id": user.tenant_id,
                "status": "resolved",
                "resolution_time_ms": {"$ne": None},
                "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
            }
        },
        {
            "$group": {
                "_id": None,
                "avg_resolution_time": {"$avg": "$resolution_time_ms"}
            }
        }
    ]
    resolution_result = await db.conversations.aggregate(resolution_pipeline).to_list(1)
    avg_resolution_ms = resolution_result[0]["avg_resolution_time"] if resolution_result else 0
    
    # Handoff reasons
    handoff_pipeline = [
        {
            "$match": {
                "tenant_id": user.tenant_id,
                "handoff_reason": {"$ne": None},
                "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
            }
        },
        {
            "$group": {
                "_id": "$handoff_reason",
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"count": -1}}
    ]
    handoff_reasons = await db.conversations.aggregate(handoff_pipeline).to_list(20)
    
    return {
        "period": period,
        "summary": {
            "total_conversations": total_conversations,
            "resolved": resolved,
            "handoffs": handoffs,
            "handoff_rate": round(handoffs / total_conversations * 100, 1) if total_conversations > 0 else 0,
            "booking_intents": booking_intents,
            "bookings_created": bookings_created,
            "conversion_rate": round(bookings_created / booking_intents * 100, 1) if booking_intents > 0 else 0,
            "avg_resolution_time_minutes": round(avg_resolution_ms / 60000, 1) if avg_resolution_ms else 0
        },
        "handoff_reasons": [
            {"reason": r["_id"], "count": r["count"]}
            for r in handoff_reasons
        ]
    }
