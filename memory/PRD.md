# BookSlot - Multi-tenant SaaS Booking Platform

## Original Problem Statement
Build a production-ready multi-tenant SaaS booking platform for V1 appointment-based businesses only:
- Supported industries: salons, clinics, dentists, doctors, vets, consultants, service businesses
- Core positioning: Simple booking software with transparent pricing, fast setup, and AI receptionist
- **NEW REQUIREMENT (March 2026):** Super Admin Dashboard to manage all tenants, create tenants manually, and assign pricing tiers/features
- **NEW REQUIREMENT (March 2026):** Email/SMS notification system with SMS as paid add-on (+€10/month)
- **NEW REQUIREMENT (April 2026):** Smart Booking with conflict detection and admin approval workflow

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
- **Email reminders (free) + SMS add-on (+€10/month)**
- **Smart booking with conflict detection and alternative suggestions**
- **Admin approval workflow for all online bookings**

## What's Been Implemented

### Backend (FastAPI + MongoDB) - Updated April 2026
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
- [x] **Notification System:**
  - Email reminders via Resend (free tier: 3000/month)
  - SMS reminders via Twilio (+€10/month add-on)
  - Notification settings API
  - SMS add-on enable/disable
  - Notification logs with delivery status
  - Integration status endpoint
- [x] **Staff Working Hours:**
  - Custom working hours per staff member
  - Support for breaks during the day
  - Public availability respects working hours
  - Default working hours (Mon-Fri 9-5)
- [x] **Smart Booking Validation (NEW April 2026):**
  - Conflict detection (staff already booked)
  - Working hours validation
  - Break time detection
  - Returns 409 with alternative_times, alternative_days, alternative_staff
  - All online bookings created with "pending" status
- [x] **Approval Workflow (NEW April 2026):**
  - POST /api/appointments/{id}/approve - Approve pending booking
  - POST /api/appointments/{id}/reject - Reject pending booking
  - Status flow: pending → confirmed/rejected
- [x] **File Upload:**
  - POST /api/upload/image - Upload branding images (logos)
  - Supported formats: PNG, JPEG, WebP, SVG
  - Max file size: 5MB

### Frontend (React + Tailwind + Shadcn) - Updated April 2026
- [x] Public pages: Landing, Features, Pricing, Login, Signup
- [x] Public booking page with 5-step flow
- [x] Manage booking page (view/cancel by confirmation code)
- [x] Onboarding wizard (3 steps: business name, industry, contact)
- [x] Dashboard with stats cards and upcoming appointments
- [x] **Calendar page with:**
  - Week view
  - Drag-and-drop appointment rescheduling
  - Visual drop target feedback
  - Grip handle on hover
  - **Pending Approvals Panel (NEW April 2026)** - Shows all pending bookings with Approve/Reject buttons
- [x] **Staff management page with:**
  - Working hours editor per staff
  - Visual schedule summary (Mon-Fri, Mon-Sat, etc.)
  - Break time configuration
- [x] Services management page
- [x] Clients page with search
- [x] Reports page with stats
- [x] **Settings page with:**
  - Business details
  - Regional settings
  - Booking settings
  - **Custom branding (display name, colors, logo upload/URL)**
  - **File upload for logos (NEW April 2026)** - PNG, JPEG, WebP, SVG support
  - **Notification settings:**
    - Email reminders toggle (FREE - Included)
    - SMS add-on toggle (+€10/month)
    - Reminder timing selector (1-48 hours)
