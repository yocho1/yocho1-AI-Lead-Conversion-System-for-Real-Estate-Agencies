create extension if not exists "pgcrypto";

do $$
begin
  if to_regtype('public.deal_stage') is null then
    create type public.deal_stage as enum (
      'NEW_LEAD',
      'QUALIFIED',
      'VISIT_SCHEDULED',
      'NEGOTIATION',
      'OFFER_MADE',
      'CLOSED',
      'LOST'
    );
  end if;
end
$$;

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  stage public.deal_stage not null default 'NEW_LEAD',
  deal_value numeric(15,2),
  commission_rate numeric(5,2),
  assigned_agent_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deal_events (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  from_stage public.deal_stage not null,
  to_stage public.deal_stage not null,
  changed_at timestamptz not null default now(),
  changed_by text
);

alter table public.leads add column if not exists deal_id uuid references public.deals(id) on delete set null;

create index if not exists idx_deals_agency_id on public.deals(agency_id);
create index if not exists idx_deals_stage on public.deals(stage);
create index if not exists idx_deals_agency_stage on public.deals(agency_id, stage);
create index if not exists idx_deals_assigned_agent on public.deals(assigned_agent_id);
create index if not exists idx_deal_events_deal_id on public.deal_events(deal_id);
create index if not exists idx_leads_deal_id on public.leads(deal_id);

alter table public.deals enable row level security;
alter table public.deal_events enable row level security;

drop policy if exists deals_agency_isolation on public.deals;
create policy deals_agency_isolation
on public.deals
for all
to authenticated
using (agency_id = public.current_agency_id())
with check (agency_id = public.current_agency_id());

drop policy if exists deal_events_agency_isolation on public.deal_events;
create policy deal_events_agency_isolation
on public.deal_events
for all
to authenticated
using (
  (select agency_id from public.deals where id = deal_id) = public.current_agency_id()
)
with check (
  (select agency_id from public.deals where id = deal_id) = public.current_agency_id()
);

insert into public.agencies (name, api_key)
values ('Demo Realty', 'demo-agency-key')
on conflict (api_key) do nothing;