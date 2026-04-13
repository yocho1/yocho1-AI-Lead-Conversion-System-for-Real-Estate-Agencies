create extension if not exists "pgcrypto";

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  api_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text,
  email text,
  phone text,
  budget text,
  location text,
  property_type text,
  buying_timeline text,
  status text not null default 'cold' check (status in ('hot', 'warm', 'cold')),
  preferred_visit_day text,
  preferred_visit_period text,
  appointment_status text not null default 'not_set' check (appointment_status in ('not_set', 'pending', 'reserved')),
  hot_alert_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  timestamp timestamptz not null default now()
);

alter table public.leads add column if not exists preferred_visit_day text;
alter table public.leads add column if not exists preferred_visit_period text;
alter table public.leads add column if not exists appointment_status text not null default 'not_set';
alter table public.leads add column if not exists hot_alert_sent boolean not null default false;
alter table public.leads drop constraint if exists leads_appointment_status_check;
alter table public.leads add constraint leads_appointment_status_check check (appointment_status in ('not_set', 'pending', 'reserved'));

create index if not exists idx_leads_agency_id on public.leads(agency_id);
create index if not exists idx_messages_lead_id_timestamp on public.messages(lead_id, timestamp desc);
create unique index if not exists idx_unique_lead_email_per_agency on public.leads(agency_id, email) where email is not null;
create unique index if not exists idx_unique_lead_phone_per_agency on public.leads(agency_id, phone) where phone is not null;

insert into public.agencies (name, api_key)
values ('Demo Realty', 'demo-agency-key')
on conflict (api_key) do nothing;
