# AI Lead Conversion System for Real Estate Agencies

AI-native revenue operations platform for real estate teams: convert inbound conversations into qualified leads, governed deal progression, and measurable conversion outcomes.

- Captures and qualifies leads through AI-assisted conversation flows.
- Keeps lead, deal, and pipeline state transactionally aligned.
- Enforces tenant-scoped data isolation across API and persistence layers.
- Supports deterministic follow-up, booking, and automation workflows.
- Extends to async event processing for high-throughput delivery channels.

Built for real estate agencies and enterprise SaaS operators that require both sales velocity and production-grade reliability.

This exists because most CRM stacks split chat, qualification, pipeline, and automation into disconnected tools, creating leakage between first touch and booked appointment.

## Product Overview

This repository implements a multi-tenant conversion system that unifies:

- conversational lead capture
- AI-driven qualification and routing
- deal lifecycle management
- analytics and operational reporting
- optional asynchronous event delivery

The result is an end-to-end pipeline where business workflows and technical consistency rules are enforced in the same system.

## System in One View

### End-to-end flow

A user message enters the web app, the AI layer classifies and enriches lead context, APIs persist tenant-scoped entities in Supabase, deal state is seeded or transitioned under validation rules, and optional async workers handle delivery-heavy or delayed actions with retry controls.

```text
[Buyer / Agent]
      |
      v
[Web Workspace (Next.js UI)]
      |
      v
[API Layer (Next.js Route Handlers)]
      |
      +--> [AI Qualification + Decision Logic]
      |
      +--> [Supabase: agencies, leads, messages, deals, analytics]
      |             |
      |             v
      |      [Deal Pipeline Rules + Summaries]
      |
      +--> [Optional Async Event API (FastAPI)]
                    |
                    v
               [Redis Queue]
                    |
                    v
             [Worker + Retry + DLQ]
```

## Real-World Lead Lifecycle

A typical production path:

1. Inbound conversation arrives via chat widget.
2. AI extracts intent and lead signals (budget, location, urgency/timeline, channel readiness).
3. Lead record is created or deduplicated under the tenant agency.
4. Conversation history is persisted for auditability and decision continuity.
5. Deal record is seeded automatically (when needed) in `NEW_LEAD`.
6. Sales actions or UI drag-drop move the deal through validated stage transitions.
7. If engagement stalls, follow-up automation is triggered through API or async workflows.
8. Booking flow confirms appointment slots and updates downstream state.
9. Analytics endpoints reflect funnel status and conversion performance.

## Key Capabilities

- Multi-page CRM workspace with sidebar-driven operations.
- Tenant-scoped lead ingestion, retrieval, and message history.
- Idempotent deal transition handling for duplicate client actions.
- Pipeline consistency via server-side transition validation.
- Auto-healing pipeline reads that seed missing deal rows.
- Domain APIs for analytics, booking, automation, and follow-up.
- Admin lifecycle APIs for agency onboarding and API key rotation.
- Optional async engine with queueing, retries, and dead-letter handling.

## Architecture

### Web layer

Responsibilities:

- Render operator-facing workspace (`/dashboard`, `/leads`, `/deals`, `/analytics`, etc.).
- Collect user input and trigger tenant-scoped API calls.
- Provide deterministic UX around pipeline operations.

Boundaries:

- No direct database access from client runtime.
- Business invariants enforced server-side in API handlers.

### API layer

Responsibilities:

- Validate payloads and query contracts.
- Resolve tenant context from agency keying.
- Execute lead, message, deal, booking, analytics, and automation workflows.

Boundaries:

- Route handlers own request validation and orchestration.
- Cross-domain side effects are explicit through service logic and event paths.

### Data layer

Responsibilities:

- Persist tenant-scoped entities in Supabase.
- Maintain integrity for leads, messages, deals, analytics data.
- Evolve schema through controlled migration history.

Data ownership:

- Agency is the tenancy boundary.
- Leads/messages/deals belong to agency scope.
- Pipeline and analytics states are derived from canonical tenant data.

### Async layer (optional)

Responsibilities:

- Decouple high-latency or high-volume outbound work.
- Execute queued events with retry and dead-letter semantics.
- Enforce per-tenant throughput controls.

Boundaries:

- Request-response APIs remain responsive.
- Delivery reliability concerns are isolated to worker and outbox subsystems.

## Design Principles

- Tenant-first isolation: every mutation and read is agency-scoped by design.
- Idempotent operations: repeated client intent should not produce divergent state.
- Event-driven extensibility: asynchronous side effects are decoupled from core request latency.
- Failure-first design: retries, dead-letter semantics, and explicit status modeling are built in.
- API boundary validation: payload, transition, and contract checks happen before persistence.

## Non-Functional Guarantees

- Idempotency guarantee: duplicate stage updates are treated as safe no-op equivalents where applicable.
- Pipeline consistency guarantee: missing deal rows for existing leads are auto-seeded on pipeline/summary reads.
- Transition integrity guarantee: invalid stage transitions are rejected server-side.
- Tenant isolation guarantee: agency-scoped access patterns prevent cross-tenant data bleed.
- Retry safety guarantee: async outbox retries are bounded and dead-lettered after threshold exhaustion.
- Data integrity guarantee: schema evolution is migration-driven, not ad hoc.

## Tech Stack

- Frontend and API: Next.js 16, React 19, TypeScript.
- UI: Tailwind CSS 4, Lucide icons.
- Validation: Zod.
- Database: Supabase PostgreSQL.
- AI integration: OpenRouter-compatible model interface.
- Optional async runtime: FastAPI, Redis, Python worker.
- Testing: Vitest (frontend/API), Pytest (backend).

