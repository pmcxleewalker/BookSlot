# TimeSlot Pro - Product Requirements Document

## Original Problem Statement
Build a multi-tenant SaaS booking platform with a Franchise Control Center (Super Admin) for managing all tenants. The platform should be industry-neutral, working for salons, barbers, dentists, doctors, consultants, and any appointment-based business. Each tenant gets customizable branding and their own booking page.

## Core Features

### Phase 1 (Completed - March 2026)

#### 1. Franchise Control Center (Super Admin)
- **Super Admin Authentication**
  - Register with admin secret key: `timeslot_franchise_2024`
  - Login at `/admin/login`
  - Session-based auth using X-Admin-Token header

- **Dashboard Overview** (`/admin/dashboard`)
  - Total tenants, active tenants count
  - Total appointments across platform
  - Total revenue
  - Tenants by plan breakdown (Starter, Growth, Pro)
  - Tenants by industry
  - Recent signups list

- **Tenant Management** (`/admin/tenants`)
  - List all tenants with search and filters (plan, industry)
  - Create new tenant with owner account
  - View tenant details with stats
  - Edit tenant information
  - Suspend/Activate tenants
  - Change tenant subscription plan
  - Delete tenant and all data

#### 2. Tenant Branding Customization
- **Branding Page** (`/dashboard/branding`)
  - Live preview of booking page
  - Customizable colors:
    - Primary color (buttons, headers)
    - Secondary color (accents)
    - Accent color (special elements)
    - Background color
    - Text color
  - Font family selection
  - "Powered by TimeSlot Pro" toggle

- **Public Booking Pages**
  - Each tenant gets unique URL: `/book/{slug}`
  - Applies tenant's branding colors and font
  - Shows tenant logo (if uploaded)

#### 3. Subscription Plans
- **Starter** (€29/mo): 2 staff, 1 location
- **Growth** (€79/mo): 8 staff, AI features, reports
- **Pro** (€149/mo): 50 staff, multi-location, API/webhooks

### Phase 2 (Upcoming)
- SMS confirmations (Twilio integration)
- Payment collection (Stripe integration)
- AI Receptionist API integration

## Technical Architecture

### Backend (FastAPI + MongoDB)
```
/app/backend/
├── server.py          # Main API server
├── models.py          # Pydantic models
├── admin.py           # Super Admin APIs
├── auth.py            # Authentication
├── booking.py         # Booking logic
├── webhooks.py        # Webhook system
└── email_service.py   # Email notifications
```

### Frontend (React + Tailwind + Shadcn)
```
/app/frontend/src/
├── App.js
├── contexts/
│   ├── AuthContext.js       # Tenant auth
│   └── AdminAuthContext.js  # Admin auth
├── pages/
│   ├── admin/               # Control Center
│   │   ├── AdminLogin.js
│   │   ├── AdminSetup.js
│   │   ├── AdminDashboard.js
│   │   ├── AdminTenants.js
│   │   ├── AdminCreateTenant.js
│   │   └── AdminTenantDetail.js
│   ├── dashboard/           # Tenant Dashboard
│   │   ├── Branding.js
│   │   └── ...
│   └── PublicBooking.js     # Customer booking
```

### Key API Endpoints
- `POST /api/admin/auth/register` - Register super admin
- `POST /api/admin/auth/login` - Admin login
- `GET /api/admin/stats` - Platform statistics
- `GET /api/admin/tenants` - List tenants
- `POST /api/admin/tenants` - Create tenant
- `GET /api/settings/branding` - Get branding
- `PUT /api/settings/branding` - Update branding

## Test Credentials
```
Super Admin:
  email: admin@timeslotpro.com
  password: Admin123!
  admin_secret: timeslot_franchise_2024

Tenant User (Elite Dental Care):
  email: john@elitedental.com
  password: Test123!
```

## Database Collections
- `super_admins` - Platform administrators
- `admin_sessions` - Admin auth sessions
- `tenants` - Business accounts (with branding field)
- `subscriptions` - Plan subscriptions
- `users` - Tenant staff/owners
- `appointments` - Bookings
- `clients` - Customer records
- `services` - Service offerings
- `staff` - Staff members
- `staff_schedules` - Work schedules

## Testing Status
- Phase 1: **100% Complete** (26/26 backend tests passed)
- UI flows verified: Admin login, dashboard, tenant CRUD, branding

## Backlog / Future Features
- [ ] AI Receptionist integration (MoltBot/OpenClaw)
- [ ] SMS notifications (Twilio)
- [ ] Payment processing (Stripe)
- [ ] Webhook system for external integrations
- [ ] Multi-location support for Pro plan
- [ ] Advanced analytics dashboard
- [ ] White-label option for Pro plan
