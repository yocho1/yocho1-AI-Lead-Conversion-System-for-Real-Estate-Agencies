alter table public.event_outbox add column if not exists next_retry_at timestamptz;
alter table public.event_outbox alter column next_retry_at set default now();

alter table public.event_outbox drop constraint if exists event_outbox_status_check;
alter table public.event_outbox add constraint event_outbox_status_check check (status in ('pending', 'success', 'failed'));

update public.event_outbox
set status = 'success'
where status = 'dispatched';

update public.event_outbox
set next_retry_at = coalesce(next_retry_at, now())
where status = 'pending';

alter table public.event_outbox add column if not exists max_attempts int not null default 6;

create table if not exists public.event_outbox_failed (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid,
  event_id text,
  event_type text not null,
  payload jsonb not null,
  agency_id text,
  lead_id uuid,
  retry_count int not null,
  error_message text,
  failed_at timestamptz not null default now()
);

create index if not exists idx_event_outbox_pending_retry on public.event_outbox(status, next_retry_at);
create unique index if not exists idx_event_outbox_failed_event_id on public.event_outbox_failed(event_id) where event_id is not null;

alter table public.events alter column max_attempts set default 6;