- [x] AI Receptionist demo widget (Moltbot chat)
- [x] **Super Admin Portal:**
  - Admin Login Page (/admin)
  - Admin Dashboard with dark navy sidebar, grid layout (/admin/dashboard)
  - **Client List panel** with admin URLs, credentials, staff page links, booking links
  - **Booking Activity bar chart** (30-day visual)
  - **Platform Overview ring charts** (Clients, Bookings, Users) + MRR
  - **Client Details table** with plan, staff count, booking count, status
  - Clients List with search/filter (/admin/tenants) - **Renamed from "Tenants" to "Clients"**
  - Create Client Dialog with plan selection
  - Client Detail Page with plan editor (/admin/tenants/{id})
  - **Client Lifecycle Controls (activate/deactivate/terminate)**
  - **Dark navy sidebar theme (#1a1f2e) for Franchise Command Centre**
  - **Auto-seeded super admin on startup (admin@bookslot.io / Admin123!)**
- [x] **Moltbot AI Conversation System:**
  - Full conversation understanding via GPT-4o-mini
  - Intent parsing (book, reschedule, cancel, check availability)
  - Entity extraction (service, date, time, contact info)
  - Automatic booking action execution
  - Conversation history storage
  - Admin management page (/moltbot)
  - Webhook endpoints for SMS/Email (ready for activation)
- [x] **Smart Booking UI (NEW April 2026):**
  - Displays conflict errors with reason message
  - Shows alternative times (same staff, same day)
  - Shows alternative days (same staff, different day)
  - Shows alternative staff (same time, different staff)
  - One-click selection of alternatives
- [x] **Notification Bell & Help (NEW April 2026):**
  - Notification bell in header with pending count badge
  - Click redirects to Calendar page
  - Help button (?) opens quick help panel with tips
- [x] **Navigation Cleanup (NEW April 2026):**
  - Removed: Resources, Forms, Messages, Integrations tabs
  - Calendar tab shows pending approval badge
  - Clean 8-tab navigation: Dashboard, Calendar, Staff, Services, Clients, AI Receptionist, Reports, Settings

### Design
- Swiss/High-contrast design system
- Fonts: Cormorant Garamond (headings), Manrope (body), JetBrains Mono (code)
- Colors: #0A0A0A (primary), #E34A33 (accent), #4F46E5 (AI widget)
- Sharp-edged buttons and cards
- Mobile-responsive
- **Franchise Command Centre:** Dark navy sidebar (#1a1f2e), blue accent active states, grid dashboard
- **Tenant Custom Branding:** Dynamic primary/secondary/accent colors from tenant settings
- **Tenant Dashboard:** Minimalist 4-tab layout (Today, Calendar, Team, Settings)

## Pricing Tiers & Features
| Feature | Starter (€29) | Growth (€79) | Pro (€149) |
|---------|---------------|--------------|------------|
| Max Staff | 2 | 8 | Unlimited |
| Online Booking | ✓ | ✓ | ✓ |
| Email Reminders | ✓ (FREE) | ✓ (FREE) | ✓ (FREE) |
| SMS Reminders | +€10/mo | +€10/mo | +€10/mo |
| Deposits | ✓ | ✓ | ✓ |
| Calendar Sync | ✓ | ✓ | ✓ |
| Waitlist | - | ✓ | ✓ |
| AI Assistant | - | ✓ | ✓ |
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
- ✅ Email notifications (Resend integration ready)
- ✅ SMS notifications (Twilio integration ready, +€10/month add-on)
- ✅ Staff working hours configuration
- ✅ Drag-and-drop calendar

### P1 (High Priority) - PENDING
- [ ] Stripe payment integration for deposits
- [ ] Google Calendar sync

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
- `/api/notifications/*` - Notification settings & logs

## External Integrations (API Keys Required)
1. **Resend** (Email) - Add `RESEND_API_KEY` to `/app/backend/.env`
   - Get API key: https://resend.com → Dashboard → API Keys
   - Free tier: 3,000 emails/month
2. **Twilio** (SMS) - Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` to `/app/backend/.env`
   - Get credentials: https://console.twilio.com
   - Cost: ~$0.0079/SMS (passed through to tenant via +€10/month add-on)

## Next Tasks
1. ~~**UI Tab Cleanup** - Remove Resources, move Messages→AI Receptionist, move Integrations→Settings, add Help button~~ ✅ DONE
2. ~~**Merge Appointments into Calendar** - With approval workflow (configurable time limit)~~ ✅ DONE
3. ~~**File Upload for Branding** - Enable device uploads using Object Storage~~ ✅ DONE
4. ~~**Smart Booking & Notification Bell** - Staff/time recommendations + alert bell~~ ✅ DONE
5. Add Stripe payment integration for deposits (DEFERRED by user)
6. Implement Google Calendar sync
7. Build custom forms builder

## Completed in April 2026 Session
- [x] Smart Booking with conflict detection and alternative suggestions
- [x] Approval workflow for all online bookings (Approve/Reject buttons)
- [x] Pending approvals panel merged into Calendar page
- [x] Notification bell with pending count badge
- [x] Logo file upload from device (PNG, JPEG, WebP, SVG)
- [x] Navigation cleanup (removed Resources, Forms, Messages, Integrations)
- [x] Fixed datetime comparison bug in booking validation
- [x] **UI Simplification (April 6, 2026):**
  - [x] Renamed Dashboard → "Today" with focus on today's bookings
  - [x] Large clock display + appointment count
  - [x] Quick "New Appointment" button on Today page
  - [x] "Done" button to mark appointments as completed
  - [x] In-progress, upcoming, and completed sections
  - [x] Contact icons (phone/email) for quick client communication
- [x] **Calendar Views Enhancement (April 6, 2026):**
  - [x] Day view (list format) - Quick appointment turnover
  - [x] Week view (7-day time grid) - Plan the week ahead
  - [x] Month view (calendar grid) - Long-term planning
  - [x] Staff filter dropdown - View individual staff calendars
  - [x] Navigation: Previous/Next/Today buttons
  - [x] Click any day in Week/Month to drill down to Day view
  - [x] Click time slot in Week view to create appointment
  - [x] Appointment badges in Month view (confirmed/pending counts)
- [x] **No-Show Shield System (April 6, 2026):**
  - [x] AI Risk Scoring Engine (backend) - Analyzes client history, booking patterns, day/time factors
  - [x] At-Risk Appointments Dashboard - Shows high/medium risk bookings for next 7 days
  - [x] Risk score visualization (0-100 scale with color-coded bars)
  - [x] Risk factors display (e.g., "first_time_client", "monday_morning", "far_advance_booking")
  - [x] Waitlist Management - Add/remove clients waiting for cancellations
  - [x] Smart Waitlist Matching - Auto-finds waitlist clients that match cancelled slots
  - [x] PWA Push Notification infrastructure (manifest, service worker)
  - [x] Push subscription endpoints for customer app install
  - [x] Send reminder button to notify at-risk clients
  - [x] Mark as No-Show tracking for future risk calculations
- [x] **Live Fleet Sheet / Today Dashboard (April 2026):**
  - [x] Auto-refresh every 30 seconds with visible timestamp
  - [x] Stats row: Today, This Week, Pending counts
  - [x] Upcoming 7 days section grouped by day
  - [x] Manual refresh button
- [x] **Franchise Command Centre Rebuild (April 2026):**
  - [x] Dark navy sidebar (#1a1f2e) with admin profile
  - [x] Renamed "Tenants" → "Clients" throughout
  - [x] Client List panel with admin/staff/booking URLs and credentials
  - [x] Booking Activity bar chart (30-day)
  - [x] Platform Overview ring charts (Clients, Bookings, Users) + MRR
  - [x] Client Details table
  - [x] Auto-seeded super admin account on startup
- [x] All backend tests passing

## Moltbot AI Activation Guide (When Ready)
To activate Moltbot for incoming SMS/Email:

**For SMS (Twilio):**
1. Configure Twilio webhook URL: `{YOUR_DOMAIN}/api/moltbot/webhook/incoming-sms`
2. Add credentials to `.env`: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
3. Enable SMS add-on per tenant in Settings

**For Email (Resend Inbound):**
1. Configure Resend inbound webhook: `{YOUR_DOMAIN}/api/moltbot/webhook/incoming-email`
2. Add credentials to `.env`: RESEND_API_KEY
3. Set up inbound parsing in Resend dashboard

The AI conversation system will automatically:
- Parse incoming messages
- Understand booking intents
- Execute actions (book, cancel, reschedule)
- Send confirmation responses
