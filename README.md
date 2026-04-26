# AI Lead Conversion System for Real Estate Agencies

Enterprise-ready, multi-tenant lead conversion platform designed for modern real estate operations.

This project combines a SaaS frontend, tenant-scoped APIs, Supabase data services, and optional async worker infrastructure to turn inbound chats into qualified leads, structured deals, and measurable pipeline outcomes.

## What This Platform Delivers

- AI-guided lead capture and qualification
- robust deal pipeline management
- role-ready analytics and conversion visibility
- automated follow-up workflows
- strict tenant isolation by agency API key
- optional event-driven backend for high-throughput delivery channels

## Product Context

Most agencies leak value between first touch and appointment booking because lead data, response logic, and pipeline hygiene live in disconnected tools.

This system centralizes the full lead lifecycle from inbound message to sales action, with operational guarantees at the API and data layers.

## Core Features

- Multi-page CRM workspace with sidebar navigation
- Lead creation, deduplication, and message history
- Deal pipeline with server-validated transitions
- Idempotent stage updates to handle duplicate drag-drop actions
- Automatic deal seeding for existing leads
- Funnel and trend analytics endpoints
- Booking and automation modules
- Optional FastAPI + Redis async dispatch architecture

## Technology Stack

- Web and API: Next.js 16, React 19, TypeScript
- UI: Tailwind CSS 4, Lucide
- Validation: Zod
- Data: Supabase PostgreSQL
- AI: OpenRouter-compatible model integration
- Optional async runtime: FastAPI, Redis, Python worker
- Tests: Vitest and Pytest

## Architecture Overview

### 1. Web Workspace Layer

App Router with shared shell layout and route grouping under `src/app/(app)`:

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

### 2. Next.js API Layer

Domain APIs cover:

- chat and lead qualification
- lead/message retrieval
- deals, pipeline, and summaries
- analytics and booking flows
- agency management and health checks

### 3. Data and Tenancy Layer

Supabase stores tenant-scoped entities for:

- agencies and API keys
- leads and conversations
- deals and stage history
- analytics aggregates

### 4. Optional Async Delivery Layer

The `backend` service provides asynchronous event processing:

- FastAPI ingest and normalization
- Redis queue + outbox pattern
- retry-aware worker processor
- provider abstraction for WhatsApp/email/SMS/test routing

## Repository Layout

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

## Quick Start

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Create `.env.local` from `.env.example`.

Required baseline variables:

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

### 3) Start the application

```bash
npm run dev
```

### 4) Local URLs

- `http://localhost:3000/?agencyKey=demo-agency-key`
- `http://localhost:3000/?agencyKey=demo-agency-key&demo=true`
- `http://localhost:3000/dashboard?agencyKey=demo-agency-key`

## Database Bootstrap

1. Create a Supabase project.
2. Run SQL migrations from `supabase/migrations` in chronological order.
3. Ensure a demo tenant exists for local validation.
4. Validate service connectivity via health endpoints.

## High-Value API Surface

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
- agency lifecycle endpoints under `/api/agencies` and `/api/agency`

## Example Calls

### Send a chat message

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"agencyApiKey":"demo-agency-key","message":"I need a 3-bedroom apartment in Casablanca around 1.8M MAD"}'
```

### Read pipeline snapshot

```bash
curl "http://localhost:3000/api/deals/pipeline?agencyApiKey=demo-agency-key"
```

## Operational Guarantees

The deal pipeline implementation enforces the following:

- missing deal rows are auto-created when pipeline/summary is requested
- all newly seeded leads enter `NEW_LEAD`
- repeated stage updates are handled idempotently
- invalid stage transitions are rejected server-side

## Quality and Release Gates

Run before every push:

```bash
npm run lint
npm run test
npm run build
```

## Optional Python Backend Runtime

Install dependencies:

```bash
python -m venv .venv
pip install -r backend/requirements.txt
```

Activate on PowerShell:

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

Run demo queue:

```bash
python -m backend.worker.run_worker --demo
```

Replay outbox jobs:

```bash
python backend/scripts/dispatch_outbox.py
```

## Deployment Guidance

- Primary target: Vercel for web/API layer
- Keep secrets in deployment environment settings
- Schedule follow-up endpoint with cron if desired
- Validate migration state before release promotion

## Security Requirements

- never commit provider keys, tenant keys, or service-role secrets
- rotate any exposed key immediately
- keep `SUPABASE_SERVICE_ROLE_KEY` server-only
- scope `ADMIN_API_KEY` to trusted operators

## Team Workflow

1. Branch from `main`.
2. Keep commits atomic and reviewable.
3. Pass lint/tests/build locally.
4. Include migration and verification notes in the PR.

## Current Branch Status

The `feature/deal-pipeline` branch includes the multi-page SaaS refactor, hardened deal pipeline flows, and successful production build validation.
