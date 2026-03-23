# TimeSlot Pro - Manual QA Test Plan

**Version:** 1.0  
**Date:** March 2026  
**Environment:** https://timeslot-pro-launch.preview.emergentagent.com

---

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@timeslotpro.com | Admin123! |
| Tenant Owner (Elite Dental) | john@elitedental.com | Test123! |
| Admin Secret | - | timeslot_franchise_2024 |

---

## Severity Definitions

| Level | Meaning |
|-------|---------|
| 🔴 **P0 - Critical** | System unusable, data loss, security breach |
| 🟠 **P1 - High** | Core feature broken, no workaround |
| 🟡 **P2 - Medium** | Feature degraded, workaround exists |
| 🟢 **P3 - Low** | Minor issue, cosmetic |

---

## 1. BOOKING CREATION

### TC-BOOK-001: Create booking via public page
| Field | Value |
|-------|-------|
| **Steps** | 1. Go to `/book/{tenant-slug}`<br>2. Select a service<br>3. Select a staff member<br>4. Pick a date<br>5. Pick an available time slot<br>6. Enter client name, email, phone<br>7. Click "Confirm Booking" |
| **Expected** | - Booking confirmed with confirmation code<br>- Confirmation email received<br>- Appointment appears in dashboard |
| **Severity** | 🔴 P0 |

### TC-BOOK-002: Create booking via dashboard
| Field | Value |
|-------|-------|
| **Steps** | 1. Login as tenant owner<br>2. Go to Dashboard → New Booking<br>3. Fill in client details<br>4. Select service, staff, date/time<br>5. Save booking |
| **Expected** | - Booking created successfully<br>- Shows in calendar view<br>- Shows in appointments list |
| **Severity** | 🔴 P0 |

### TC-BOOK-003: Create booking via Moltbot API
| Field | Value |
|-------|-------|
| **Steps** | 1. Create API key in dashboard<br>2. Call `POST /api/moltbot/book` with:<br>```json<br>{<br>  "action": "create",<br>  "booking_intent": {<br>    "service_name": "Haircut",<br>    "client_name": "Test Client",<br>    "client_email": "test@test.com",<br>    "preferred_date": "2026-03-25",<br>    "preferred_time": "10:00"<br>  }<br>}<br>```<br>3. Include `X-API-Key` header |
| **Expected** | - Returns `appointment_id` and `confirmation_code`<br>- Status 200 |
| **Severity** | 🔴 P0 |

### TC-BOOK-004: Booking with resource requirement
| Field | Value |
|-------|-------|
| **Steps** | 1. Create a service that requires a resource (e.g., "Massage - Room 1")<br>2. Create a booking for that service<br>3. Verify resource is included |
| **Expected** | - Booking includes `resource_id`<br>- Resource availability checked |
| **Severity** | 🟡 P2 |

### TC-BOOK-005: Booking for inactive tenant
| Field | Value |
|-------|-------|
| **Steps** | 1. As super admin, suspend a tenant<br>2. Try to access `/book/{suspended-tenant-slug}` |
| **Expected** | - Returns 404 "Business not found"<br>- Cannot create booking |
| **Severity** | 🟠 P1 |

### TC-BOOK-006: Booking past date
| Field | Value |
|-------|-------|
| **Steps** | 1. Go to public booking page<br>2. Try to select yesterday's date |
| **Expected** | - Past dates should be disabled or rejected |
| **Severity** | 🟡 P2 |

### TC-BOOK-007: Booking with missing required fields
| Field | Value |
|-------|-------|
| **Steps** | 1. Go to public booking page<br>2. Try to submit without client name |
| **Expected** | - Form validation error<br>- Cannot submit |
| **Severity** | 🟠 P1 |

---

## 2. DOUBLE-BOOKING PREVENTION

### TC-DBL-001: Same staff, overlapping time
| Field | Value |
|-------|-------|
| **Steps** | 1. Create booking for Staff A at 10:00 AM (30 min service)<br>2. Try to create another booking for Staff A at 10:15 AM |
| **Expected** | - Second booking rejected<br>- Error: "Time slot is not available" |
| **Severity** | 🔴 P0 |

