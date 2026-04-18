alter table public.event_outbox add column if not exists event_id text;
alter table public.event_outbox add column if not exists agency_id text;
alter table public.event_outbox add column if not exists lead_id uuid;
alter table public.event_outbox add column if not exists max_attempts int not null default 3;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  agency_id text not null,
  lead_id uuid,
  event_type text not null,
  status text not null check (status in ('queued', 'processing', 'success', 'failed', 'retrying', 'dead_letter')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  payload jsonb not null,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dead_letter_queue (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  agency_id text not null,
  lead_id uuid,
  event_type text not null,
  payload jsonb not null,
  attempts int not null,
  error_message text,
  moved_at timestamptz not null default now()
);

alter table public.event_logs add column if not exists event_id text;

create unique index if not exists idx_events_event_id on public.events(event_id);
create unique index if not exists idx_events_agency_lead_type on public.events(agency_id, lead_id, event_type) where lead_id is not null;
create unique index if not exists idx_dead_letter_event_id on public.dead_letter_queue(event_id);
create unique index if not exists idx_outbox_event_id on public.event_outbox(event_id) where event_id is not null;

create index if not exists idx_events_agency_status_created on public.events(agency_id, status, created_at);
create index if not exists idx_events_status_updated on public.events(status, updated_at);
create index if not exists idx_event_logs_event_created on public.event_logs(event_id, created_at);
