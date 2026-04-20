# AI Lead Conversion System for Real Estate Agencies

Production-ready MVP built with Next.js, Supabase, and OpenRouter to help real estate agencies capture, qualify, and convert leads.

## Features

- Floating chat widget (Intercom-style)
- AI real estate sales assistant persona (conversion-focused)
- Mandatory lead capture gate (name + phone/email)
- Lead deduplication by email/phone per agency
- Structured lead qualification (hot, warm, cold)
- Sales-driven closing mode once budget/location/timeline are captured
- Step-by-step appointment booking flow (day -> morning/afternoon -> reservation)
- Multi-tenant agency isolation by API key
- CRM dashboard with:
  - lead list
  - qualification status
  - conversation history
  - leads per day analytics
  - business intelligence layer (funnel + conversion + response-time)
- hot/new visual highlighting
- Auto follow-up endpoint for inactive leads
- Hot lead alert system (Resend email)
- Demo mode (`?demo=true`) with preloaded hot-lead flow
- Vercel-ready Next.js project structure

## Tech Stack

- Frontend: Next.js (App Router) + React + TypeScript
- Backend: Next.js API routes
- Database: Supabase (PostgreSQL)
- AI: OpenRouter (`openai/gpt-4o-mini` by default, configurable in env)
- Deployment: Vercel

## Project Structure

```txt
src/
	app/
		api/
			analytics/leads-per-day/route.ts
      analytics/summary/route.ts
			chat/route.ts
			follow-up/run/route.ts
			leads/route.ts
			leads/[leadId]/messages/route.ts
		dashboard/
			page.tsx
			settings/page.tsx
		globals.css
		layout.tsx
		page.tsx
	components/
		analytics-card.tsx
    analytics-summary-panel.tsx
		chat-widget.tsx
		dashboard-shell.tsx
		leads-board.tsx
	lib/
    analytics.ts
		ai.ts
		calendar.ts
		env.ts
		lead-parser.ts
		qualification.ts
		supabase.ts
		types.ts
supabase/
	schema.sql
  seeds/
    analytics_sample_data.sql
tests/
	qualification.test.ts
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_API_KEY=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4o-mini
RESEND_API_KEY=
HOT_LEAD_ALERT_TO=
HOT_LEAD_ALERT_FROM=onboarding@resend.dev
APP_URL=http://localhost:3000
BACKEND_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_BACKEND_API_URL=http://127.0.0.1:8000
FOLLOW_UP_DELAY_MINUTES=20
```

## Supabase Setup

1. Create a Supabase project.
2. Open SQL editor and run [supabase/schema.sql](supabase/schema.sql).
3. In Settings -> API, copy:

- Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
- Publishable key -> `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- service_role secret -> `SUPABASE_SERVICE_ROLE_KEY` (server-side only)

4. Confirm a demo agency exists with API key `demo-agency-key`.
5. Verify integration with `GET /api/health/supabase` and expect `{ "ok": true, ... }`.

## Local Development

```bash
npm install
npm run dev
```

Open:

- App: `http://localhost:3000/?agencyKey=demo-agency-key`
- Demo mode: `http://localhost:3000/?agencyKey=demo-agency-key&demo=true`
- Dashboard: `http://localhost:3000/dashboard?agencyKey=demo-agency-key`

## API Endpoints

- `POST /api/chat`
  - Body: `{ agencyApiKey, leadId?, message }`
  - Persists message, updates lead qualification, returns assistant reply

- `GET /api/leads?agencyApiKey=...`
  - Returns agency leads

- `GET /api/leads/:leadId/messages?agencyApiKey=...`
  - Returns conversation history

- `POST /api/follow-up/run`
  - Requires `agencyApiKey` via query string or `x-agency-key` header
  - Sends follow-up to leads inactive for `FOLLOW_UP_DELAY_MINUTES`
  - Intended for cron job usage

- `POST /api/agencies`
  - Admin only (`x-admin-key` when `ADMIN_API_KEY` is set)
  - Body: `{ name, primaryColor?, logoUrl? }`
  - Creates tenant agency and returns API key