### TC-DBL-002: Same resource, overlapping time
| Field | Value |
|-------|-------|
| **Steps** | 1. Create booking using Resource X at 10:00 AM<br>2. Try to create another booking using Resource X at 10:15 AM with different staff |
| **Expected** | - Second booking rejected due to resource conflict |
| **Severity** | 🔴 P0 |

### TC-DBL-003: Concurrent booking attempts (Race Condition)
| Field | Value |
|-------|-------|
| **Steps** | 1. Open two browser tabs to same booking page<br>2. Select same slot in both tabs<br>3. Click submit simultaneously in both |
| **Expected** | - Only ONE booking should succeed<br>- Other should fail with conflict error |
| **Severity** | 🔴 P0 |
| **⚠️ KNOWN ISSUE** | No slot locking implemented - this test will likely FAIL |

### TC-DBL-004: Buffer time respected
| Field | Value |
|-------|-------|
| **Steps** | 1. Create service with 15 min buffer_before and 10 min buffer_after<br>2. Create booking at 10:00 for 30 min service<br>3. Try to book at 10:40 (within buffer) |
| **Expected** | - Booking rejected<br>- Next available slot should be 10:55+ |
| **Severity** | 🟠 P1 |

### TC-DBL-005: Adjacent bookings allowed
| Field | Value |
|-------|-------|
| **Steps** | 1. Create 30 min booking at 10:00 (ends 10:30)<br>2. Create booking at 10:30 |
| **Expected** | - Second booking succeeds (no overlap) |
| **Severity** | 🟠 P1 |

---

## 3. RESCHEDULING

### TC-RESCH-001: Reschedule to available slot
| Field | Value |
|-------|-------|
| **Steps** | 1. Create a booking for tomorrow 10:00 AM<br>2. Go to appointment details<br>3. Click reschedule<br>4. Select 2:00 PM same day<br>5. Confirm |
| **Expected** | - Booking time updated<br>- Client receives email notification<br>- Webhook `booking.rescheduled` fired |
| **Severity** | 🔴 P0 |

### TC-RESCH-002: Reschedule to conflicting slot
| Field | Value |
|-------|-------|
| **Steps** | 1. Have two bookings: A at 10:00, B at 2:00<br>2. Try to reschedule B to 10:00 |
| **Expected** | - Reschedule rejected<br>- Error message shown |
| **Severity** | 🔴 P0 |

### TC-RESCH-003: Reschedule to different staff
| Field | Value |
|-------|-------|
| **Steps** | 1. Create booking with Staff A<br>2. Reschedule and change to Staff B |
| **Expected** | - Staff changed successfully<br>- New staff's schedule checked |
| **Severity** | 🟡 P2 |

### TC-RESCH-004: Reschedule via API
| Field | Value |
|-------|-------|
| **Steps** | 1. Call `POST /api/moltbot/book` with:<br>```json<br>{<br>  "action": "reschedule",<br>  "appointment_id": "apt_xxx",<br>  "new_start_time": "2026-03-25T14:00:00Z"<br>}<br>``` |
| **Expected** | - Returns updated appointment<br>- Webhook fired |
| **Severity** | 🟠 P1 |

### TC-RESCH-005: Client self-reschedule via manage link
| Field | Value |
|-------|-------|
| **Steps** | 1. Get booking confirmation email<br>2. Click "Manage Booking" link<br>3. Select new time<br>4. Confirm |
| **Expected** | - Booking rescheduled<br>- Confirmation shown |
| **Severity** | 🟡 P2 |

---

## 4. CANCELLATIONS

### TC-CANCEL-001: Cancel booking via dashboard
| Field | Value |
|-------|-------|
| **Steps** | 1. Go to Appointments list<br>2. Find a booking<br>3. Click Cancel<br>4. Enter reason (optional)<br>5. Confirm |
| **Expected** | - Status changes to "cancelled"<br>- Slot becomes available again<br>- Client receives cancellation email<br>- Webhook `booking.cancelled` fired |
| **Severity** | 🔴 P0 |

