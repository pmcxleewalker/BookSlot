# TimeSlot Pro - Product Requirements Document

## Original Problem Statement
Build a production-ready multi-tenant SaaS booking platform for V1 appointment-based businesses (salons, clinics, dentists, doctors, vets, consultants, service businesses with staff + time slots + resources).

### User Choices
- **Authentication**: Both JWT-based custom auth AND Emergent-managed Google OAuth
- **Payment Integration**: Mock billing for V1 (skip Stripe)
- **Reminders**: Email integration via Resend
- **AI Receptionist**: API-only (no chat UI, endpoints for Moltbot to connect)
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
| Starter | €29/month | 1 location, 2 staff, online booking, reminders, deposits, calendar sync |
| Growth | €79/month | 1 location, 8 staff, + waitlist, packages, AI assistant, SMS automations, reports |
| Pro | €149/month | Multi-location, unlimited staff, + advanced permissions, resource booking, custom forms, white-label, API/webhooks |

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

## What's Been Implemented (V1 MVP)

### Date: March 23, 2026

### Backend (FastAPI + MongoDB)
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

### Frontend (React + Shadcn/UI)
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

### Design System
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

### P2 (Nice to Have)
- [ ] White-label booking pages
- [ ] Email template customization
- [ ] Recurring appointments
- [ ] Group bookings
- [ ] Mobile app (React Native)
- [ ] Voice receptionist integration
- [ ] Two-way calendar sync

---

## Next Tasks (Prioritized)

1. **SMS Integration** - Add Twilio for appointment reminders
2. **Calendar Sync** - Google Calendar integration
3. **Stripe Integration** - Real subscription billing
4. **Deposit Collection** - Payment at booking time
5. **Waitlist UI** - Frontend for waitlist management
6. **Reports Dashboard** - Charts and analytics
7. **Custom Forms** - Intake form builder

---

## Technical Architecture

### Backend
- Framework: FastAPI
- Database: MongoDB (motor async driver)
- Auth: JWT + Emergent OAuth
- Email: Resend
- API prefix: /api

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
- custom_forms
- form_submissions
- waitlist
- webhooks
- api_keys
- audit_logs
- notifications