- `POST /api/agencies/:agencyId/api-keys`
  - Admin only (`x-admin-key`)
  - Rotates tenant API key

- `GET /api/analytics/leads-per-day?agencyApiKey=...`
  - Returns simple daily lead counts

- `GET /api/analytics/summary?agencyApiKey=...&days=14`
  - Returns funnel (`visitor -> lead -> qualified -> booked`),
  - conversion rate, average response time, leads/day,
  - and chart-ready series (`leads_over_time`, `conversion_percent`).
  - Persists per-day aggregate snapshots into `daily_stats`.

## Analytics Validation (Sample Data)

1. Run migrations (includes `daily_stats` table).
2. Apply seed file: [supabase/seeds/analytics_sample_data.sql](supabase/seeds/analytics_sample_data.sql).
3. Call:

- `GET /api/analytics/summary?agencyApiKey=analytics-test-key&days=7`

4. Expected summary from seed:

- `visitor: 4`
- `lead: 4`
- `qualified: 3`
- `booked: 1`
- `conversion_rate: 25.00`
- `avg_response_time_seconds: 140.00`

- `GET /api/health/supabase`
  - Verifies server can reach Supabase and query `agencies`

## Multi-Tenant Model

- Each agency has its own `api_key`.
- API middleware resolves `agency_key -> agency_id` and forwards tenant context headers.
- Every API call is scoped by `agency_id`.
- Leads, messages, and events are isolated by tenant.
- Supabase RLS policies enforce tenant isolation for authenticated users.

## Isolation Test Scenario

1. Create two agencies via `POST /api/agencies`.
2. Insert leads for each agency using each generated API key.
3. Query `GET /api/leads?agencyApiKey=<agency_A_key>` and verify only agency A leads return.
4. Query `GET /api/leads?agencyApiKey=<agency_B_key>` and verify only agency B leads return.
5. Repeat for `GET /api/leads/:leadId/messages` and verify no cross-tenant message access.

## Deployment (Vercel)

1. Import repository in Vercel.
2. Set environment variables from `.env.example`.
3. Deploy.
4. Optional: Add Vercel cron to call `POST /api/follow-up/run`.

Example `vercel.json` cron (optional):

```json
{
  "crons": [
    {
      "path": "/api/follow-up/run",
      "schedule": "*/20 * * * *"
    }
  ]
}
```

## Event-Driven Backend (FastAPI + Redis Worker)

For high-throughput lead ingestion and non-blocking notification delivery, a separate backend service is available under [backend/](backend/).

Architecture:

- Frontend -> FastAPI API -> Supabase
- FastAPI emits events -> Redis queue
- Worker consumes queue -> WhatsApp/Email providers
- Outbox + logs in Supabase ensure retries and observability

### Why this design

- API requests stay fast (no synchronous WhatsApp calls)
- Worker retries failures (up to 3 attempts)
- Event outbox prevents silent event loss
- Multi-tenant isolation enforced by `agency_id`
- Demo tenant (`demo-agency-key`) routes to `events:test`

### Production Hardening

- Event state machine: `queued -> processing -> success -> failed -> retrying -> dead_letter`
- Idempotency:
  - `events.event_id` unique
  - `events(agency_id, lead_id, event_type)` unique (when `lead_id` is not null)
- Provider abstraction:
  - `NotificationProvider`
  - `WhatsAppProvider`, `EmailProvider`, `SMSProvider`, `TestProvider`
- Retry safety:
  - exponential-ish backoff (`2s`, `5s`, `12s`)
  - DLQ promotion after max attempts
- Observability:
  - `event_logs` row per receive/process/provider/retry/DLQ action
- Rate limiting:
  - per-tenant per-channel Redis counter (`MAX_NOTIFICATIONS_PER_SECOND`)

### Text Architecture Diagram

