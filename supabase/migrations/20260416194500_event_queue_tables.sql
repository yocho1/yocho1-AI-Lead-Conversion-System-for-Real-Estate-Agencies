create table if not exists public.event_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'dispatched', 'failed')),
  retry_count int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.event_logs (
  id uuid primary key default gen_random_uuid(),
  agency_id text not null,
  lead_id uuid,
  event_type text not null,
  status text not null,
  message text,
  attempt int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.leads add column if not exists whatsapp_sent boolean not null default false;

create index if not exists idx_event_outbox_status_created_at on public.event_outbox(status, created_at);
create index if not exists idx_event_logs_agency_created_at on public.event_logs(agency_id, created_at desc);