### TC-CANCEL-002: Cancel via API
| Field | Value |
|-------|-------|
| **Steps** | 1. Call `POST /api/moltbot/book` with:<br>```json<br>{<br>  "action": "cancel",<br>  "appointment_id": "apt_xxx"<br>}<br>``` |
| **Expected** | - Returns success<br>- Appointment marked cancelled |
| **Severity** | 🟠 P1 |

### TC-CANCEL-003: Client self-cancel
| Field | Value |
|-------|-------|
| **Steps** | 1. Access `/manage/{appointment_id}`<br>2. Click Cancel Booking<br>3. Confirm |
| **Expected** | - Booking cancelled<br>- Confirmation shown |
| **Severity** | 🟡 P2 |

### TC-CANCEL-004: Book cancelled slot
| Field | Value |
|-------|-------|
| **Steps** | 1. Cancel an existing booking at 10:00 AM<br>2. Immediately try to book same slot |
| **Expected** | - New booking succeeds<br>- Slot is available |
| **Severity** | 🟠 P1 |

### TC-CANCEL-005: Cancel already-cancelled booking
| Field | Value |
|-------|-------|
| **Steps** | 1. Cancel a booking<br>2. Try to cancel it again |
| **Expected** | - Graceful handling (no error or clear message) |
| **Severity** | 🟢 P3 |

---

## 5. WAITLIST

### TC-WAIT-001: Join waitlist for fully booked day
| Field | Value |
|-------|-------|
| **Steps** | 1. Go to booking page<br>2. Select date with no availability<br>3. Click "Join Waitlist" |
| **Expected** | - Waitlist entry created<br>- Confirmation shown |
| **Severity** | 🟠 P1 |
| **⚠️ STATUS** | Feature NOT implemented - Test will FAIL |

### TC-WAIT-002: Waitlist notification on cancellation
| Field | Value |
|-------|-------|
| **Steps** | 1. Have client on waitlist<br>2. Cancel existing booking for that slot<br>3. Check if waitlist client notified |
| **Expected** | - Waitlist client receives email/notification |
| **Severity** | 🟠 P1 |
| **⚠️ STATUS** | Feature NOT implemented - Test will FAIL |

### TC-WAIT-003: Waitlist only for Growth/Pro plans
| Field | Value |
|-------|-------|
| **Steps** | 1. Login as Starter plan tenant<br>2. Try to enable waitlist feature |
| **Expected** | - Feature should be restricted<br>- Upgrade prompt shown |
| **Severity** | 🟡 P2 |
| **⚠️ STATUS** | Plan enforcement NOT implemented - Test will FAIL |

---

## 6. DEPOSITS

### TC-DEP-001: Service with deposit required
| Field | Value |
|-------|-------|
| **Steps** | 1. Create service with `deposit_required: true`, `deposit_amount: 20`<br>2. Book this service via public page |
| **Expected** | - Deposit amount shown during booking<br>- Payment collected before confirmation |
| **Severity** | 🟠 P1 |
| **⚠️ STATUS** | Payment NOT implemented - Test will FAIL (deposit field saved but not enforced) |

### TC-DEP-002: Deposit refund on cancellation
| Field | Value |
|-------|-------|
| **Steps** | 1. Complete booking with deposit<br>2. Cancel booking |
| **Expected** | - Refund policy shown<br>- Deposit refunded if within policy |
| **Severity** | 🟠 P1 |
| **⚠️ STATUS** | Payment NOT implemented - Test will FAIL |

---

## 7. REMINDERS

### TC-REM-001: 24-hour reminder sent
| Field | Value |
|-------|-------|
| **Steps** | 1. Create booking for tomorrow<br>2. Wait 24 hours before appointment |
| **Expected** | - Reminder email sent automatically |
| **Severity** | 🟡 P2 |
| **⚠️ STATUS** | Scheduled jobs NOT implemented - Test will FAIL |

### TC-REM-002: 1-hour reminder sent
| Field | Value |
|-------|-------|
| **Steps** | 1. Create booking for 1 hour from now<br>2. Wait 1 hour |
| **Expected** | - Reminder email/SMS sent |
| **Severity** | 🟡 P2 |
| **⚠️ STATUS** | Scheduled jobs NOT implemented - Test will FAIL |

