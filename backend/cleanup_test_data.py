"""
Cleanup script for test tenant data
- Fix €0 prices 
- Remove trailing spaces
- Add descriptions to services
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "bookslot")

# Default descriptions for common service types
SERVICE_DESCRIPTIONS = {
    "haircut": "Professional haircut service tailored to your style",
    "cut": "Precision cutting by our skilled stylists",
    "color": "Expert color services for a vibrant new look",
    "colour": "Expert colour services for a vibrant new look",
    "styling": "Complete styling service for any occasion",
    "blowout": "Professional blowout for salon-quality results",
    "highlights": "Beautiful highlights to enhance your natural look",
    "treatment": "Nourishing treatment for healthy, beautiful hair",
    "manicure": "Classic manicure for perfectly polished nails",
    "pedicure": "Relaxing pedicure for beautiful feet",
    "massage": "Relaxing massage therapy session",
    "facial": "Rejuvenating facial treatment",
    "waxing": "Smooth, professional waxing service",
    "consultation": "Personal consultation to discuss your needs",
    "makeup": "Professional makeup application",
    "extension": "High-quality extension services",
    "trim": "Quick trim to keep your style fresh",
    "shave": "Classic shave for a clean, polished look",
    "beard": "Expert beard trimming and styling",
    "spa": "Luxurious spa treatment experience",
}

# Default prices based on service type (if price is 0)
DEFAULT_PRICES = {
    "haircut": 45,
    "cut": 40,
    "color": 85,
    "colour": 85,
    "styling": 55,
    "blowout": 35,
    "highlights": 120,
    "treatment": 50,
    "manicure": 30,
    "pedicure": 45,
    "massage": 80,
    "facial": 75,
    "waxing": 25,
    "consultation": 0,  # Often free
    "makeup": 60,
    "extension": 150,
    "trim": 25,
    "shave": 20,
    "beard": 25,
    "spa": 100,
}

async def cleanup_services():
    """Clean up service data"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    services = await db.services.find({}).to_list(None)
    updated_count = 0
    
    for service in services:
        updates = {}
        name = service.get("name", "").strip()
        
        # Fix trailing spaces in name
        if name != service.get("name"):
            updates["name"] = name
        
        # Fix €0 prices
        price = service.get("price", 0)
        if price == 0 or price is None:
            # Try to find a default price based on service name
            name_lower = name.lower()
            for keyword, default_price in DEFAULT_PRICES.items():
                if keyword in name_lower:
                    updates["price"] = default_price
                    break
            else:
                # Default fallback price
                updates["price"] = 50
        
        # Add description if missing
        description = service.get("description") or ""
        description = description.strip() if description else ""
        if not description:
            name_lower = name.lower()
            for keyword, desc in SERVICE_DESCRIPTIONS.items():
                if keyword in name_lower:
                    updates["description"] = desc
                    break
            else:
                updates["description"] = f"Professional {name} service"
        
        # Apply updates
        if updates:
            await db.services.update_one(
                {"service_id": service["service_id"]},
                {"$set": updates}
            )
            updated_count += 1
            print(f"Updated service: {name} -> {updates}")
    
    print(f"\nTotal services updated: {updated_count}")
    
    # Also clean up tenant names
    tenants = await db.tenants.find({}).to_list(None)
    for tenant in tenants:
        name = tenant.get("name", "").strip()
        if name != tenant.get("name"):
            await db.tenants.update_one(
                {"tenant_id": tenant["tenant_id"]},
                {"$set": {"name": name}}
            )
            print(f"Fixed tenant name trailing space: {tenant['name']} -> {name}")
    
    client.close()
    print("Cleanup complete!")

if __name__ == "__main__":
    asyncio.run(cleanup_services())
