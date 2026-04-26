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
- **Premium Soft Luxury** design system (April 2026 redesign)
- Fonts: Cormorant Garamond (headings, light weight), Manrope (body)
- Colors: #FCFCFA (page bg), #F7F3EE (sidebar/inputs), #2C2A29 (charcoal primary), #B8868B (rose accent), #E8C5C8 (blush), #E5DFD9 (champagne), #9E948F (taupe text)
- Cards: rounded-3xl, shadow-[0_8px_30px_rgb(0,0,0,0.04)]
- Buttons: rounded-full, charcoal primary
- Inputs: bg-[#F7F3EE] border-transparent
- Editorial, feminine but professional, high-end beauty brand aesthetic

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
- [x] **Industry-Themed UI Overhaul (April 18, 2026):**
  - [x] Industry theme system (salon=rose, dentist=blue, vet=green, clinic=blue, default=indigo)
  - [x] Dark themed sidebar matching industry colors
  - [x] Colorful hero section with gradient stats
  - [x] AI Intelligence banner with contextual business insights
  - [x] Industry badge in header (e.g., "Salon & Spa")
  - [x] Industry-specific terminology (stylist/patient/pet parent etc.)
- [x] **AI Admin Assistant (April 18, 2026):**
  - [x] Floating chat bubble (sparkles icon) on admin pages
  - [x] Industry-specific AI personality (Bella/Dr. Assist/PawPal)
  - [x] Real LLM integration via Emergent key (gpt-4o-mini)
  - [x] Context-aware: knows today's schedule, pending approvals, services, staff
  - [x] Quick action buttons for common queries
  - [x] Replaces old Moltbot widget
- [x] **Vibrant Industry-Themed UI (April 19, 2026):**
  - [x] Calendar page: themed gradient header, Day/Week toggle, colored appointment cards with accent borders
  - [x] Team page: industry terminology tabs (Stylists/Practitioners/Vets), colorful gradient avatars, service duration/price badges
  - [x] All dialogs themed with gradient buttons
  - [x] Pending approvals with approve/reject in themed cards
  - [x] 3 demo tenants seeded: Bella Hair Studio (salon), Bright Smile Dental (dentist), Happy Paws Vet Clinic (vet)
- [x] **Ultra Sleek Calendar & Industry Services (April 19, 2026):**
  - [x] Week time-grid calendar: day columns (Mon-Sun), time labels (08:00-17:00), colored appointment blocks
  - [x] Staff avatar row with gradient circles and click-to-filter
  - [x] Appointment blocks colored by status: green=confirmed, amber=pending, blue=completed, red=cancelled
  - [x] Glow hover effects on all buttons, smooth rounded edges
  - [x] 12 industry-specific services per tenant (salon: Balayage/Keratin/Bridal Hair, dentist: Root Canal/Crown/Whitening, vet: Vaccination Packs/Microchip/X-Ray)
  - [x] Day view with themed appointment cards
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

## Phase 1: Visual Brightness + Real Settings (April 21, 2026)
- [x] Brightened color palette with warmer stat card icons
- [x] Settings rebuilt as 4-tab Business Setup Centre
- [x] Branding with real working color pickers + Live Preview
- [x] 10 real Booking Rules controls connected to API
- [x] New API: GET/PUT /api/tenants/me/booking-rules
- [x] All tests passing (iteration_13)


## Phase 2: Staff Management & Availability (April 21, 2026)
- [x] Multi-tab staff edit dialog: Details, Schedule, Services, Access
- [x] Working hours editor: Mon-Sun toggles with start/end/break times
- [x] Calendar color picker (8 salon-inspired preset colors)
- [x] Bookable Online toggle per staff member
- [x] Active/Inactive toggle per staff
- [x] Role-based permissions: Owner/Manager/Staff + 5 permission toggles
- [x] Staff cards show days/week and Online Booking badges
- [x] All tests passing (iteration_14)


## Phase 3: Service Enhancements (April 21, 2026)
- [x] Service categories with grouping in list view + autocomplete
- [x] Buffer time per service (gap between appointments)
- [x] Add-ons system (name/price/duration) with inline add/remove
- [x] Deposit settings (required toggle + deposit amount)
- [x] Visible Online toggle (show/hide on public booking page)
- [x] Staff assignment per service (pill-button UI with All Staff toggle)
- [x] Enhanced service dialog with full premium layout
- [x] All tests passing (iteration_15, 27/27 backend)



## Phase 4: Calendar Quick-Book & Public Booking Premium Redesign (April 22, 2026)
### Admin Calendar UX
- [x] Click-to-book on every empty time slot in Week view (hour + half-hour slots)
- [x] Click-to-book on every time slot in new Day view (replaces DayList — grid-based timeline)
- [x] "Book" button opens New Booking dialog pre-filled with current time (rounded to :00/:30) and the currently selected date (visible in the dialog description)
- [x] Bolder `border-2` outlines on calendar grid columns and headers for better visibility
- [x] Staff filter selection now also pre-fills new bookings

### Public Booking Page Premium Redesign
- [x] Full redesign to match premium salon aesthetic: Cormorant Garamond typography, blush/champagne palette, rounded-3xl cards, bento-style layout
- [x] Tenant branding color (primary_color from tenant.branding) drives hero badge, CTA buttons, service card accents, time-slot highlights, and stepper progress
- [x] Sparkles badge hero with tenant name + address; "Powered by BookSlot" footer
- [x] Step 2 now honors staff-service assignments (only eligible staff shown for selected service)
- [x] Date picker greys out past dates AND non-working days (derived from staff.working_hours across all eligible staff)

### Backend Booking Rules Enforcement
- [x] GET /api/public/booking/{slug} now filters services by `visible_online!=false` and staff by `bookable_online!=false`
- [x] GET /api/public/booking/{slug}/staff-for-service filters by `bookable_online!=false`
- [x] Public staff response now includes `working_hours` so the frontend can disable non-working days
- [x] Fixed P0 bug in 5 availability helpers: `day_schedule.get('enabled')` check replaced with `bool(start and end) or enabled is True` (backwards compatible with both seeded shapes)
- [x] iteration_17.json: 43/43 regression tests PASS, 3/3 new tests PASS, end-to-end booking confirmed with `confirmation_code` and `requires_approval=true`

## Phase 5: Revenue Boosters + Bella Avatar (Feb 26, 2026)
**Bella the Salon AI gets a face**
- [x] Generated glamorous salon-style portrait via Gemini Nano Banana → `/app/frontend/public/bella-avatar.jpg`
- [x] Wired into AIAdminAssistant (floating button, chat header, message rows) when `theme.aiName === 'Bella'`
- [x] Wired into TenantLayout sidebar AI status pill

**Instant Rebooking at Checkout** (post-confirmation upsell)
- [x] Added `default_rebook_weeks` field to Service model (owner-set per service)
- [x] AI heuristic suggests interval based on service name + duration when no override
- [x] Public endpoints: `GET/POST /api/public/booking/{code}/rebook-suggestions` & `/rebook`
- [x] RebookCard component on confirmation step — shows AI-recommended interval with "AI" pill, 3 fixed week options + custom interval, gold-themed CTA
- [x] Conflict detection (same staff + overlapping window) returns `success:false`/`reason:slot_taken`

**Fill My Day — push notification blast**
- [x] Endpoint `POST /api/appointments/{id}/blast-availability` (owner auth) sends web-push to all tenant subscribers using existing VAPID keys
- [x] Persists `blasted_at` timestamp + audit row in `push_notifications` collection
- [x] CalendarPage ApptDetail dialog: "Fill My Day" button shown only when `status==='cancelled' && !blasted_at`
- [x] Uses Bella's avatar as the push notification icon
- [x] Deep-link to `/book/{slug}?prefill_service=...` for one-tap claim

**Client Lifetime Value + VIP Tagging**
- [x] `tenant.settings.vip_threshold_euros` (default 500) — owner sets in Settings → Booking Rules → "VIP Clients" section
- [x] Endpoints: `GET/PUT /api/tenants/me/clv-settings`, `GET /api/clients/{id}/lifetime-stats`
- [x] `GET /api/clients` enriched with `lifetime_value`, `visit_count`, `last_visit_at`, `is_vip_auto`, `is_vip_effective`
- [x] `GET /api/appointments` enriched with `client_lifetime_value`, `client_is_vip` (single bulk aggregation, no N+1)
- [x] Calendar appointment blocks: gold Crown icon next to VIP client names
- [x] ApptDetail dialog: VIP badge "VIP · €X lifetime" in header
- [x] Clients page: gold Crown badge top-right of card + "Auto VIP" / "VIP Client" label
- [x] Tested: backend 16/16 PASS (test_iteration19_rebook_clv_blast.py)

## Backlog (next)
xt up)
- [ ] P2: Client self-service portal
- [ ] P2: Instant Rebooking at Checkout (AI suggestion for next appointment)
- [ ] P2: "Fill My Day" mode (last-minute availability blast to opted-in clients)
- [ ] P2: Client Lifetime Value tracking / VIP tagging
- [ ] P3: Refactor server.py (~5770 lines) into route modules