### TC-REM-003: Reminder settings configurable
| Field | Value |
|-------|-------|
| **Steps** | 1. Go to Settings<br>2. Configure reminder times (24h, 1h)<br>3. Enable/disable reminders |
| **Expected** | - Settings saved<br>- Reminders follow settings |
| **Severity** | 🟢 P3 |
| **⚠️ STATUS** | Settings UI NOT implemented - Test will FAIL |

---

## 8. CUSTOM FORMS

### TC-FORM-001: Create intake form
| Field | Value |
|-------|-------|
| **Steps** | 1. Go to Settings → Forms<br>2. Create new form with fields<br>3. Assign to a service |
| **Expected** | - Form created<br>- Shows during booking |
| **Severity** | 🟡 P2 |
| **⚠️ STATUS** | Forms UI NOT implemented - Test will FAIL |

### TC-FORM-002: Client fills form during booking
| Field | Value |
|-------|-------|
| **Steps** | 1. Book service with required form<br>2. Fill form fields<br>3. Complete booking |
| **Expected** | - Form data saved with appointment<br>- Viewable in dashboard |
| **Severity** | 🟡 P2 |
| **⚠️ STATUS** | Forms UI NOT implemented - Test will FAIL |

---

## 9. TENANT ISOLATION

### TC-ISO-001: User cannot access other tenant's data
| Field | Value |
|-------|-------|
| **Steps** | 1. Login as Tenant A owner<br>2. Try to access `/api/appointments` with Tenant B's appointment_id |
| **Expected** | - Returns 404 or forbidden<br>- No data leaked |
| **Severity** | 🔴 P0 |

### TC-ISO-002: Public booking page shows only tenant's services
| Field | Value |
|-------|-------|
| **Steps** | 1. Go to `/book/tenant-a-slug`<br>2. Verify services list |
| **Expected** | - Only Tenant A's services shown<br>- No cross-tenant data |
| **Severity** | 🔴 P0 |

### TC-ISO-003: API key scoped to tenant
| Field | Value |
|-------|-------|
| **Steps** | 1. Create API key as Tenant A<br>2. Use key to call `/api/moltbot/services` |
| **Expected** | - Only Tenant A's services returned |
| **Severity** | 🔴 P0 |

### TC-ISO-004: Tenant cannot see other tenants in admin
| Field | Value |
|-------|-------|
| **Steps** | 1. Login as tenant owner (not super admin)<br>2. Try to access `/admin/tenants` |
| **Expected** | - Access denied or redirect |
| **Severity** | 🔴 P0 |

### TC-ISO-005: Webhook only fires for tenant's events
| Field | Value |
|-------|-------|
| **Steps** | 1. Register webhook for Tenant A<br>2. Create booking on Tenant B<br>3. Check webhook logs |
| **Expected** | - Tenant A's webhook NOT triggered |
| **Severity** | 🟠 P1 |

---

## 10. PLAN ENFORCEMENT

### TC-PLAN-001: Starter plan - max 2 staff
| Field | Value |
|-------|-------|
| **Steps** | 1. Create tenant with Starter plan<br>2. Add 2 staff members<br>3. Try to add 3rd staff |
| **Expected** | - 3rd staff rejected<br>- Upgrade prompt shown |
| **Severity** | 🟠 P1 |

### TC-PLAN-002: Starter plan - max 1 location
| Field | Value |
|-------|-------|
| **Steps** | 1. Starter plan tenant<br>2. Try to add second location |
| **Expected** | - Rejected with upgrade prompt |
| **Severity** | 🟡 P2 |

### TC-PLAN-003: Starter cannot access AI features
| Field | Value |
|-------|-------|
| **Steps** | 1. Login as Starter tenant<br>2. Try to access AI receptionist settings |
| **Expected** | - Feature locked<br>- Shows "Upgrade to Growth" |
| **Severity** | 🟡 P2 |
| **⚠️ STATUS** | Feature gating NOT implemented - Test will FAIL |

