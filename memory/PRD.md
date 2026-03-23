# TimeSlot Pro - Product Requirements Document

## Original Problem Statement
Build a production-ready multi-tenant SaaS booking platform for V1 appointment-based businesses (salons, clinics, dentists, doctors, vets, consultants, service businesses with staff + time slots + resources).

### User Choices
- **Authentication**: Both JWT-based custom auth AND Emergent-managed Google OAuth
- **Payment Integration**: Mock billing for V1 (skip Stripe)
- **Reminders**: Email integration via Resend (WhatsApp-friendly logging for now)
- **AI Receptionist**: API-only (no chat UI, endpoints for MoltBot to connect)
- **Design**: Ultra premium and professional SaaS design, incredibly easy to use

---

## User Personas

### 1. Business Owner (Primary)
- Small to medium service business owner
- Non-technical, needs simple setup
- Wants to reduce no-shows and manual scheduling work

### 2. Staff Member
- Works at the business
- Needs to see their schedule and manage appointments
- May have limited permissions

### 3. Client/Customer
- Wants to book appointments easily
- Needs reminders and ability to manage bookings

---

## Core Requirements (Static)

### Plans & Pricing
| Plan | Price | Features |
|------|-------|----------|
| Starter | €29/month | 1 location, 2 staff, 10 services, 100 bookings/mo, online booking, reminders, deposits, calendar sync |
| Growth | €79/month | 1 location, 8 staff, 50 services, 500 bookings/mo, + waitlist, packages, AI assistant, SMS automations, reports |
| Pro | €149/month | Multi-location, unlimited staff/services/bookings, + advanced permissions, resource booking, custom forms, white-label, API/webhooks |

### Required Features
- 3-step onboarding wizard
- Industry templates
- Customer self-booking (guest and account)
- Drag-and-drop admin calendar
- Staff scheduling
- Service durations and buffer times
- Resource booking
- Deposits and no-show protection
- Automated email/SMS reminders
- Waitlist and cancellation fill
- Intake/custom forms
- Calendar sync
- Reports
- Role-based permissions
- Audit logs
- GDPR-first design
- Multi-tenant architecture
- Subscription billing
- Usage limits by plan
- API and webhook support for Moltbot AI receptionist

---

## What's Been Implemented

### V1 MVP (March 23, 2026)

#### Backend (FastAPI + MongoDB)
- [x] Multi-tenant architecture with tenant isolation
- [x] JWT authentication + session management
- [x] Emergent Google OAuth integration
- [x] User registration and login
- [x] Business/tenant creation with slug
- [x] Subscription management (mock billing)
- [x] Staff CRUD with working hours/schedule
- [x] Services CRUD with pricing, duration, buffers
- [x] Resources CRUD (rooms, equipment)
- [x] Clients CRUD with history tracking
- [x] Appointments CRUD with conflict detection
- [x] Availability calculation
- [x] Booking creation with conflict checking
- [x] Appointment status management (confirm, cancel, complete, no-show)
- [x] Dashboard statistics
- [x] Public booking API endpoints
- [x] Webhooks management (create, delete, list events)
- [x] API keys management for integrations
- [x] Moltbot API endpoints (services, staff, availability, booking actions)
- [x] Audit logging
- [x] Email templates (confirmation, reminder, cancellation)
- [x] Resend email integration (logs if no API key)

#### Frontend (React + Shadcn/UI)
- [x] Landing page with hero, features, industries, testimonials, CTA
- [x] Features page
- [x] Pricing page with plan comparison
- [x] Login page (email/password + Google OAuth)
- [x] Signup page (email/password + Google OAuth)
- [x] OAuth callback handling
- [x] 3-step onboarding wizard (industry, business details, services)
- [x] Dashboard with stats, upcoming appointments, quick actions
- [x] Calendar view (week view with appointments)
- [x] Appointments list with filters and status management
- [x] Staff management (add, edit, delete, color coding)
- [x] Services management (add, edit, delete, pricing, duration)
- [x] Resources management
- [x] Clients management with search
- [x] Settings page (business info, timezone, subscription)
- [x] Integrations page (API keys, webhooks)
- [x] Public booking widget (service selection, date/time, client details)
- [x] Booking management page (view, cancel)
- [x] New appointment modal
- [x] Responsive sidebar navigation
- [x] Premium organic/earthy design theme

