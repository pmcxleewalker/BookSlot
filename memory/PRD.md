# BookSlot - Multi-tenant SaaS Booking Platform

## Original Problem Statement
Build a production-ready multi-tenant SaaS booking platform for V1 appointment-based businesses only:
- Supported industries: salons, clinics, dentists, doctors, vets, consultants, service businesses
- Core positioning: Simple booking software with transparent pricing, fast setup, and AI receptionist
- **NEW REQUIREMENT (March 2026):** Super Admin Dashboard to manage all tenants, create tenants manually, and assign pricing tiers/features

## User Personas
1. **Platform Owner (Super Admin)**: Manages all tenants, creates businesses, assigns tiers
2. **Business Owner (Tenant Admin)**: Small to medium service business owner wanting simple appointment scheduling
3. **Staff Member**: Employee who needs to view/manage their own schedule
4. **Client**: End customer booking appointments online
5. **AI Receptionist (Moltbot)**: External system that books appointments via API

## Core Requirements (V1)
- Multi-tenant architecture (tenant isolation via tenant_id)
- Dual authentication (JWT + Google OAuth)
- 3-step onboarding wizard
- Service and staff management
- Online booking page (public facing)
- Calendar view with drag-drop appointments
- Client database
- AI Receptionist API endpoints (Moltbot-ready)
- Webhook support for booking events
- GDPR-compliant design
- **Super Admin Dashboard with tier management**

## What's Been Implemented

### Backend (FastAPI + MongoDB) - Updated March 2026
- [x] User authentication (JWT + Google OAuth via Emergent)
- [x] Multi-tenant data models (Tenant, User, Staff, Service, Resource, Client, Appointment, Form, Webhook)
- [x] All CRUD endpoints for staff, services, resources, clients, appointments
- [x] Conflict detection for bookings
- [x] Public booking endpoints (/api/public/booking/{slug})
- [x] AI Receptionist API endpoints (/api/receptionist/{tenant_id}/*)
- [x] **Enhanced Webhook dispatcher with:**
  - Delivery logs tracking
  - HMAC-SHA256 signature verification
  - Automatic retry mechanism (3 attempts)
  - Test webhook endpoint
  - Webhook configuration endpoints
- [x] Dashboard statistics endpoint
- [x] Demo data seeding endpoint
- [x] **Super Admin System:**
  - Admin authentication (/api/admin/login, /api/admin/me, /api/admin/logout)
  - Platform stats (/api/admin/stats)
  - Tenant CRUD (/api/admin/tenants)
  - Tenant detail with stats (/api/admin/tenants/{id})
  - Plan tier changes with feature enforcement
  - Tenant activation/deactivation
  - User impersonation for support
- [x] **Plan-based feature enforcement:**
  - Staff limits per plan (Starter=2, Growth=8, Pro=unlimited)
  - Feature access control based on tenant plan

### Frontend (React + Tailwind + Shadcn)
- [x] Public pages: Landing, Features, Pricing, Login, Signup
- [x] Public booking page with 5-step flow
- [x] Manage booking page (view/cancel by confirmation code)
- [x] Onboarding wizard (3 steps: business name, industry, contact)
- [x] Dashboard with stats cards and upcoming appointments
- [x] Calendar page with week view
- [x] Staff management page
- [x] Services management page
- [x] Clients page with search
- [x] Resources page (Pro feature)
- [x] Forms page (Pro feature placeholder)
- [x] Messages/reminders page (MOCKED)
- [x] Reports page with stats
- [x] Settings page
- [x] Integrations page with API docs and webhook config
- [x] AI Receptionist demo widget (Moltbot chat)
- [x] **Super Admin Portal:**
  - Admin Login Page (/admin)
  - Admin Dashboard with stats and revenue (/admin/dashboard)
  - Tenants List with search/filter (/admin/tenants)
  - Create Tenant Dialog with plan selection
  - Tenant Detail Page with plan editor (/admin/tenants/{id})

### Design
- Swiss/High-contrast design system
- Fonts: Cormorant Garamond (headings), Manrope (body), JetBrains Mono (code)
- Colors: #0A0A0A (primary), #E34A33 (accent), #4F46E5 (AI widget)
- Sharp-edged buttons and cards
- Mobile-responsive
- **Super Admin Dark Theme:** #121212 background with white/60 text, plan badges with color coding

## Pricing Tiers & Features
| Feature | Starter (€29) | Growth (€79) | Pro (€149) |
|---------|---------------|--------------|------------|
| Max Staff | 2 | 8 | Unlimited |
| Online Booking | ✓ | ✓ | ✓ |
| Reminders | ✓ | ✓ | ✓ |
| Deposits | ✓ | ✓ | ✓ |
| Calendar Sync | ✓ | ✓ | ✓ |
| Waitlist | - | ✓ | ✓ |
| AI Assistant | - | ✓ | ✓ |
| SMS Automations | - | ✓ | ✓ |
| Advanced Reports | - | ✓ | ✓ |
| Multi-location | - | - | ✓ |
| Resource Booking | - | - | ✓ |
| Custom Forms | - | - | ✓ |
| API & Webhooks | - | - | ✓ |

## Prioritized Backlog

### P0 (Critical) - COMPLETED ✅
- ✅ Core booking flow
- ✅ Authentication
- ✅ Multi-tenant architecture
- ✅ AI Receptionist API (Moltbot)
- ✅ Super Admin Dashboard
- ✅ Tier-based feature enforcement
- ✅ Webhook dispatcher with logs & retries

### P1 (High Priority) - IN PROGRESS
- [ ] Real email/SMS notifications (currently mocked)
- [ ] Stripe payment integration for deposits
- [ ] Google Calendar sync
- [ ] Working hours configuration per staff
- [ ] Drag-and-drop calendar (currently click-to-create)

### P2 (Medium Priority) - Deferred
- [ ] Custom intake forms builder
- [ ] Resource booking with conflict detection
- [ ] Waitlist automation
- [ ] Advanced reports with charts
- [ ] Multi-location support (Pro)

### P3 (Nice to Have)
- [ ] White-label branding
- [ ] Voice receptionist (telephony)
- [ ] API rate limiting
- [ ] Audit logs

## Test Accounts
- **Super Admin:** admin@bookslot.io / Admin123!
- **Demo Tenant:** demo@bookslot.io / Demo123!

## Key API Endpoints
- `/api/auth/*` - User authentication
- `/api/tenants/*` - Tenant management
- `/api/staff/*`, `/api/services/*`, `/api/clients/*` - Business data
- `/api/appointments/*` - Booking management
- `/api/webhooks/*` - Webhook configuration
- `/api/receptionist/{tenant_id}/*` - Moltbot AI API
- `/api/admin/*` - Super Admin APIs
- `/api/public/booking/{slug}/*` - Public booking

## Next Tasks
1. Implement real email notifications (SendGrid or Resend)
2. Add Stripe payment integration for deposits
3. Implement drag-and-drop calendar
4. Add working hours configuration per staff
5. Build custom forms builder
