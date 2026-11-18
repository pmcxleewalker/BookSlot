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
| `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` | for AI | Powers the AI receptionist. Anthropic is used if its key is set |
| `AI_PROVIDER`, `AI_MODEL` | no | Override provider (`anthropic`/`openai`) and model |
| `GOOGLE_CLIENT_ID` | for Google sign-in | OAuth client ID from Google Cloud Console |

## Frontend environment variables

| Variable | What it does |
|---|---|
| `REACT_APP_BACKEND_URL` | Base URL of the backend (no trailing `/api`) |
| `REACT_APP_GOOGLE_CLIENT_ID` | Same Google client ID. If unset, the Google button is hidden |

No Emergent services are used. Uploaded files are stored in MongoDB.
