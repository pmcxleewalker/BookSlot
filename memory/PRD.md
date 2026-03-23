# TimeSlot Pro - Product Requirements Document

## Original Problem Statement
Build a multi-tenant SaaS booking platform with a Franchise Control Center (Super Admin) for managing all tenants. The platform should be industry-neutral, working for salons, barbers, dentists, doctors, consultants, and any appointment-based business.

---

## What's Been Built (March 2026)

### Phase 1: Core Platform
- Multi-tenant architecture with tenant isolation
- Public booking pages with custom branding (`/book/{slug}`)
- Full booking flow: create, reschedule, cancel
- Staff & services management
- Calendar view
- Email confirmations
- Franchise Control Center (super admin)

### Phase 2: Production Hardening
1. **Slot Locking (Race Condition Fix)**
   - Prevents double-booking when two users book simultaneously
   - 5-minute lock expiration
   - File: `/app/backend/slot_locking.py`

2. **Role-Based Access Control (RBAC)**
   - Owner: Full access (36 permissions)
   - Admin: Most access, no billing/tenant delete
   - Manager: Day-to-day operations
   - Staff: Own appointments only, no delete
   - File: `/app/backend/rbac.py`

3. **Plan Enforcement**
   - Starter: 2 staff, 1 location, 10 services
   - Growth: 8 staff, 1 location, 50 services
   - Pro: 50 staff, 10 locations, unlimited services
   - Feature gating by plan
   - File: `/app/backend/plan_enforcement.py`

4. **Invoice Generator**
   - Create invoices with line items + tax
   - PDF generation with tenant branding
   - Status workflow: Draft → Sent → Paid
   - Admin and tenant APIs
   - File: `/app/backend/invoices.py`

5. **Automated Email Reminders**
   - 24-hour reminder before appointment
   - 1-hour reminder before appointment
   - Background scheduler (runs every 5 min)
   - File: `/app/backend/reminders.py`

### Phase 3.5: Staff & Holiday Management (March 23, 2026)
1. **Staff Schedule UI**
   - Per-staff working hours configuration
   - 7-day schedule with toggle switches
   - Time bounded by business operating hours
   - Saturday/Sunday show "Business closed" when business is closed
   - File: `/app/frontend/src/pages/dashboard/StaffScheduleModal.js`
   - Wired in: `/app/frontend/src/pages/dashboard/Staff.js`