```text
Client/API consumer
   |
   v
FastAPI (/v1/leads)
   | validate + persist lead
   v
events table (status=queued, attempts=0)
   |
   +--> event_outbox (pending)
            |
            v
      Redis queue (events:main | events:test)
            |
            v
      Worker processor
        - idempotency check (event_id/status)
        - mark processing
        - enforce tenant rate limit
        - resolve provider by tenant/channel
        - send notification
        - mark success/failure/retrying/dead_letter
            |
            +--> event_logs
            +--> dead_letter_queue (after max retries)
```

### Files

- API: [backend/app/main.py](backend/app/main.py)
- Queue: [backend/app/queue.py](backend/app/queue.py)
- Outbox + logs: [backend/app/outbox.py](backend/app/outbox.py), [backend/app/logging_store.py](backend/app/logging_store.py)
- Event store and lifecycle: [backend/app/event_store.py](backend/app/event_store.py)
- Providers: [backend/app/providers.py](backend/app/providers.py)
- Tenant rate limiting: [backend/app/rate_limiter.py](backend/app/rate_limiter.py)
- Worker: [backend/worker/processor.py](backend/worker/processor.py), [backend/worker/run_worker.py](backend/worker/run_worker.py)
- Outbox dispatcher: [backend/scripts/dispatch_outbox.py](backend/scripts/dispatch_outbox.py)
- Event schema migrations: [supabase/migrations/20260416194500_event_queue_tables.sql](supabase/migrations/20260416194500_event_queue_tables.sql), [supabase/migrations/20260416201000_event_reliability_upgrade.sql](supabase/migrations/20260416201000_event_reliability_upgrade.sql)

### Env Vars (backend service)

Use existing Supabase vars and add:

```bash
REDIS_URL=redis://localhost:6379/0
WHATSAPP_API_URL=https://your-whatsapp-provider/send
WHATSAPP_API_KEY=
EMAIL_API_URL=
EMAIL_API_KEY=
SMS_API_URL=
SMS_API_KEY=
TENANT_PROVIDER_OVERRIDES={"agency-1":{"whatsapp":"test","email":"email"}}
MAX_NOTIFICATIONS_PER_SECOND=5
DEFAULT_CURRENCY=USD
```

### Run

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Worker:

```bash
cd backend
.venv\Scripts\activate
python -m worker.run_worker
```

Demo-only worker:

```bash
python -m worker.run_worker --demo
```

Outbox replay (cron-safe):

```bash
python scripts/dispatch_outbox.py
```

## Sprint Plan and Git Workflow

Use this exact sequence and do not start a new sprint until tests pass and code is pushed.

### Sprint 1: Foundation

- Scope:
  - Next.js + TypeScript + lint/test setup
  - Supabase schema
  - environment configuration
- Validation:
  - `npm run lint`
  - `npm run test`
- Git:
  - `git add .`
  - `git commit -m "sprint-1: foundation setup"`
  - `git push origin main`

### Sprint 2: AI Chat + Lead Qualification

- Scope:
  - chat widget UI
  - `/api/chat`
  - AI assistant persona and qualification logic
  - appointment suggestion for hot leads
- Validation:
  - `npm run lint`
  - `npm run test`
  - manual chat flow test in browser
- Git:
  - `git add .`
  - `git commit -m "sprint-2: chat + qualification engine"`
  - `git push origin main`

### Sprint 3: CRM Dashboard

- Scope:
  - lead list UI
  - conversation viewer
  - settings page
  - analytics card
- Validation:
  - `npm run lint`
  - `npm run test`
  - manual dashboard verification
- Git:
  - `git add .`
  - `git commit -m "sprint-3: crm dashboard and analytics"`
  - `git push origin main`

### Sprint 4: Auto Follow-Up + Production Hardening

- Scope:
  - `/api/follow-up/run`
  - deployment checks
  - README finalization
- Validation:
  - `npm run build`
  - `npm run lint`
  - `npm run test`
- Git:
  - `git add .`
  - `git commit -m "sprint-4: follow-up automation and production prep"`
  - `git push origin main`
