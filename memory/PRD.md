# BookSlot - Multi-Tenant SaaS Booking Platform

## Product Overview
BookSlot is a comprehensive multi-tenant SaaS booking platform designed for service businesses like salons, spas, and wellness centers. It provides both a Super Admin portal for platform management and tenant dashboards for business operations.

## Architecture
- **Backend**: FastAPI (Python) - Single server.py file (~4000+ lines)
- **Frontend**: React with Tailwind CSS and Shadcn UI components
- **Database**: MongoDB
- **Authentication**: JWT + Emergent-managed Google OAuth
- **AI**: Moltbot AI receptionist using GPT-4o-mini via emergentintegrations

## Current Implementation Status

### Completed Features (Phase 1 - Core)
- [x] Multi-tenant architecture with tenant isolation
- [x] User authentication (JWT + Google OAuth)
- [x] Super Admin dashboard (tenant management, stats, tier management)
- [x] Tenant onboarding flow
- [x] Service management (CRUD)
- [x] Staff management (CRUD with working hours, service assignments)
- [x] Client management (VIP status, notes, service history)
- [x] Appointment booking (public booking page)
- [x] Calendar view (week view with drag-and-drop)
- [x] Basic reporting

### Completed Features (Phase 2 - Advanced)
- [x] Webhook system with logging and retries
- [x] Staff working hours configuration
- [x] Drag-and-drop calendar
- [x] SMS & Email notification architecture (Resend/Twilio integration)
- [x] Moltbot AI Conversation System (booking, rescheduling, cancellation via natural language)
- [x] Staff service assignment (admins can assign specific services to staff)
- [x] "Salon Package" features:
  - Enhanced client management (VIP status, detailed notes)
  - Advanced reporting dashboard (revenue, bookings, PDF/CSV export)
  - Tenant-level branding (logo, colors)

### Completed Features (Phase 3 - Latest) - March 25, 2026
- [x] **UI Refactoring:**
  - Merged Appointments tab into Calendar (Calendar now has Calendar/List view toggle)
  - Moved Messages content into AI Receptionist (now has AI Chat, Conversations, Message Templates tabs)
  - Moved Integrations into Settings (now has General, Branding, Notifications, Integrations tabs)
  - Removed Resources from navigation
  - Streamlined sidebar: Dashboard, Calendar, Staff, Services, Clients, Forms, AI Receptionist, Reports, Settings
- [x] **Notification Bell:** Staff see new bookings/cancellations in header
- [x] **Web Push Notifications:** Backend infrastructure for push notifications to staff devices
- [x] **Help System:** Help button in header opens collapsible help panel with topics and FAQs
- [x] **File Upload for Branding:** Users can upload logos from their devices (not just URL input)
- [x] **Smart Booking Alternatives:** Backend API for suggesting alternative staff/times when preferred slot unavailable

## API Endpoints

### Authentication
- POST /api/auth/register - Register new tenant
- POST /api/auth/login - Login
- POST /api/auth/google - Google OAuth callback
- GET /api/auth/me - Get current user

### Tenants
- GET /api/tenants/me - Get current tenant
- PUT /api/tenants/me - Update tenant
- GET/PUT /api/tenants/me/branding - Manage branding settings

### Services
- GET /api/services - List services
- POST /api/services - Create service
- PUT /api/services/{id} - Update service
- DELETE /api/services/{id} - Delete service

### Staff
- GET /api/staff - List staff
- POST /api/staff - Create staff
- PUT /api/staff/{id} - Update staff
- DELETE /api/staff/{id} - Delete staff
- PUT /api/staff/{id}/working-hours - Update working hours
- PUT /api/staff/{id}/services - Assign services

### Appointments
- GET /api/appointments - List appointments (with date filters)
- POST /api/appointments - Create appointment
- PUT /api/appointments/{id} - Update appointment
- POST /api/appointments/{id}/cancel - Cancel appointment

### Public Booking
- GET /api/public/booking/{slug} - Get tenant info
- GET /api/public/booking/{slug}/availability - Get availability
- POST /api/public/booking/{slug} - Create booking
- GET /api/public/booking/{slug}/alternatives - Get alternative suggestions

### Notifications
- GET /api/notifications - Get notifications
- POST /api/notifications/{id}/read - Mark notification as read
- POST /api/notifications/read-all - Mark all as read

### Web Push
- GET /api/push/vapid-public-key - Get VAPID public key
- POST /api/push/subscribe - Subscribe to push
- DELETE /api/push/unsubscribe - Unsubscribe

### Files
- POST /api/upload/image - Upload image file
- GET /api/files/{id} - Get uploaded file

### Reports
- GET /api/reports - Get reports
- GET /api/reports/detailed - Get detailed reports
- GET /api/reports/export - Export reports (CSV/PDF)

### Messages
- GET /api/messages/templates - Get message templates
- PUT /api/messages/templates/{id} - Update template

### Webhooks
- GET /api/webhooks - List webhooks
- POST /api/webhooks - Create webhook
- DELETE /api/webhooks/{id} - Delete webhook

### AI Receptionist (Moltbot)
- GET /api/moltbot/status - Get Moltbot status
- POST /api/moltbot/{tenant_id}/chat - Send chat message
- GET /api/moltbot/{tenant_id}/conversations - Get conversations

### Super Admin
- POST /api/admin/login - Admin login
- GET /api/admin/stats - Platform statistics
- GET /api/admin/tenants - List all tenants
- POST /api/admin/tenants - Create tenant
- PUT /api/admin/tenants/{id} - Update tenant
- DELETE /api/admin/tenants/{id} - Delete tenant

## Database Collections
- tenants - Tenant/business data with branding
- users - User accounts
- services - Services offered
- staff - Staff members with working hours
- clients - Client data with VIP status
- appointments - Bookings
- notifications - Staff notifications
- push_subscriptions - Web push subscriptions
- files - Uploaded files metadata
- webhook_configs - Webhook configurations
- webhook_logs - Webhook delivery logs
- conversations - Moltbot conversations
- message_templates - SMS/Email templates

## Test Credentials
- **Tenant Admin:** demo@bookslot.io / Demo123!
- **Super Admin:** admin@bookslot.io / Admin123!

## Upcoming Features (Backlog)
### P1 (High Priority)
- Stripe payment integration for deposits
- Google Calendar sync for staff

### P2 (Medium Priority)
- Custom intake forms builder for clients
- Waitlist automation

### Future
- Resource booking with conflict detection
- Multi-location support
- Moltbot Analytics Dashboard
- Mobile app

## Technical Debt
- **CRITICAL:** server.py is 4000+ lines - needs to be split into routers (auth.py, staff.py, booking.py, etc.)
- Add more comprehensive error handling
- Implement rate limiting
- Add caching layer

## Third-Party Integrations
- **Emergent Auth:** Google OAuth
- **Emergent LLM:** GPT-4o-mini for Moltbot
- **Emergent Object Storage:** File uploads
- **Resend:** Email notifications (requires API key)
- **Twilio:** SMS notifications (requires API key)