2. **Holidays & Closures**
   - Holiday/exception date management
   - Preset quick-add for Irish holidays (St. Patrick's Day, Good Friday, etc.)
   - Full or partial day closure options
   - CRUD operations with proper validation
   - File: `/app/frontend/src/pages/dashboard/HolidaysSettings.js`
   - Wired in: `/app/frontend/src/pages/dashboard/Settings.js`

3. **Backend APIs**
   - `PUT /api/staff/{staff_id}/schedule` - Update staff working hours
   - `GET /api/holidays` - List holidays
   - `POST /api/holidays` - Create holiday
   - `PUT /api/holidays/{holiday_id}` - Update holiday
   - `DELETE /api/holidays/{holiday_id}` - Delete holiday

### Phase 3: P0 Launch Blockers (March 23, 2026)
1. **Idempotency System**
   - Prevents duplicate operations from network retries
   - 24-hour TTL on idempotency keys
   - File: `/app/backend/idempotency.py`

2. **RBAC Enforcement Across All Endpoints**
   - Protected: staff CRUD, services CRUD, resources CRUD
   - Protected: settings, branding, webhooks, API keys
   - Protected: billing, invoices
   - File: `/app/backend/server.py`

3. **Feature Gating Enforcement**
   - Webhooks: Pro only
   - API Access: Pro only  
   - Multi-location: Pro only
   - Returns 403 with upgrade suggestion
   - File: `/app/backend/server.py`

4. **Plan Limits Enforcement**
   - Services creation checks limit
   - Resources creation checks limit
   - Staff creation checks limit
   - File: `/app/backend/server.py`

5. **Stripe Billing Integration**
   - Subscription checkout sessions
   - Payment transaction tracking
   - Plan upgrade on successful payment
   - Webhook handling
   - File: `/app/backend/billing.py`

6. **Secrets Moved to Environment**
   - SUPER_ADMIN_SECRET in .env
   - STRIPE_API_KEY in .env
   - File: `/app/backend/.env`

---

## Test Credentials

```
Super Admin:
  URL: /admin/login
  Email: admin@timeslotpro.com
  Password: Admin123!
  Secret: timeslot_franchise_2024 (in .env)

Tenant (Elite Dental Care):
  URL: /login
  Email: john@elitedental.com
  Password: Test123!
  Plan: Growth
  Booking: /book/elite-dental-care
```

---

## API Endpoints

### Admin APIs (X-Admin-Token header)
- `POST /api/admin/auth/login` - Admin login
- `GET /api/admin/stats` - Platform statistics
- `GET /api/admin/tenants` - List all tenants
- `POST /api/admin/tenants` - Create tenant
- `GET /api/admin/tenants/{id}` - Tenant details
- `GET /api/admin/invoices` - All invoices
- `POST /api/admin/invoices` - Create invoice
- `GET /api/admin/invoices/{id}/pdf` - Invoice PDF

### Tenant APIs (Cookie: session_token)
- `GET /api/permissions` - User permissions
- `GET /api/subscription/usage` - Plan usage stats
- `GET /api/invoices` - Tenant invoices
- `POST /api/invoices` - Create invoice
- `GET /api/settings/branding` - Branding settings
- `PUT /api/settings/branding` - Update branding

### Billing APIs (NEW)
- `GET /api/billing/plans` - List subscription plans
- `POST /api/billing/checkout` - Create Stripe checkout
- `GET /api/billing/status/{session_id}` - Check payment status
- `GET /api/billing/transactions` - Payment history
- `POST /api/webhook/stripe` - Stripe webhook handler

### Public APIs
- `GET /api/public/{slug}/services` - Tenant services
- `GET /api/public/{slug}/availability` - Available slots
- `POST /api/public/{slug}/book` - Create booking

---

## Database Collections

### Core Collections
- `super_admins` - Platform administrators
- `admin_sessions` - Admin auth sessions
- `tenants` - Business accounts (with branding)
- `subscriptions` - Plan subscriptions
- `users` - Tenant staff/owners
- `appointments` - Bookings
- `services` - Service catalog
- `staff` - Staff members
- `clients` - Customer records

### Supporting Collections
- `slot_locks` - Temporary slot locks (race condition prevention)
- `idempotency_keys` - Request deduplication (24h TTL)
- `invoices` - Billing invoices
- `payment_transactions` - Stripe payment records
- `reminder_logs` - Reminder delivery logs
- `audit_logs` - Change tracking
- `webhooks` - Registered webhooks
- `api_keys` - API keys
- `staff_schedules` - Staff working hours by day
- `holidays` - Business holidays and closures

---

## Testing Status

| Phase | Tests | Pass Rate |
|-------|-------|-----------|
| Phase 1 | 26 | 100% |
| Phase 2 | 18 | 100% |
| Phase 3 (P0) | 19 | 100% |
| Phase 3.5 (Staff/Holidays) | 11 Backend + 9 Frontend | 100% |

---

## What's Ready vs Missing

### Ready for Launch
- Booking flow with idempotency
- Slot locking (race condition prevention)
- RBAC enforcement on all endpoints
- Staff schedule management (per-staff working hours)
- Holidays & closures management
- Plan feature gating
- Plan resource limits
- Tenant branding
- Invoice generation (PDF)
- Email reminders
- Stripe billing integration (test mode)

### Needs Configuration
- Email: Set `RESEND_API_KEY` in backend/.env for real delivery
- Stripe: Replace test key with production key

### Not Built Yet
- SMS notifications (Twilio)
- Waitlist feature
- Custom intake forms
- AI Receptionist conversation tracking
- Webhook retry mechanism

---

## Subscription Plans

| Feature | Starter (€29) | Growth (€79) | Pro (€149) |
|---------|---------------|--------------|------------|
| Staff | 2 | 8 | 50 |
| Locations | 1 | 1 | 10 |
| Services | 10 | 50 | Unlimited |
| Online Booking | Yes | Yes | Yes |
| Email Confirmations | Yes | Yes | Yes |
| Calendar View | Yes | Yes | Yes |
| Basic Reports | Yes | Yes | Yes |
| SMS Notifications | No | Yes | Yes |
| Automated Reminders | No | Yes | Yes |
| Waitlist | No | Yes | Yes |
| AI Receptionist | No | Yes | Yes |
| API Access | No | No | Yes |
| Webhooks | No | No | Yes |
| Multi-location | No | No | Yes |
| White Label | No | No | Yes |

---

## Backlog / Future Features

### P1 - High Priority
- [ ] Twilio SMS reminders
- [ ] Webhook retry mechanism
- [ ] Rate limiting on APIs
- [ ] Stripe subscription management (cancel, change)

### P2 - Medium Priority
- [ ] Waitlist feature
- [ ] Custom intake forms
- [ ] Multi-location UI
- [ ] Advanced analytics

### P3 - Low Priority
- [ ] AI Receptionist inbox
- [ ] White-label option
- [ ] Mobile app
