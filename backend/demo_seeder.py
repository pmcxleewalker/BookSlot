"""
Demo Data Seeder for TimeSlot Pro
Creates sample tenants with realistic data for testing and demos
"""
import asyncio
import random
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
import hashlib

from models import (
    Tenant, User, Subscription, Location, StaffMember, StaffSchedule,
    Service, ServiceCategory, Resource, Client, Appointment,
    WorkingHours, IndustryType, PlanType, UserRole, BookingStatus,
    generate_id
)
from models_v2 import (
    Conversation, ConversationMessage, ConversationStatus,
    ConversationChannel, MessageSenderType, ConversationPriority
)


def hash_password(password: str) -> str:
    """Use bcrypt password hashing for demo accounts"""
    from auth import hash_password as auth_hash
    return auth_hash(password)


# Demo data templates
DEMO_TENANTS = [
    {
        "name": "Luxe Hair Studio",
        "slug": "luxe-hair-studio",
        "industry": IndustryType.SALON,
        "email": "hello@luxehair.demo",
        "phone": "+1 555-0101",
        "address": "123 Style Avenue",
        "city": "New York",
        "country": "USA",
        "timezone": "America/New_York",
        "plan": PlanType.GROWTH,
        "staff": [
            {"name": "Sarah Johnson", "title": "Senior Stylist", "color": "#E91E63", "email": "sarah@luxehair.demo"},
            {"name": "Mike Chen", "title": "Color Specialist", "color": "#9C27B0", "email": "mike@luxehair.demo"},
            {"name": "Emma Davis", "title": "Stylist", "color": "#2196F3", "email": "emma@luxehair.demo"},
            {"name": "James Wilson", "title": "Barber", "color": "#4CAF50", "email": "james@luxehair.demo"},
        ],
        "services": [
            {"name": "Haircut - Women", "duration": 45, "price": 65.0, "category": "Cuts"},
            {"name": "Haircut - Men", "duration": 30, "price": 35.0, "category": "Cuts"},
            {"name": "Hair Color - Full", "duration": 120, "price": 150.0, "category": "Color"},
            {"name": "Hair Color - Highlights", "duration": 90, "price": 120.0, "category": "Color"},
            {"name": "Blowout & Style", "duration": 30, "price": 45.0, "category": "Styling"},
            {"name": "Deep Conditioning Treatment", "duration": 30, "price": 40.0, "category": "Treatments"},
            {"name": "Balayage", "duration": 150, "price": 200.0, "category": "Color"},
            {"name": "Keratin Treatment", "duration": 180, "price": 250.0, "category": "Treatments"},
        ],
        "resources": [
            {"name": "Styling Station 1", "type": "station"},
            {"name": "Styling Station 2", "type": "station"},
            {"name": "Color Station", "type": "station"},
            {"name": "Wash Basin 1", "type": "equipment"},
            {"name": "Wash Basin 2", "type": "equipment"},
        ],
    },
    {
        "name": "Wellness Medical Clinic",
        "slug": "wellness-clinic",
        "industry": IndustryType.CLINIC,
        "email": "appointments@wellnessmed.demo",
        "phone": "+1 555-0202",
        "address": "456 Health Boulevard",
        "city": "Los Angeles",
        "country": "USA",
        "timezone": "America/Los_Angeles",
        "plan": PlanType.PRO,
        "staff": [
            {"name": "Dr. Amanda Richards", "title": "General Practitioner", "color": "#1976D2", "email": "dr.richards@wellnessmed.demo"},
            {"name": "Dr. Robert Kim", "title": "Specialist", "color": "#388E3C", "email": "dr.kim@wellnessmed.demo"},
            {"name": "Nurse Patricia", "title": "Registered Nurse", "color": "#7B1FA2", "email": "patricia@wellnessmed.demo"},
            {"name": "Dr. Lisa Thompson", "title": "Pediatrician", "color": "#F57C00", "email": "dr.thompson@wellnessmed.demo"},
        ],
        "services": [
            {"name": "General Consultation", "duration": 30, "price": 100.0, "category": "Consultations"},
            {"name": "Follow-up Visit", "duration": 15, "price": 60.0, "category": "Consultations"},
            {"name": "Annual Physical Exam", "duration": 60, "price": 200.0, "category": "Exams"},
            {"name": "Blood Work", "duration": 15, "price": 50.0, "category": "Lab"},
            {"name": "Vaccination", "duration": 15, "price": 40.0, "category": "Preventive"},
            {"name": "Specialist Consultation", "duration": 45, "price": 150.0, "category": "Consultations"},
            {"name": "Pediatric Checkup", "duration": 30, "price": 80.0, "category": "Pediatrics"},
        ],
        "resources": [
            {"name": "Exam Room 1", "type": "room"},
            {"name": "Exam Room 2", "type": "room"},
            {"name": "Exam Room 3", "type": "room"},
            {"name": "Lab Room", "type": "room"},
            {"name": "ECG Machine", "type": "equipment"},
        ],
    },
    {
        "name": "Elite Consulting Group",
        "slug": "elite-consulting",
        "industry": IndustryType.CONSULTANT,
        "email": "book@eliteconsulting.demo",
        "phone": "+1 555-0303",
        "address": "789 Business Park",
        "city": "Chicago",
        "country": "USA",
        "timezone": "America/Chicago",
        "plan": PlanType.STARTER,
        "staff": [
            {"name": "Jennifer Adams", "title": "Senior Consultant", "color": "#00796B", "email": "jennifer@eliteconsulting.demo"},
            {"name": "David Park", "title": "Business Analyst", "color": "#C2185B", "email": "david@eliteconsulting.demo"},
        ],
        "services": [
            {"name": "Strategy Session", "duration": 60, "price": 200.0, "category": "Consulting"},
            {"name": "Business Review", "duration": 90, "price": 300.0, "category": "Consulting"},
            {"name": "Quick Consultation", "duration": 30, "price": 100.0, "category": "Consulting"},
            {"name": "Workshop - Half Day", "duration": 240, "price": 800.0, "category": "Training"},
        ],
        "resources": [
            {"name": "Meeting Room A", "type": "room"},
            {"name": "Conference Room", "type": "room"},
        ],
    },
]

