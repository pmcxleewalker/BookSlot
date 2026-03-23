# TimeSlot Pro - Product Requirements Document

## Original Problem Statement
Build a multi-tenant SaaS booking platform with a Franchise Control Center (Super Admin) for managing all tenants. The platform should be industry-neutral, working for salons, barbers, dentists, doctors, consultants, and any appointment-based business.

---

## What's Been Built (March 2026)

### Phase 1: Core Platform ✅
- Multi-tenant architecture with tenant isolation
- Public booking pages with custom branding (`/book/{slug}`)
- Full booking flow: create, reschedule, cancel
- Staff & services management
- Calendar view
- Email confirmations
- Franchise Control Center (super admin)

### Phase 2: Production Hardening ✅ (Just Completed)
1. **Slot Locking (Race Condition Fix)** ✅
   - Prevents double-booking when two users book simultaneously
   - 5-minute lock expiration
   - File: `/app/backend/slot_locking.py`

2. **Role-Based Access Control (RBAC)** ✅
   - Owner: Full access (36 permissions)
   - Admin: Most access, no billing/tenant delete
   - Manager: Day-to-day operations
   - Staff: Own appointments only, no delete
   - File: `/app/backend/rbac.py`

3. **Plan Enforcement** ✅
   - Starter: 2 staff, 1 location, 10 services
   - Growth: 8 staff, 1 location, 50 services
   - Pro: 50 staff, 10 locations, unlimited services
   - Feature gating by plan
   - File: `/app/backend/plan_enforcement.py`

4. **Invoice Generator** ✅
   - Create invoices with line items + tax
   - PDF generation with tenant branding
   - Status workflow: Draft → Sent → Paid
   - Admin and tenant APIs
   - File: `/app/backend/invoices.py`

5. **Automated Email Reminders** ✅
   - 24-hour reminder before appointment
   - 1-hour reminder before appointment
   - Background scheduler (runs every 5 min)
   - File: `/app/backend/reminders.py`

---

## Test Credentials

```
Super Admin:
  URL: /admin/login
  Email: admin@timeslotpro.com
  Password: Admin123!
  Secret: timeslot_franchise_2024

Tenant (Elite Dental Care):
  URL: /login
  Email: john@elitedental.com
  Password: Test123!
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

### Public APIs
- `GET /api/public/{slug}/services` - Tenant services
- `GET /api/public/{slug}/availability` - Available slots
- `POST /api/public/{slug}/book` - Create booking

---

## Database Collections
- `super_admins` - Platform administrators
- `admin_sessions` - Admin auth sessions
- `tenants` - Business accounts (with branding)
- `subscriptions` - Plan subscriptions
- `users` - Tenant staff/owners
- `appointments` - Bookings
- `slot_locks` - Temporary slot locks (race condition prevention)
- `invoices` - Billing invoices
- `reminder_logs` - Reminder delivery logs
- `audit_logs` - Change tracking

---

## Testing Status

| Phase | Tests | Pass Rate |
|-------|-------|-----------|
| Phase 1 | 26 | 100% |
| Phase 2 | 18 | 100% |

---

## What's Ready vs Missing

### ✅ Ready for Launch
- Booking flow
- Tenant branding
- Invoice generation
- Role permissions
- Plan limits
- Email reminders
- Conflict prevention

### ⚠️ Needs Configuration
- Email: Set `RESEND_API_KEY` in backend/.env
- WeasyPrint: Install for true PDF (currently HTML)

### ❌ Not Built Yet
- SMS notifications (Twilio)
- Payment collection (Stripe)
- Waitlist feature
- Custom intake forms
- AI Receptionist conversation tracking

---

## Backlog / Future Features

### P1 - High Priority
- [ ] Twilio SMS reminders
- [ ] Stripe payment for deposits
- [ ] Webhook retry mechanism
- [ ] Rate limiting on APIs

### P2 - Medium Priority
- [ ] Waitlist feature
- [ ] Custom intake forms
- [ ] Multi-location UI
- [ ] Advanced analytics

### P3 - Low Priority
- [ ] AI Receptionist inbox
- [ ] White-label option
- [ ] Mobile app