## Data Model / Tenancy

### Tenancy model

- Agency is the core tenant primitive.
- API calls are scoped through agency API key resolution.
- Entity access is constrained to tenant context.

### Core entity families

- Tenant identity: `agencies`, API key lifecycle entities.
- Engagement: `leads`, `messages`.
- Revenue ops: `deals` and pipeline projections.
- Intelligence: analytics rollups and derived reporting entities.
- Reliability: outbox/event/log/dead-letter structures for async mode.

### Schema evolution

All persistent model evolution is managed under `supabase/migrations`.

## API Design

### Domain-oriented API map

#### Lead and conversation

- `POST /api/chat`
- `GET /api/leads`
- `GET /api/leads/[leadId]/messages`
- `POST /api/leads/[leadId]/messages`
- `DELETE /api/leads/[leadId]`

#### Deal pipeline

- `GET /api/deals`
- `POST /api/deals`
- `PATCH /api/deals/[id]`
- `DELETE /api/deals/[id]`
- `GET /api/deals/pipeline`
- `GET /api/deals/summary`

#### Analytics

- `GET /api/analytics/leads-per-day`
- `GET /api/analytics/sources`
- `GET /api/analytics/summary`

#### Booking and automation

- `GET /api/booking/available-slots`
- `POST /api/booking/book`
- `GET /api/automations`
- `POST /api/automations`

#### Tenant and operations

- `GET /api/agencies`
- `POST /api/agencies`
- `POST /api/agencies/[agencyId]/api-keys`
- `GET /api/agency/[agencyKey]`
- `POST /api/follow-up/run`
- `GET /api/health/supabase`

### Key flow examples

Send inbound conversation:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"agencyApiKey":"demo-agency-key","message":"Looking for a 3-bedroom apartment in Casablanca around 1.8M MAD"}'
```

Read current tenant pipeline:

```bash
curl "http://localhost:3000/api/deals/pipeline?agencyApiKey=demo-agency-key"
```

## Async System (Optional)

`backend/` adds asynchronous delivery for workload decoupling and reliability.

Core components:

- FastAPI ingress (`backend/app/main.py`)
- queueing (`backend/app/queue.py`)
- worker processor (`backend/worker/processor.py`)
- retry manager (`backend/worker/retry_manager.py`)
- outbox/event stores (`backend/app/outbox.py`, `backend/app/event_store.py`)

Reliability model:

- outbox-first dispatch
- controlled retry scheduling with backoff
- dead-letter promotion after retry exhaustion
- event status transitions (`processing`, `success`, `retrying`, `failed`, `dead_letter`)
- per-tenant rate limiting for outbound pressure control

## What Makes This Different

Compared to traditional CRMs:

- This is AI-native at ingestion and qualification, not form-first and manual-first.
- Pipeline correctness is enforced with server rules and idempotency, not only UI behavior.

Compared to chatbot systems:

- Conversations are tied to tenant-scoped lead/deal state transitions.
- Output is operational actionability, not just conversational response quality.

Compared to automation tools:

- Workflows run on transactional domain state, not loosely coupled trigger chains.
- Async processing includes reliability guarantees (retry, dead-letter, rate limit), not just fire-and-forget execution.

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
  tests/

supabase/
  migrations/

tests/
```

## Getting Started

### Prerequisites

- Node.js 20+.
- Supabase project and credentials.
- Python 3.11+ and Redis (only for optional async backend).

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

Optional async variables:

```bash
REDIS_URL=redis://localhost:6379/0
WHATSAPP_API_URL=https://example-whatsapp-provider/send
WHATSAPP_API_KEY=
EMAIL_API_URL=
EMAIL_API_KEY=
SMS_API_URL=
SMS_API_KEY=
TENANT_PROVIDER_OVERRIDES=
MAX_NOTIFICATIONS_PER_SECOND=5
DEFAULT_CURRENCY=USD
```

### 3) Apply migrations

Apply all SQL migrations under `supabase/migrations` in chronological order.

### 4) Run the app

```bash
npm run dev
```

Local URLs:

- `http://localhost:3000/?agencyKey=demo-agency-key`
- `http://localhost:3000/?agencyKey=demo-agency-key&demo=true`
- `http://localhost:3000/dashboard?agencyKey=demo-agency-key`

### 5) Run quality gates

```bash
npm run lint
npm run test
npm run build
```

## Deployment

Primary deployment path:

- Web/API layer on Vercel.
- Supabase managed Postgres for persistence.
- Optional async stack as containerized FastAPI + worker + managed Redis.

Release checklist:

- set all required environment variables
- ensure migration level is current
- run health checks and smoke tests
- configure scheduled follow-up execution if needed

## Scaling Strategy

- Scale web/API horizontally via serverless or containerized Next.js.
- Scale workers independently from interactive web traffic.
- Partition queueing strategy by tenant tier/region as volume grows.
- Add read-optimized analytics materialization for executive workloads.
- Introduce event replay and deeper audit trails for enterprise operations.

## Security

- Never commit secrets, tenant keys, or service-role credentials.
- Rotate exposed credentials immediately.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Restrict `ADMIN_API_KEY` to trusted operational workflows.
- Apply least-privilege access to external providers and runtime environments.

## Development Workflow

1. Branch from `main`.
2. Keep commits atomic and reviewable.
3. Pass lint, tests, and build before pushing.
4. Include migration notes and verification evidence in PRs.
5. Validate tenant isolation assumptions for all data-layer changes.

## Current Status

`feature/deal-pipeline` includes:

- multi-page SaaS workspace refactor
- hardened deal pipeline behavior (auto-seeding and idempotent transitions)
- production build validation
- enterprise-grade documentation baseline