SAMPLE_CLIENTS = [
    {"name": "Alice Thompson", "email": "alice.t@email.com", "phone": "+1 555-1001"},
    {"name": "Bob Martinez", "email": "bob.m@email.com", "phone": "+1 555-1002"},
    {"name": "Carol White", "email": "carol.w@email.com", "phone": "+1 555-1003"},
    {"name": "Daniel Brown", "email": "daniel.b@email.com", "phone": "+1 555-1004"},
    {"name": "Eva Garcia", "email": "eva.g@email.com", "phone": "+1 555-1005"},
    {"name": "Frank Lee", "email": "frank.l@email.com", "phone": "+1 555-1006"},
    {"name": "Grace Kim", "email": "grace.k@email.com", "phone": "+1 555-1007"},
    {"name": "Henry Wilson", "email": "henry.w@email.com", "phone": "+1 555-1008"},
    {"name": "Iris Chen", "email": "iris.c@email.com", "phone": "+1 555-1009"},
    {"name": "Jack Davis", "email": "jack.d@email.com", "phone": "+1 555-1010"},
    {"name": "Karen Moore", "email": "karen.m@email.com", "phone": "+1 555-1011"},
    {"name": "Leo Taylor", "email": "leo.t@email.com", "phone": "+1 555-1012"},
    {"name": "Maria Rodriguez", "email": "maria.r@email.com", "phone": "+1 555-1013"},
    {"name": "Nathan Clark", "email": "nathan.c@email.com", "phone": "+1 555-1014"},
    {"name": "Olivia Hall", "email": "olivia.h@email.com", "phone": "+1 555-1015"},
]

