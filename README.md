# BookSlot

Online booking and scheduling for service businesses (salons, clinics, dentists, vets, consultants).
One installation serves many businesses ("tenants"); you run the platform from the super-admin portal.

- **Backend:** Python / FastAPI, MongoDB (`backend/`)
- **Frontend:** React + Tailwind (`frontend/`)
- No dependency on Emergent or any other app builder: it runs on any host.

## What's in it

| For the business | For their clients | For you (platform owner) |
|---|---|---|
| Week calendar with drag-and-drop, list view, approve/decline requests | Public booking page per business (`/book/<slug>`) | Super-admin at `/admin` |
| Staff with working hours, breaks, time off, logins & permissions | Only real free times are offered (hours, breaks, time off, existing bookings, notice period) | Create/deactivate businesses, change plans |
| Services, clients (VIP, notes, history, live visit/spend stats) | "Any available" team member option | Platform stats (MRR, bookings) |
| Reports + CSV/print export | Confirmation, reminder, cancellation and reschedule emails | "Log in as" a business owner for support |
| Email/SMS templates, intake forms (Pro), webhooks + API (Pro) | Manage/cancel link (respects the business's cancellation rules) | |
| AI receptionist (Growth/Pro) that checks real availability and books | AI chat on the booking page | |

## Run it locally

Requirements: Python 3.11+, Node 18+, MongoDB (local, Docker `docker run -d -p 27017:27017 mongo:7`, or a free MongoDB Atlas cluster).

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # then edit: MONGO_URL, JWT_SECRET, SUPER_ADMIN_EMAIL/PASSWORD
# for local http:  ENVIRONMENT=development  FRONTEND_URL=http://localhost:3000  COOKIE_SECURE=false
uvicorn server:app --reload --port 8001

# Frontend (new terminal)
cd frontend
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env
npm install
npm start                   # opens http://localhost:3000
```

- Sign up at `/signup` to create a business.
- Platform admin: `/admin` with `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` (created automatically on first start).
- API docs (development only): http://localhost:8001/api/docs

## Deploy

**Option A: one server with Docker (simplest).** On any VPS (Hetzner, DigitalOcean, Lightsail...):

```bash
cp backend/.env.example backend/.env    # fill in; FRONTEND_URL = https://your-domain
docker compose up -d --build
```

This runs MongoDB, the API and the website together; the site's nginx forwards `/api` to the backend.
Put HTTPS in front (e.g. Cloudflare, or Caddy: `caddy reverse-proxy --from your-domain --to :80`).
Back up the `mongo_data` volume.

**Option B: managed services.**
1. **Database:** MongoDB Atlas (free tier works to start). Copy the connection string into `MONGO_URL`.
2. **API:** Render / Railway / Fly.io from `backend/` (Dockerfile included), with the variables from `.env.example`.
   Use **one instance/worker** (the reminder job runs inside the API). If the host has no persistent disk,
   set `S3_BUCKET` (+ credentials) so uploaded logos survive restarts (Cloudflare R2 is cheap).
3. **Website:** Netlify / Vercel / Cloudflare Pages from `frontend/`: build `npm run build`, output `build`,
   environment variable `REACT_APP_BACKEND_URL=https://your-api-domain`. SPA redirects are included.
4. Set the API's `FRONTEND_URL` (and `CORS_ORIGINS` if you use more than one domain) to the website address.

### Optional services (all off until you add keys)
| Feature | Variable(s) | Where to get it |
|---|---|---|
| Emails (confirmations, reminders, password reset) | `RESEND_API_KEY`, `SENDER_EMAIL` | resend.com (verify your domain) |
| SMS add-on | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | twilio.com |
| AI receptionist | `OPENAI_API_KEY` **or** `ANTHROPIC_API_KEY` | platform.openai.com / console.anthropic.com |
| Google sign-in | `GOOGLE_CLIENT_ID` | Google Cloud Console → OAuth client (Web), add your site to *Authorised JavaScript origins* |
| Logo storage on S3/R2 | `S3_BUCKET`, `S3_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | AWS / Cloudflare R2 |

## Plans

Plan limits and features live in `backend/core/plans.py` (Starter / Growth / Pro). Change a business's plan
in `/admin`. Billing isn't connected: there's no card payment or trial expiry yet, so plans are set manually.

## Tests

```bash
# with the API running against a throwaway database (e.g. DB_NAME=bookslot_test):
cd backend
BASE_URL=http://localhost:8001 DB_NAME=bookslot_test SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... \
  RATE_LIMIT_SCALE=5 python tests/test_e2e.py     # 23 end-to-end checks
DB_NAME=bookslot_test python tests/test_ai_flow.py # AI receptionist with a fake model
```
(start the API with `RATE_LIMIT_SCALE=5 ALLOW_PRIVATE_WEBHOOKS=true` for the test run.)

## Project layout

```
backend/
  server.py            app setup, startup jobs
  core/                config, auth, booking engine, scheduling maths, email/SMS, webhooks, AI client, storage
  routes/              API endpoints grouped by area
  tests/               end-to-end + AI flow tests
frontend/src/
  pages/public         landing, signup/login, booking page, manage booking
  pages/admin          the business dashboard
  pages/superadmin     platform admin
docker-compose.yml     self-hosting
```

## Webhooks

Pro businesses can add webhook URLs (Settings → Integrations). Each POST has the JSON body and header
`X-BookSlot-Signature: sha256=<hex>` = HMAC-SHA256(raw body, signing secret). Events: `booking.created`,
`booking.updated`, `booking.cancelled`, `booking.completed`. Failed deliveries are retried after 30 s and 5 min.