## Phase 4.1: Custom Plan in Command Centre (April 23, 2026)
- [x] Added `PlanType.CUSTOM` to backend enum and `get_effective_features()` helper
- [x] `POST /api/admin/tenants` accepts `plan: "custom"` with a `custom_features` matrix (price, max_staff, max_locations, 16 feature toggles). Validated server-side — rejects missing/invalid payloads.
- [x] `PUT /api/admin/tenants/{id}` supports switching to/from custom; auto-clears `custom_features` when moving back to a standard plan
- [x] All plan-gated checks (staff limit, AI receptionist gates, `/tenants/me/features`) now read `get_effective_features(tenant)` — so custom tenants get exactly the capabilities the admin selected
- [x] Admin stats/MRR include custom tenants (MRR pulls each custom tenant's own price)
- [x] Command Centre UI: 4-column plan grid with a "Custom" tile (Sparkles badge) + inline configurator (Price €/mo, Max Staff, Max Locations, 16 feature switches) shown only when Custom is selected
- [x] Filter dropdown now lets super admins filter clients by `custom` plan too

- [ ] P3 (polish): Fix admin calendar slot-button z-index so clicks on partially-overlapped slots open New Booking instead of appointment detail

## Phase 4.2: Onyx & Gold Theme Preset (Feb 26, 2026)
- [x] Added `theme_preset` field to `tenant.branding` (whitelisted in `PUT /api/tenants/me/branding`)
- [x] Created **Theme Preset system**: `/app/frontend/src/config/themePresets.js` defines two presets:
  - `default` (Champagne & Blush — existing look)
  - `onyx_gold` (Rich black canvas, antique-gold leaf, Cinzel serif typography)
- [x] Added Cinzel + Allura Google Fonts to `/app/frontend/public/index.html`
- [x] Created `/app/frontend/src/components/GoldLeafDecor.jsx` — pure-SVG gold-leaf ornaments (frame / corner / divider variants)
- [x] Created `/app/frontend/src/styles/theme-onyx-gold.css` — scoped Tailwind utility overrides under `[data-theme="onyx_gold"]` covering surfaces, borders, text, shadows (gold glow), inputs, calendar, scrollbars, custom `card-flat`/`badge-*` classes
- [x] **Settings → Branding tab** now opens with a Theme Preset selector (two cards with swatches, descriptions, active gold border, Check badge). Switching auto-fills the colour pickers below with the preset's palette.
- [x] **TenantLayout** rebuilt to read theme tokens via `resolveTheme(tenant)` — sidebar, top bar, AI status pill, nav items, user menu, and gold-leaf divider at sidebar bottom all dark-themed when preset is active. Staff users inherit the same theme.
- [x] **PublicBookingPage** renders gold-leaf flourish + Cinzel serif business name + gold divider on hero when preset is active. Booking flow (service/staff/date/time/details) entirely dark-themed via CSS scope.
- [x] **MyBookingsPage** picks up the theme of the client's most-recently-booked salon via `business_theme_preset` (added to `/api/client/bookings` serialization)
- [x] **ManageBookingPage** renders dark with gold business header (theme + logo + colour returned from `/api/public/booking/manage/{code}`)
- [x] **Demo Salon tenant** (`salon@bookslot.io` → Bella Hair Studio) seeded with `theme_preset: 'onyx_gold'` so the user can see the new look out of the box at `/book/bella-hair-studio-d5d6d8`
- [x] Backend regression: 4/4 new tests in `test_iteration18_theme_preset.py` PASS, 13/13 settings + availability regression PASS
- [x] Frontend smoke tests pass on Public Booking, Admin Dashboard, Settings/Branding, Manage Booking, Calendar (incl. Sunday-column tint fix)