SAMPLE_CONVERSATIONS = [
    {
        "client_name": "New Customer",
        "status": ConversationStatus.WAITING_HUMAN,
        "priority": ConversationPriority.HIGH,
        "messages": [
            {"sender": "client", "content": "Hi, I'd like to book a haircut for this Saturday"},
            {"sender": "ai", "content": "Hello! I'd be happy to help you book a haircut. We have availability this Saturday. Would you prefer morning or afternoon?"},
            {"sender": "client", "content": "Morning would be great, around 10am if possible"},
            {"sender": "ai", "content": "I see we have a slot at 10:00 AM with Sarah Johnson, our Senior Stylist. Shall I book that for you?"},
            {"sender": "client", "content": "Actually, can I speak to someone? I have some questions about coloring too"},
            {"sender": "system", "content": "Customer requested human assistance"},
        ],
        "handoff_reason": "client_request"
    },
    {
        "client_name": "Regular Client",
        "status": ConversationStatus.RESOLVED,
        "priority": ConversationPriority.NORMAL,
        "messages": [
            {"sender": "client", "content": "I need to reschedule my appointment tomorrow"},
            {"sender": "ai", "content": "Of course! I can help you reschedule. Your current appointment is tomorrow at 2:00 PM for a Haircut with Emma. When would you like to reschedule to?"},
            {"sender": "client", "content": "Can I move it to Thursday same time?"},
            {"sender": "ai", "content": "I've rescheduled your appointment to Thursday at 2:00 PM with Emma. You'll receive a confirmation email shortly."},
            {"sender": "client", "content": "Perfect, thank you!"},
        ],
    },
    {
        "client_name": "VIP Client",
        "status": ConversationStatus.ACTIVE,
        "priority": ConversationPriority.URGENT,
        "messages": [
            {"sender": "client", "content": "I'm a long-time client and I need an urgent appointment today"},
            {"sender": "ai", "content": "Welcome back! I can see you're one of our valued regular clients. Let me check our availability for today. What service do you need?"},
        ],
    },
]


def create_working_hours() -> List[Dict[str, Any]]:
    """Create standard working hours (Mon-Fri 9-17, Sat 10-16)"""
    hours = []
    for day in range(5):  # Monday to Friday
        hours.append({
            "day_of_week": day,
            "start_time": "09:00",
            "end_time": "17:00",
            "is_working": True
        })
    # Saturday
    hours.append({
        "day_of_week": 5,
        "start_time": "10:00",
        "end_time": "16:00",
        "is_working": True
    })
    # Sunday - off
    hours.append({
        "day_of_week": 6,
        "start_time": "09:00",
        "end_time": "17:00",
        "is_working": False
    })
    return hours