### V2 Upgrade (March 23, 2026)

#### WebSocket & Real-time Notifications
- [x] WebSocket endpoint at `/ws` with session-based authentication
- [x] WebSocket manager for connection management
- [x] Real-time notifications for booking events
- [x] Real-time notifications for conversation events
- [x] Ping/pong keepalive mechanism

#### V1 Receptionist API (`/api/v1/receptionist/*`)
- [x] Versioned API structure
- [x] API key authentication with rate limiting
- [x] Rate limit tiers by plan (starter: 30/min, growth: 100/min, pro: 300/min)
- [x] Idempotency key support for safe retries
- [x] Services endpoint (`GET /services`)
- [x] Staff endpoint (`GET /staff`)
- [x] Availability endpoint (`POST /availability`)
- [x] Slot locking endpoint (`POST /slots/lock`, `DELETE /slots/lock/{id}`)
- [x] Atomic booking creation with lock support (`POST /bookings`)
- [x] Reschedule endpoint (`POST /bookings/{id}/reschedule`)
- [x] Cancel endpoint (`POST /bookings/{id}/cancel`)

#### Conversation & Inbox System
- [x] Conversation model with status tracking (active, waiting_human, human_handling, resolved)
- [x] Message model with sender types (client, ai, staff, system)
- [x] Handoff mechanism with priority levels
- [x] Create conversation endpoint (`POST /conversations`)
- [x] Add message endpoint (`POST /conversations/{id}/messages`)
- [x] Request handoff endpoint (`POST /conversations/{id}/handoff`)
- [x] Resolve conversation endpoint (`POST /conversations/{id}/resolve`)
- [x] Inbox stats endpoint (`GET /inbox/stats`)

#### Dashboard Inbox UI
- [x] Inbox page with conversation list
- [x] Stats cards (Active, Waiting for Human, Being Handled, Resolved Today)
- [x] Filter tabs (All, Waiting, Active, Resolved)
- [x] Conversation detail view
- [x] Message thread display
- [x] Staff message sending
- [x] Take Over / Assign functionality
- [x] Resolve conversation button
- [x] Real-time updates via WebSocket hook

#### Booking Safety
- [x] Slot locking mechanism (temporary hold during booking)
- [x] Lock expiration (default 5 minutes)
- [x] Lock conversion to booking
- [x] Conflict-safe atomic booking creation

### V3 Production-Readiness Hardening (March 23, 2026)

#### Stage 1: Security Hardening
- [x] Input validation with Pydantic Field constraints (max_length, min_length, ge, le)
- [x] Password minimum 8 characters enforced at model level
- [x] Service duration constrained to 5-480 minutes
- [x] Name fields limited to 100 characters
- [x] Notes/description fields limited to 1000-2000 characters
- [x] Rate limiting on auth endpoints (login: 5/min, register: 3/min)
- [x] JWT_SECRET required (no weak defaults)
- [x] Demo accounts endpoint secured (dev-only access)
- [x] CORS configured with explicit origins (no wildcard fallback)

#### Stage 2: Booking Race Condition Fix
- [x] Optimistic locking using `booking_locks` collection
- [x] Atomic slot acquisition with MongoDB `findOneAndUpdate`
- [x] Double-booking prevention with conflict queries
- [x] Lock cleanup with TTL index (60 second expiry)
- [x] Final conflict check before insert

#### Stage 3: Plan Enforcement
- [x] Resource limits on staff creation (Starter: 2, Growth: 8, Pro: unlimited)
- [x] Resource limits on services creation (Starter: 10, Growth: 50, Pro: unlimited)
- [x] Resource limits on clients (Starter: 200, Growth: 1000, Pro: unlimited)
- [x] Webhooks gated to Pro plan only
- [x] API keys gated to Pro plan only
- [x] Monthly booking limits enforced (Starter: 100, Growth: 500, Pro: unlimited)

#### Stage 4: Webhook Reliability
- [x] Retry queue with exponential backoff (30s, 1m, 5m, 15m, 1h)
- [x] Max 5 retry attempts per webhook delivery
- [x] Background worker for processing retries
- [x] Failure count tracking per webhook
- [x] Old retry cleanup (7 day retention)

