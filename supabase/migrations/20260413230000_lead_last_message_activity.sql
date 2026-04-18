alter table public.leads add column if not exists last_message_at timestamptz not null default now();

update public.leads
set last_message_at = coalesce(last_message_at, created_at, now());

create index if not exists idx_leads_last_message_at on public.leads(last_message_at desc);