### TC-PLAN-004: Pro plan - API webhooks enabled
| Field | Value |
|-------|-------|
| **Steps** | 1. Login as Pro tenant<br>2. Go to Integrations → Webhooks<br>3. Create webhook |
| **Expected** | - Webhook created successfully |
| **Severity** | 🟡 P2 |

### TC-PLAN-005: Downgrade removes excess resources
| Field | Value |
|-------|-------|
| **Steps** | 1. Pro tenant with 5 staff<br>2. Downgrade to Starter (2 staff limit)<br>3. Check staff list |
| **Expected** | - Warning about exceeding limits<br>- OR: Excess staff deactivated |
| **Severity** | 🟡 P2 |
| **⚠️ STATUS** | Downgrade logic NOT implemented - Test will FAIL |

---

## 11. BILLING

### TC-BILL-001: Subscription created on signup
| Field | Value |
|-------|-------|
| **Steps** | 1. Complete new tenant signup<br>2. Check subscription record |
| **Expected** | - Subscription created with selected plan<br>- Trial period if applicable |
| **Severity** | 🟠 P1 |

### TC-BILL-002: Payment method collection
| Field | Value |
|-------|-------|
| **Steps** | 1. Go to Settings → Billing<br>2. Add credit card via Stripe |
| **Expected** | - Card saved securely<br>- Can be used for subscription |
| **Severity** | 🔴 P0 |
| **⚠️ STATUS** | Stripe NOT integrated - Test will FAIL |

### TC-BILL-003: Invoice generation
| Field | Value |
|-------|-------|
| **Steps** | 1. Complete billing cycle<br>2. Check invoices list |
| **Expected** | - Invoice generated<br>- Downloadable PDF |
| **Severity** | 🟡 P2 |
| **⚠️ STATUS** | Billing NOT implemented - Test will FAIL |

### TC-BILL-004: Trial expiration
| Field | Value |
|-------|-------|
| **Steps** | 1. Create tenant with trial<br>2. Let trial expire (or simulate)<br>3. Try to access features |
| **Expected** | - Account limited/locked<br>- Prompt to add payment |
| **Severity** | 🟠 P1 |
| **⚠️ STATUS** | Trial enforcement NOT implemented - Test will FAIL |

---

## 12. RECEPTIONIST API ENDPOINTS

### TC-API-001: Get services list
| Field | Value |
|-------|-------|
| **Steps** | 1. `GET /api/moltbot/services`<br>2. Include `X-API-Key` header |
| **Expected** | - Returns array of services<br>- Each has id, name, duration, price |
| **Severity** | 🔴 P0 |

### TC-API-002: Get staff list
| Field | Value |
|-------|-------|
| **Steps** | 1. `GET /api/moltbot/staff`<br>2. Include `X-API-Key` header |
| **Expected** | - Returns array of staff<br>- Includes services they can perform |
| **Severity** | 🔴 P0 |

### TC-API-003: Check availability
| Field | Value |
|-------|-------|
| **Steps** | 1. `POST /api/moltbot/availability` with:<br>```json<br>{<br>  "service_id": "svc_xxx",<br>  "date": "2026-03-25",<br>  "staff_id": "staff_xxx"<br>}<br>``` |
| **Expected** | - Returns available_slots array<br>- Each slot has start_time, end_time, staff_name |
| **Severity** | 🔴 P0 |

### TC-API-004: Create booking via API
| Field | Value |
|-------|-------|
| **Steps** | See TC-BOOK-003 |
| **Expected** | - Booking created<br>- Returns appointment_id |
| **Severity** | 🔴 P0 |

### TC-API-005: Invalid API key rejected
| Field | Value |
|-------|-------|
| **Steps** | 1. Call any `/api/moltbot/*` endpoint<br>2. Use invalid/expired API key |
| **Expected** | - 401 Unauthorized<br>- Clear error message |
| **Severity** | 🔴 P0 |

### TC-API-006: Rate limiting
| Field | Value |
|-------|-------|
| **Steps** | 1. Make 100+ API calls in 1 minute |
| **Expected** | - 429 Too Many Requests after threshold |
| **Severity** | 🟠 P1 |
| **⚠️ STATUS** | Rate limiting NOT implemented - Test will FAIL |