---

## Design System
- Primary color: #2E473B (deep forest green)
- Secondary color: #C26A58 (terracotta)
- Success color: #3E6653
- Warning color: #E6B861
- Background: #FAF9F6 (warm off-white)
- Font: Outfit (headings) + DM Sans (body)
- Border radius: 12px (rounded-xl)
- Card shadows with subtle border

---

## P0/P1/P2 Features Remaining

### P0 (Critical for Launch)
- [ ] SMS reminders integration (Twilio)
- [ ] Calendar sync (Google Calendar, Outlook)
- [ ] Stripe payment integration for real billing
- [ ] Deposit collection at booking

### P1 (Important)
- [ ] Waitlist management UI
- [ ] Custom intake forms builder
- [ ] Service packages/bundles
- [ ] Client notes and history view
- [ ] Reports and analytics dashboard
- [ ] Multi-location support UI
- [ ] Staff permissions management
- [ ] AI Receptionist analytics dashboard

### P2 (Nice to Have)
- [ ] White-label booking pages
- [ ] Email template customization
- [ ] Recurring appointments
- [ ] Group bookings
- [ ] Mobile app (React Native)
- [ ] Voice receptionist integration
- [ ] Two-way calendar sync
- [ ] Message templates for conversations

---

## Next Tasks (Prioritized)

1. **SMS Integration** - Add Twilio for appointment reminders
2. **Calendar Sync** - Google Calendar integration
3. **Stripe Integration** - Real subscription billing
4. **Deposit Collection** - Payment at booking time
5. **Analytics Dashboard** - Receptionist analytics reporting
6. **Waitlist UI** - Frontend for waitlist management
7. **Custom Forms** - Intake form builder

---

## Technical Architecture

### Backend
- Framework: FastAPI
- Database: MongoDB (motor async driver)
- Auth: JWT + Emergent OAuth + API Keys
- Email: Resend
- Real-time: WebSockets (native FastAPI)
- API prefix: /api, /api/v1/receptionist

### Frontend
- Framework: React 18
- Styling: Tailwind CSS + Shadcn/UI
- State: React Context
- Routing: React Router v6
- Icons: Lucide React
- Animation: Framer Motion

### Database Collections
- tenants
- users
- user_sessions
- subscriptions
- locations
- staff
- staff_schedules
- services
- service_categories
- resources
- clients
- appointments
- conversations (V2)
- conversation_messages (V2)
- slot_locks (V2)
- rate_limits (V2)
- idempotency_records (V2)
- custom_forms
- form_submissions
- waitlist
- webhooks
- api_keys
- audit_logs
- notifications

---

## API Endpoints Summary

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/session` - Process OAuth session
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### V1 Receptionist API (API key required)
- `GET /api/v1/receptionist/services` - List services
- `GET /api/v1/receptionist/staff` - List staff
- `POST /api/v1/receptionist/availability` - Check availability
- `POST /api/v1/receptionist/slots/lock` - Lock a slot
- `DELETE /api/v1/receptionist/slots/lock/{lock_id}` - Release lock
- `POST /api/v1/receptionist/bookings` - Create booking
- `POST /api/v1/receptionist/bookings/{id}/reschedule` - Reschedule
- `POST /api/v1/receptionist/bookings/{id}/cancel` - Cancel
- `POST /api/v1/receptionist/conversations` - Create conversation
- `POST /api/v1/receptionist/conversations/{id}/messages` - Add message
- `POST /api/v1/receptionist/conversations/{id}/handoff` - Request handoff
- `POST /api/v1/receptionist/conversations/{id}/resolve` - Resolve

### Inbox (Auth required)
- `GET /api/inbox/conversations` - List conversations
- `GET /api/inbox/conversations/{id}` - Get conversation with messages
- `POST /api/inbox/conversations/{id}/assign` - Take over conversation
- `POST /api/inbox/conversations/{id}/messages` - Send staff message
- `POST /api/inbox/conversations/{id}/resolve` - Resolve conversation
- `GET /api/inbox/stats` - Get inbox statistics

### WebSocket
- `WS /ws` - Real-time notifications (authenticate with session_token)
