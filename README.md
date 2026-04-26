# AI Lead Conversion System for Real Estate Agencies

Production-grade, multi-tenant conversion platform for real estate teams.

This repository provides a complete lead-to-deal operating system:

- conversational lead capture
- AI-assisted qualification
- deal pipeline orchestration
- analytics and conversion visibility
- optional async event delivery backend

## Why This Exists

Real estate agencies typically lose revenue between first contact and appointment confirmation because lead qualification, follow-up, and pipeline hygiene are fragmented.

This platform centralizes those workflows into one SaaS-style workspace with tenant isolation and API-first operations.

## Product Capabilities

- Multi-page CRM workspace with sidebar navigation
- Lead ingestion and deduplication by tenant
- Conversation history and qualification tracking
- Deal pipeline with server-side stage validation
- Idempotent drag-drop updates for robust UX behavior
- Auto-seeding of missing deals from existing leads
- Funnel and trend analytics endpoints
- Booking and automation surfaces
- Optional FastAPI + Redis worker for asynchronous channel delivery

## Technical Stack

- Frontend/API: Next.js 16, React 19, TypeScript
- UI: Tailwind CSS 4, Lucide icons
- Validation: Zod
- Data: Supabase PostgreSQL
- AI integration: OpenRouter-compatible provider flow
- Optional backend runtime: FastAPI, Redis, Python worker
- Tests: Vitest, Pytest

## Architecture

### Web Application Layer

The app is built with App Router and a shared workspace layout in `src/app/(app)`.

Core pages:

- `/dashboard`
- `/analytics`
- `/leads`
- `/deals`
- `/properties`
- `/bookings`
- `/inbox`
- `/campaigns`
- `/automation`
- `/settings`

### API Layer (Next.js)

Primary domains under `src/app/api`:

- lead and messaging flows
- deal pipeline and summary
- analytics reporting
- booking and automation endpoints
- agency lifecycle and health checks

### Data Layer (Supabase)

Multi-tenant design with agency-scoped operations:

- agency identity by API key
- lead and message persistence
- deal lifecycle tracking
- analytics aggregation and reporting tables

### Optional Event-Driven Layer

`backend/` contains a FastAPI service and worker stack for async delivery and retries:

- API intake and normalization
- Redis queue and outbox flow
- worker processing and retry management
- provider abstraction (WhatsApp/email/SMS/test)

## Repository Structure

```text
src/
  app/
    (app)/
    api/
  components/
  lib/

backend/
  app/
  worker/
  scripts/

supabase/
  migrations/

tests/
```

## Local Development

### 1. Install Node dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.local` from `.env.example` and fill required values.

Minimum variables:

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

### 3. Start the app

```bash
npm run dev
```

### 4. Useful URLs

- `http://localhost:3000/?agencyKey=demo-agency-key`
- `http://localhost:3000/?agencyKey=demo-agency-key&demo=true`
- `http://localhost:3000/dashboard?agencyKey=demo-agency-key`

## Database Setup

1. Create a Supabase project.
2. Apply SQL migrations in `supabase/migrations` (chronological order).
3. Ensure a valid demo tenant exists (for local demos).
4. Verify connectivity through health endpoints.

## Key API Endpoints

### Conversation and Leads

- `POST /api/chat`
- `GET /api/leads`
- `GET /api/leads/[leadId]/messages`

### Deals and Pipeline

- `GET /api/deals`
- `PATCH /api/deals/[id]`
- `GET /api/deals/pipeline`
- `GET /api/deals/summary`

### Analytics

- `GET /api/analytics/leads-per-day`
- `GET /api/analytics/sources`
- `GET /api/analytics/summary`

### Operations

- `POST /api/follow-up/run`
- `GET /api/health/supabase`
- agency management routes under `/api/agencies` and `/api/agency`

## Pipeline Guarantees

The deal layer is intentionally defensive:

- Missing deal rows are auto-created for existing leads.
- Initial stage defaults to `NEW_LEAD`.
- Duplicate stage updates are treated idempotently.
- Stage transition checks are enforced server-side.

## Quality Gates

Run before every PR:

```bash
npm run lint
npm run test
npm run build
```

## Optional Python Backend Runtime

Install backend dependencies:

```bash
python -m venv .venv
pip install -r backend/requirements.txt
```

Activate virtual environment on Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Run FastAPI service:

```bash
uvicorn backend.app.main:app --reload --port 8000
```

Run worker:

```bash
python -m backend.worker.run_worker
```

Run demo worker queue:

```bash
python -m backend.worker.run_worker --demo
```

Replay outbox:

```bash
python backend/scripts/dispatch_outbox.py
```

## Deployment

- Primary web deployment target: Vercel
- Configure all secrets as environment variables in your deployment platform
- Schedule follow-up automation through a cron trigger

## Security Notes

- Never commit provider keys or tenant secrets.
- Treat exposed API keys as compromised and rotate immediately.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Restrict `ADMIN_API_KEY` to internal operator workflows.

## Contribution Standard

1. Branch from `main`.
2. Keep commits focused and reversible.
3. Pass lint, tests, and build locally.
4. Include migration and verification notes in PRs.

## Current Status

The multi-page SaaS refactor and deal pipeline hardening are integrated on `feature/deal-pipeline`, including successful production build validation.