### TC-API-007: Idempotency key respected
| Field | Value |
|-------|-------|
| **Steps** | 1. Create booking with `idempotency_key: "test123"`<br>2. Retry same request with same key |
| **Expected** | - Second request returns same result<br>- No duplicate booking |
| **Severity** | 🔴 P0 |
| **⚠️ STATUS** | Idempotency NOT implemented - Test will FAIL |

---

## 13. WEBHOOK FIRING

### TC-HOOK-001: booking.created webhook
| Field | Value |
|-------|-------|
| **Steps** | 1. Register webhook for `booking.created`<br>2. Create a booking<br>3. Check webhook endpoint |
| **Expected** | - Webhook received with payload<br>- Contains appointment details<br>- Valid signature |
| **Severity** | 🟠 P1 |

### TC-HOOK-002: booking.cancelled webhook
| Field | Value |
|-------|-------|
| **Steps** | 1. Register webhook for `booking.cancelled`<br>2. Cancel a booking<br>3. Check webhook endpoint |
| **Expected** | - Webhook received<br>- Contains cancellation details |
| **Severity** | 🟠 P1 |

### TC-HOOK-003: booking.rescheduled webhook
| Field | Value |
|-------|-------|
| **Steps** | 1. Register webhook for `booking.rescheduled`<br>2. Reschedule a booking<br>3. Check webhook endpoint |
| **Expected** | - Webhook received<br>- Contains old and new times |
| **Severity** | 🟠 P1 |

### TC-HOOK-004: Webhook signature validation
| Field | Value |
|-------|-------|
| **Steps** | 1. Receive webhook<br>2. Validate `X-Webhook-Signature` header using secret |
| **Expected** | - HMAC-SHA256 signature matches |
| **Severity** | 🟠 P1 |

### TC-HOOK-005: Webhook retry on failure
| Field | Value |
|-------|-------|
| **Steps** | 1. Register webhook with bad URL<br>2. Trigger event<br>3. Wait and check retry attempts |
| **Expected** | - Retries up to 5 times<br>- Exponential backoff |
| **Severity** | 🟡 P2 |
| **⚠️ STATUS** | Retry mechanism NOT implemented - Test will FAIL |

### TC-HOOK-006: Multiple webhooks same event
| Field | Value |
|-------|-------|
| **Steps** | 1. Register 2 webhooks for `booking.created`<br>2. Create a booking |
| **Expected** | - Both webhooks receive event |
| **Severity** | 🟡 P2 |

---

## 14. PERMISSIONS / RBAC

### TC-PERM-001: Owner can do everything
| Field | Value |
|-------|-------|
| **Steps** | 1. Login as owner<br>2. Access all features (staff, services, settings, billing) |
| **Expected** | - Full access to all features |
| **Severity** | 🔴 P0 |

### TC-PERM-002: Staff role limited access
| Field | Value |
|-------|-------|
| **Steps** | 1. Create user with role "staff"<br>2. Login as that user<br>3. Try to access Settings, Billing |
| **Expected** | - Access denied to admin features<br>- Can only manage own appointments |
| **Severity** | 🔴 P0 |
| **⚠️ STATUS** | RBAC NOT enforced - Test will FAIL |

### TC-PERM-003: Manager role moderate access
| Field | Value |
|-------|-------|
| **Steps** | 1. Create user with role "manager"<br>2. Login and try to manage staff, services |
| **Expected** | - Can manage staff and services<br>- Cannot access billing or delete tenant |
| **Severity** | 🟠 P1 |
| **⚠️ STATUS** | RBAC NOT enforced - Test will FAIL |

### TC-PERM-004: Super admin can access all tenants
| Field | Value |
|-------|-------|
| **Steps** | 1. Login as super admin<br>2. Access any tenant's detail page |
| **Expected** | - Full visibility<br>- Can edit, suspend, delete |
| **Severity** | 🔴 P0 |

