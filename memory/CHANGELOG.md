# TimeSlot Pro - Changelog

## [v3.0.0] - 2026-03-23 - Production-Readiness Hardening

### Security Hardening (Stage 1)
- Added Pydantic Field constraints for input validation across all models
- Password minimum 8 characters, max 128 characters
- Service duration constrained to 5-480 minutes
- Name fields limited to 100 characters, descriptions to 1000 chars
- Rate limiting on /api/auth/login (5/min) and /api/auth/register (3/min)
- JWT_SECRET now required (removed weak default)
- Demo accounts endpoint secured (accessible only in dev/preview environments)
- CORS configured with explicit origins (no wildcard fallback)

### Booking Race Condition Fix (Stage 2)
- Implemented optimistic locking using `booking_locks` MongoDB collection
- Atomic slot acquisition with findOneAndUpdate
- Double-booking prevention with conflict queries before insert
- Lock cleanup with TTL index (60 second automatic expiry)
- Final conflict check immediately before database insert

### Plan Enforcement (Stage 3)
- Resource limits enforced on POST /api/staff (Starter: 2, Growth: 8, Pro: unlimited)
- Resource limits on POST /api/services (Starter: 10, Growth: 50, Pro: unlimited)
- Resource limits on POST /api/clients (Starter: 200, Growth: 1000, Pro: unlimited)
- Webhooks gated to Pro plan only via feature check
- API keys gated to Pro plan only via feature check
- Monthly booking limits enforced on POST /api/appointments

### Webhook Reliability (Stage 4)
- Retry queue with exponential backoff (delays: 30s, 1m, 5m, 15m, 1h)
- Maximum 5 retry attempts per webhook delivery
- Background worker for processing pending retries (30 second interval)
- Failure count tracking per webhook
- Automatic cleanup of old retry records (7 day retention)

### Technical Details
- New MongoDB collections: `booking_locks`, `webhook_retries`
- New indexes: `booking_locks.slot_signature` (unique), `webhook_retries.status+next_attempt_at`
- Background tasks started on app startup

---

## [v2.0.0] - 2026-03-23 - V2 Upgrade

### WebSocket & Real-time Notifications
- WebSocket endpoint at /ws with session-based authentication
- Real-time notifications for booking and conversation events

### V1 Receptionist API
- Versioned API at /api/v1/receptionist/*
- API key authentication with rate limiting by plan
- Idempotency key support for safe retries
- Slot locking for atomic booking creation

### Conversation & Inbox System
- Full conversation management with status tracking
- Handoff mechanism with priority levels
- Dashboard Inbox UI with real-time updates

---

## [v1.0.0] - 2026-03-23 - Initial MVP

### Core Features
- Multi-tenant architecture with tenant isolation
- JWT authentication + Emergent Google OAuth
- Staff, Services, Resources, Clients CRUD
- Appointments with conflict detection
- Public booking API
- Webhooks and API keys management
- Email templates (confirmation, reminder, cancellation)
