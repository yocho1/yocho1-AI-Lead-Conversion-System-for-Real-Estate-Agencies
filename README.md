# AI Lead Conversion System for Real Estate Agencies

Production-ready MVP built with Next.js, Supabase, and OpenRouter to help real estate agencies capture, qualify, and convert leads.

## Features

- Floating chat widget (Intercom-style)
- AI real estate sales assistant persona
- Lead qualification (hot, warm, cold)
- Multi-tenant agency isolation by API key
- CRM dashboard with:
  - lead list
  - qualification status
  - conversation history
  - leads per day analytics
- Appointment suggestion for hot leads (Google Calendar link)
- Auto follow-up endpoint for inactive leads
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
		chat-widget.tsx
		dashboard-shell.tsx
		leads-board.tsx
	lib/
		ai.ts
		calendar.ts
		env.ts
		lead-parser.ts
		qualification.ts
		supabase.ts
		types.ts
supabase/
	schema.sql
tests/
	qualification.test.ts
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4o-mini
APP_URL=http://localhost:3000
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
  - Sends follow-up to leads inactive for `FOLLOW_UP_DELAY_MINUTES`
  - Intended for cron job usage

- `GET /api/analytics/leads-per-day?agencyApiKey=...`
  - Returns simple daily lead counts

- `GET /api/health/supabase`
  - Verifies server can reach Supabase and query `agencies`

## Multi-Tenant Model

- Each agency has its own `api_key`.
- Every API call is scoped by `agencyApiKey`.
- Leads and messages are fetched only for the matched agency.

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