async def seed_demo_data(db: AsyncIOMotorDatabase, clear_existing: bool = False):
    """
    Seed the database with demo data
    
    Args:
        db: Database instance
        clear_existing: If True, removes existing demo data first
    """
    print("Starting demo data seeding...")
    
    if clear_existing:
        # Remove existing demo data (identified by .demo email)
        print("Clearing existing demo data...")
        demo_tenants = await db.tenants.find(
            {"email": {"$regex": r"\.demo$"}},
            {"tenant_id": 1}
        ).to_list(100)
        
        for t in demo_tenants:
            tid = t["tenant_id"]
            await db.appointments.delete_many({"tenant_id": tid})
            await db.clients.delete_many({"tenant_id": tid})
            await db.services.delete_many({"tenant_id": tid})
            await db.service_categories.delete_many({"tenant_id": tid})
            await db.staff.delete_many({"tenant_id": tid})
            await db.staff_schedules.delete_many({"tenant_id": tid})
            await db.resources.delete_many({"tenant_id": tid})
            await db.locations.delete_many({"tenant_id": tid})
            await db.subscriptions.delete_many({"tenant_id": tid})
            await db.conversations.delete_many({"tenant_id": tid})
            await db.conversation_messages.delete_many({"tenant_id": tid})
            await db.users.delete_many({"tenant_id": tid})
        
        await db.tenants.delete_many({"email": {"$regex": r"\.demo$"}})
        await db.users.delete_many({"email": {"$regex": r"\.demo$"}})
    
    created_tenants = []
    
    for tenant_data in DEMO_TENANTS:
        print(f"Creating tenant: {tenant_data['name']}...")
        
        # Check if already exists
        existing = await db.tenants.find_one({"slug": tenant_data["slug"]})
        if existing:
            print(f"  Tenant {tenant_data['slug']} already exists, skipping...")
            continue
        
        # Create tenant
        tenant = Tenant(
            name=tenant_data["name"],
            slug=tenant_data["slug"],
            industry=tenant_data["industry"],
            email=tenant_data["email"],
            phone=tenant_data["phone"],
            address=tenant_data["address"],
            city=tenant_data["city"],
            country=tenant_data["country"],
            timezone=tenant_data["timezone"],
        )
        tenant_doc = tenant.model_dump()
        tenant_doc["created_at"] = tenant_doc["created_at"].isoformat()
        tenant_doc["updated_at"] = tenant_doc["updated_at"].isoformat()
        await db.tenants.insert_one(tenant_doc)
        
        tenant_id = tenant.tenant_id
        created_tenants.append({"tenant_id": tenant_id, "slug": tenant_data["slug"]})
        
        # Create owner user
        owner = User(
            tenant_id=tenant_id,
            email=f"owner@{tenant_data['slug']}.demo",
            name=f"{tenant_data['name']} Owner",
            role=UserRole.OWNER,
            password_hash=hash_password("demo123")
        )
        owner_doc = owner.model_dump()
        owner_doc["created_at"] = owner_doc["created_at"].isoformat()
        owner_doc["updated_at"] = owner_doc["updated_at"].isoformat()
        await db.users.insert_one(owner_doc)
        
        # Create subscription
        plan = tenant_data["plan"]
        from plan_gating import get_plan_definition
        plan_def = get_plan_definition(plan.value)
        
        subscription = Subscription(
            tenant_id=tenant_id,
            plan=plan,
            price_monthly=plan_def["price_monthly"],
            max_locations=plan_def["max_locations"],
            max_staff=plan_def["max_staff"],
            features=[f.value for f in plan_def["features"]],
            is_trial=False
        )
        sub_doc = subscription.model_dump()
        sub_doc["created_at"] = sub_doc["created_at"].isoformat()
        sub_doc["updated_at"] = sub_doc["updated_at"].isoformat()
        sub_doc["start_date"] = sub_doc["start_date"].isoformat()
        await db.subscriptions.insert_one(sub_doc)
        
        # Create location
        location = Location(
            tenant_id=tenant_id,
            name="Main Location",
            address=tenant_data["address"],
            city=tenant_data["city"],
            timezone=tenant_data["timezone"],
            is_primary=True
        )
        loc_doc = location.model_dump()
        loc_doc["created_at"] = loc_doc["created_at"].isoformat()
        loc_doc["updated_at"] = loc_doc["updated_at"].isoformat()
        await db.locations.insert_one(loc_doc)
        
        # Create service categories and services
        categories = {}
        for svc in tenant_data["services"]:
            cat_name = svc.get("category", "General")
            if cat_name not in categories:
                cat = ServiceCategory(
                    tenant_id=tenant_id,
                    name=cat_name,
                    sort_order=len(categories)
                )
                cat_doc = cat.model_dump()
                cat_doc["created_at"] = cat_doc["created_at"].isoformat()
                cat_doc["updated_at"] = cat_doc["updated_at"].isoformat()
                await db.service_categories.insert_one(cat_doc)
                categories[cat_name] = cat.category_id
        
        # Create services
        service_ids = []
        for svc in tenant_data["services"]:
            service = Service(
                tenant_id=tenant_id,
                category_id=categories.get(svc.get("category")),
                name=svc["name"],
                duration=svc["duration"],
                price=svc["price"],
                buffer_before=5,
                buffer_after=5
            )
            svc_doc = service.model_dump()
            svc_doc["created_at"] = svc_doc["created_at"].isoformat()
            svc_doc["updated_at"] = svc_doc["updated_at"].isoformat()
            await db.services.insert_one(svc_doc)
            service_ids.append(service.service_id)
        
        # Create staff
        staff_ids = []
        for staff_data in tenant_data["staff"]:
            staff = StaffMember(
                tenant_id=tenant_id,
                location_id=location.location_id,
                name=staff_data["name"],
                email=staff_data.get("email"),
                title=staff_data.get("title"),
                color=staff_data.get("color", "#2E473B"),
                services=service_ids[:4]  # Assign first 4 services
            )
            staff_doc = staff.model_dump()
            staff_doc["created_at"] = staff_doc["created_at"].isoformat()
            staff_doc["updated_at"] = staff_doc["updated_at"].isoformat()
            await db.staff.insert_one(staff_doc)
            staff_ids.append(staff.staff_id)
            
            # Create schedule
            schedule = StaffSchedule(
                staff_id=staff.staff_id,
                tenant_id=tenant_id,
                working_hours=create_working_hours()
            )
            sched_doc = schedule.model_dump()
            sched_doc["created_at"] = sched_doc["created_at"].isoformat()
            sched_doc["updated_at"] = sched_doc["updated_at"].isoformat()
            await db.staff_schedules.insert_one(sched_doc)
        
        # Create resources
        for res_data in tenant_data.get("resources", []):
            resource = Resource(
                tenant_id=tenant_id,
                location_id=location.location_id,
                name=res_data["name"],
                resource_type=res_data.get("type", "room"),
                services=service_ids
            )
            res_doc = resource.model_dump()
            res_doc["created_at"] = res_doc["created_at"].isoformat()
            res_doc["updated_at"] = res_doc["updated_at"].isoformat()
            await db.resources.insert_one(res_doc)
        
        # Create clients
        client_ids = []
        for client_data in SAMPLE_CLIENTS[:10]:
            client = Client(
                tenant_id=tenant_id,
                name=client_data["name"],
                email=client_data["email"],
                phone=client_data["phone"],
                total_bookings=random.randint(1, 15),
                total_spent=random.uniform(100, 1500)
            )
            client_doc = client.model_dump()
            client_doc["created_at"] = client_doc["created_at"].isoformat()
            client_doc["updated_at"] = client_doc["updated_at"].isoformat()
            await db.clients.insert_one(client_doc)
            client_ids.append(client.client_id)
        
        # Create sample appointments (past and future)
        now = datetime.now(timezone.utc)
        
        # Past appointments (last 30 days)
        for i in range(20):
            days_ago = random.randint(1, 30)
            hour = random.randint(9, 16)
            start_time = (now - timedelta(days=days_ago)).replace(
                hour=hour, minute=random.choice([0, 15, 30, 45]), second=0, microsecond=0
            )
            
            service_idx = random.randint(0, len(service_ids) - 1)
            staff_idx = random.randint(0, len(staff_ids) - 1)
            client_idx = random.randint(0, len(client_ids) - 1)
            
            svc = await db.services.find_one({"service_id": service_ids[service_idx]}, {"_id": 0})
            client = await db.clients.find_one({"client_id": client_ids[client_idx]}, {"_id": 0})
            
            duration = svc.get("duration", 30) + svc.get("buffer_before", 0) + svc.get("buffer_after", 0)
            
            apt = Appointment(
                tenant_id=tenant_id,
                location_id=location.location_id,
                client_id=client_ids[client_idx],
                staff_id=staff_ids[staff_idx],
                service_id=service_ids[service_idx],
                start_time=start_time,
                end_time=start_time + timedelta(minutes=duration),
                status=random.choice([BookingStatus.COMPLETED, BookingStatus.COMPLETED, BookingStatus.NO_SHOW]),
                client_name=client["name"],
                client_email=client.get("email"),
                client_phone=client.get("phone"),
                price=svc.get("price", 0),
                source=random.choice(["online", "phone", "walk-in"])
            )
            apt_doc = apt.model_dump()
            apt_doc["created_at"] = apt_doc["created_at"].isoformat()
            apt_doc["updated_at"] = apt_doc["updated_at"].isoformat()
            apt_doc["start_time"] = apt_doc["start_time"].isoformat()
            apt_doc["end_time"] = apt_doc["end_time"].isoformat()
            await db.appointments.insert_one(apt_doc)
        
        # Future appointments (next 14 days)
        for i in range(15):
            days_ahead = random.randint(1, 14)
            hour = random.randint(9, 16)
            start_time = (now + timedelta(days=days_ahead)).replace(
                hour=hour, minute=random.choice([0, 15, 30, 45]), second=0, microsecond=0
            )
            
            service_idx = random.randint(0, len(service_ids) - 1)
            staff_idx = random.randint(0, len(staff_ids) - 1)
            client_idx = random.randint(0, len(client_ids) - 1)
            
            svc = await db.services.find_one({"service_id": service_ids[service_idx]}, {"_id": 0})
            client = await db.clients.find_one({"client_id": client_ids[client_idx]}, {"_id": 0})
            
            duration = svc.get("duration", 30) + svc.get("buffer_before", 0) + svc.get("buffer_after", 0)
            
            apt = Appointment(
                tenant_id=tenant_id,
                location_id=location.location_id,
                client_id=client_ids[client_idx],
                staff_id=staff_ids[staff_idx],
                service_id=service_ids[service_idx],
                start_time=start_time,
                end_time=start_time + timedelta(minutes=duration),
                status=BookingStatus.CONFIRMED,
                client_name=client["name"],
                client_email=client.get("email"),
                client_phone=client.get("phone"),
                price=svc.get("price", 0),
                source="online"
            )
            apt_doc = apt.model_dump()
            apt_doc["created_at"] = apt_doc["created_at"].isoformat()
            apt_doc["updated_at"] = apt_doc["updated_at"].isoformat()
            apt_doc["start_time"] = apt_doc["start_time"].isoformat()
            apt_doc["end_time"] = apt_doc["end_time"].isoformat()
            await db.appointments.insert_one(apt_doc)
        
        # Create sample conversations (only for first tenant - salon)
        if tenant_data["slug"] == "luxe-hair-studio":
            for conv_data in SAMPLE_CONVERSATIONS:
                conv = Conversation(
                    tenant_id=tenant_id,
                    client_name=conv_data["client_name"],
                    channel=ConversationChannel.API,
                    status=conv_data["status"],
                    priority=conv_data["priority"],
                    handoff_reason=conv_data.get("handoff_reason"),
                    message_count=len(conv_data["messages"]),
                    ai_message_count=len([m for m in conv_data["messages"] if m["sender"] == "ai"]),
                    human_message_count=0
                )
                conv_doc = conv.model_dump()
                conv_doc["created_at"] = conv_doc["created_at"].isoformat()
                conv_doc["updated_at"] = conv_doc["updated_at"].isoformat()
                if conv_doc.get("handoff_requested_at"):
                    conv_doc["handoff_requested_at"] = conv_doc["handoff_requested_at"].isoformat()
                await db.conversations.insert_one(conv_doc)
                
                # Add messages
                for idx, msg_data in enumerate(conv_data["messages"]):
                    sender_map = {
                        "client": MessageSenderType.CLIENT,
                        "ai": MessageSenderType.AI,
                        "staff": MessageSenderType.STAFF,
                        "system": MessageSenderType.SYSTEM,
                    }
                    msg = ConversationMessage(
                        conversation_id=conv.conversation_id,
                        tenant_id=tenant_id,
                        sender_type=sender_map[msg_data["sender"]],
                        sender_name=conv_data["client_name"] if msg_data["sender"] == "client" else None,
                        content=msg_data["content"]
                    )
                    msg_doc = msg.model_dump()
                    msg_doc["created_at"] = (datetime.now(timezone.utc) - timedelta(minutes=len(conv_data["messages"]) - idx)).isoformat()
                    msg_doc["updated_at"] = msg_doc["created_at"]
                    await db.conversation_messages.insert_one(msg_doc)
        
        print(f"  Created tenant {tenant_data['name']} with {len(staff_ids)} staff, {len(service_ids)} services")
    
    print("\nDemo data seeding complete!")
    print("\nDemo accounts created:")
    for t in created_tenants:
        print(f"  - {t['slug']}: owner@{t['slug']}.demo / demo123")
    
    return created_tenants


async def clear_all_demo_data(db: AsyncIOMotorDatabase):
    """Remove all demo data from the database"""
    await seed_demo_data(db, clear_existing=True)


# CLI entry point
if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    from motor.motor_asyncio import AsyncIOMotorClient
    
    # Load environment from .env file
    load_dotenv()
    
    async def main():
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        
        print(f"Connecting to: {mongo_url}, DB: {db_name}")
        
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        import sys
        clear = "--clear" in sys.argv
        
        await seed_demo_data(db, clear_existing=clear)
        
        client.close()
    
    asyncio.run(main())
