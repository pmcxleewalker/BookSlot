# BookSlot

Booking software for service businesses. Built by QF Digital (QuickFleet Limited).

- `frontend/`: React (CRA + craco, Tailwind, shadcn/ui)
- `backend/`: FastAPI + MongoDB (`server.py`)

## Backend environment variables

| Variable | Required | What it does |
|---|---|---|
| `MONGO_URL`, `DB_NAME` | yes | MongoDB connection |
| `JWT_SECRET` | **yes** | Signs login tokens. If unset, a random secret is used and everyone is logged out on restart |
| `CORS_ORIGINS` | yes | Comma-separated allowed origins, e.g. `https://bookslot1.com` |
| `RESEND_API_KEY`, `SENDER_EMAIL` | for email | Confirmation and reminder emails |
| `PUBLIC_SITE_URL` | no | Used in email links. Default `https://bookslot1.com` |
| `DEMO_NOTIFY_EMAIL` | no | Where marketing-site demo requests are emailed |
| `REMINDERS_ENABLED` | no | `true` by default. Sends reminder emails every 10 minutes |
| `EMERGENT_LLM_KEY` | for AI | Powers the AI receptionist |

## Frontend environment variables

| Variable | What it does |
|---|---|
| `REACT_APP_BACKEND_URL` | Base URL of the backend (no trailing `/api`) |