### TC-PERM-005: API key permission scoping
| Field | Value |
|-------|-------|
| **Steps** | 1. Create API key with `["read"]` permission<br>2. Try to create booking (write operation) |
| **Expected** | - Write rejected<br>- Read allowed |
| **Severity** | 🟠 P1 |
| **⚠️ STATUS** | Permission checking NOT implemented - Test will FAIL |

---

## 15. MOBILE USABILITY

### TC-MOB-001: Public booking page on mobile
| Field | Value |
|-------|-------|
| **Steps** | 1. Open `/book/{slug}` on mobile device (or Chrome DevTools mobile)<br>2. Complete full booking flow |
| **Expected** | - Responsive layout<br>- All buttons tappable<br>- No horizontal scroll<br>- Calendar usable |
| **Severity** | 🟠 P1 |

### TC-MOB-002: Dashboard on mobile
| Field | Value |
|-------|-------|
| **Steps** | 1. Login on mobile<br>2. Navigate through dashboard sections |
| **Expected** | - Hamburger menu works<br>- Tables scroll horizontally<br>- Actions accessible |
| **Severity** | 🟡 P2 |

### TC-MOB-003: Date/time picker on mobile
| Field | Value |
|-------|-------|
| **Steps** | 1. Mobile booking flow<br>2. Select date and time |
| **Expected** | - Native or mobile-friendly picker<br>- Easy to scroll through times |
| **Severity** | 🟡 P2 |

### TC-MOB-004: Form inputs on mobile
| Field | Value |
|-------|-------|
| **Steps** | 1. Mobile booking flow<br>2. Fill client name, email, phone |
| **Expected** | - Appropriate keyboard types (email, tel)<br>- Inputs not obscured<br>- Form submits correctly |
| **Severity** | 🟡 P2 |

### TC-MOB-005: Admin Control Center on mobile
| Field | Value |
|-------|-------|
| **Steps** | 1. Open `/admin/login` on mobile<br>2. Login and navigate |
| **Expected** | - Sidebar collapses to hamburger<br>- Stats cards stack<br>- Tenant list scrollable |
| **Severity** | 🟢 P3 |

---

## Summary: Test Count by Feature

| Feature | Total Tests | Likely Pass | Likely Fail |
|---------|-------------|-------------|-------------|
| Booking Creation | 7 | 7 | 0 |
| Double-Booking Prevention | 5 | 4 | 1 (race condition) |
| Rescheduling | 5 | 5 | 0 |
| Cancellations | 5 | 5 | 0 |
| Waitlist | 3 | 0 | 3 (not implemented) |
| Deposits | 2 | 0 | 2 (not implemented) |
| Reminders | 3 | 0 | 3 (not implemented) |
| Forms | 2 | 0 | 2 (not implemented) |
| Tenant Isolation | 5 | 5 | 0 |
| Plan Enforcement | 5 | 2 | 3 (not enforced) |
| Billing | 4 | 1 | 3 (not implemented) |
| Receptionist API | 7 | 5 | 2 (no rate limit, no idempotency) |
| Webhooks | 6 | 4 | 2 (no retry) |
| Permissions | 5 | 2 | 3 (no RBAC) |
| Mobile Usability | 5 | 5 | 0 |

**Total: 69 test cases**
- Expected Pass: ~45 (65%)
- Expected Fail: ~24 (35%)

---

## Recommended Test Priority

### Phase 1 - Critical Path (Must Pass)
1. TC-BOOK-001, TC-BOOK-002 - Basic booking works
2. TC-DBL-001, TC-DBL-002 - Conflicts detected
3. TC-CANCEL-001 - Cancellation works
4. TC-ISO-001 through TC-ISO-005 - Tenant isolation
5. TC-API-001 through TC-API-005 - API basics work

### Phase 2 - High Priority
1. TC-DBL-003 - Race condition (known issue)
2. TC-PLAN-001, TC-PLAN-002 - Basic plan limits
3. TC-HOOK-001 through TC-HOOK-004 - Webhooks fire
4. TC-MOB-001 - Mobile booking

### Phase 3 - Before Launch
1. All billing tests
2. All RBAC tests
3. Idempotency
4. Rate limiting
5. Retry mechanisms
