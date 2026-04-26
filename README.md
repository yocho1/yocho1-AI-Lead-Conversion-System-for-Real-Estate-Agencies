# AI Lead Conversion System for Real Estate Agencies

A production-oriented, multi-tenant lead conversion platform for real estate teams.

It combines:

- a Next.js SaaS frontend
- tenant-scoped API routes
- Supabase persistence and analytics
- AI-powered qualification and follow-up flows
- an optional event-driven FastAPI + Redis worker backend for asynchronous delivery

## Executive Summary

This repository implements a full lead lifecycle:

1. Capture inbound conversations and normalize lead context.
2. Qualify leads into actionable statuses.
3. Auto-create and maintain deal pipeline records.
4. Drive sales workflows from a multi-page dashboard.
5. Trigger automated follow-up and channel delivery actions.

The system is designed for agency isolation, operational visibility, and incremental hardening from MVP to production.

## Core Capabilities

- Multi-page SaaS workspace with grouped sidebar navigation
- Tenant isolation by agency API key
- Lead ingestion, deduplication, and message history tracking
- Deal pipeline with stage transitions and summary metrics
- Automatic deal seeding for existing leads
- Analytics endpoints for funnel and trend reporting
- Booking and automation endpoints
- Optional asynchronous event delivery stack (FastAPI + Redis worker)

## Tech Stack

- Frontend and API: Next.js 16 (App Router), React 19, TypeScript, Tailwind 4
- Validation: Zod
- Database: Supabase (PostgreSQL)
- AI layer: OpenRouter-compatible model integration
- Optional async backend: FastAPI, Redis, Python worker
- Testing: Vitest (frontend), Pytest (backend)

## Architecture at a Glance

### Frontend + API Layer (Next.js)

- App Router with route grouping under the workspace layout
- Shared layout and sidebar for CRM-style navigation
- API routes for chat, leads, deals, analytics, automations, bookings, and health

### Data Layer (Supabase)

- Tenant-scoped data model
- Lead and message storage
- Deal pipeline and transitions
- Analytics aggregates and reporting tables

### Optional Event-Driven Layer (FastAPI + Redis)

- FastAPI receives event requests and persists intent
- Redis queue decouples ingestion from delivery
- Worker handles retries, channel routing, and dead-lettering

## Current Route Topology

The workspace routes are organized under a single shared application shell:

- Dashboard
- Analytics
- Leads
- Deals
- Properties
- Bookings
- Inbox
- Campaigns
- Automation
- Settings

## Local Setup

### 1) Install Dependencies

```bash
npm install
```

### 2) Configure Environment

Copy and fill environment values:

```bash
cp .env.example .env.local
```

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

### 3) Run Web App

```bash
npm run dev
```

### 4) Useful Local URLs

- App home: http://localhost:3000/?agencyKey=demo-agency-key
- Demo mode: http://localhost:3000/?agencyKey=demo-agency-key&demo=true
- Dashboard: http://localhost:3000/dashboard?agencyKey=demo-agency-key

## Supabase Bootstrap

1. Create a Supabase project.
2. Run SQL migrations from the migrations folder in chronological order.
3. Populate required demo and tenant records.
4. Validate connectivity through the health endpoint.

## API Surface (High-Level)

### Lead and Chat

- POST /api/chat
- GET /api/leads
- GET /api/leads/[leadId]/messages

### Deals and Pipeline

- GET /api/deals
- PATCH /api/deals/[id]
- GET /api/deals/pipeline
- GET /api/deals/summary

### Analytics

- GET /api/analytics/leads-per-day
- GET /api/analytics/sources
- GET /api/analytics/summary

### Operations

- POST /api/follow-up/run
- GET /api/health/supabase
- Agency and key-management endpoints under /api/agencies and /api/agency

## Deal Pipeline Behaviors

The current pipeline implementation includes the following operational guarantees:

- Missing deal rows for existing leads are auto-created on pipeline and summary reads.
- Newly seeded or discovered leads enter NEW_LEAD as the initial stage.
- Stage updates are idempotent for repeated drag-drop requests.
- Stage transition validation runs server-side.

## Testing and Quality Gates

### Frontend / TypeScript

```bash
npm run lint
npm run test
npm run build
```

### Backend (optional Python service)

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
pytest backend/tests
```

On Windows PowerShell, activate with:

```powershell
.venv\Scripts\Activate.ps1
```

## Optional FastAPI + Worker Runtime

Run API service:

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

## Deployment Notes

- Primary deployment target is Vercel for the Next.js application.
- Ensure all server-only secrets are configured as protected environment variables.
- Follow-up endpoint can be scheduled via cron.
- Keep tenant API keys scoped and rotated on a regular policy.

## Security and Operations Guidance

- Never commit real API keys or tenant secrets.
- Rotate any credential immediately if exposed in logs, screenshots, or config files.
- Keep service-role keys server-side only.
- Restrict admin key usage to internal operations.

## Suggested Contribution Workflow

1. Create a feature branch from main.
2. Implement small, testable increments.
3. Run lint, tests, and build locally before commit.
4. Open PR with verification notes and migration impact.

## Status

The multi-page SaaS refactor, deal pipeline hardening, and production build validation are complete on the active feature branch.
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
