create extension if not exists "pgcrypto";

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  api_key text not null unique,
  primary_color text,
  logo_url text,
  created_at timestamptz not null default now()
);

alter table public.agencies add column if not exists primary_color text;
alter table public.agencies add column if not exists logo_url text;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text,
  email text,
  phone text,
  budget text,
  budget_value bigint,
  currency text,
  location text,
  location_city text,
  location_country text,
  property_type text,
  buying_timeline text,
  timeline_normalized text,
  status text not null default 'cold' check (status in ('hot', 'warm', 'cold')),
  preferred_visit_day text,
  preferred_visit_period text,
  appointment_status text not null default 'not_set' check (appointment_status in ('not_set', 'pending', 'reserved')),
  hot_alert_sent boolean not null default false,
  lead_state jsonb not null default jsonb_build_object(
    'id', null,
    'name', null,
    'email', null,
    'phone', null,
    'contact', null,
    'budget', null,
    'currency', null,
    'location', jsonb_build_object(
      'raw', null,
      'city', null,
      'country', null
    ),
    'property_type', null,
    'timeline', null,
    'timeline_normalized', null,
    'status', 'new',
    'stage', 'collecting',
    'last_question', null,
    'created_at', now()
  ),
  chat_locked boolean not null default false,
  last_message_at timestamptz not null default now(),
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
alter table public.leads add column if not exists budget_value bigint;
alter table public.leads add column if not exists currency text;
alter table public.leads add column if not exists location_city text;
alter table public.leads add column if not exists location_country text;
alter table public.leads add column if not exists timeline_normalized text;
alter table public.leads add column if not exists lead_state jsonb not null default jsonb_build_object(
  'id', null,
  'name', null,
  'email', null,
  'phone', null,
  'contact', null,
  'budget', null,
  'currency', null,
  'location', jsonb_build_object(
    'raw', null,
    'city', null,
    'country', null
  ),
  'property_type', null,
  'timeline', null,
  'timeline_normalized', null,
  'status', 'new',
  'stage', 'collecting',
  'last_question', null,
  'created_at', now()
);
alter table public.leads add column if not exists chat_locked boolean not null default false;
alter table public.leads add column if not exists last_message_at timestamptz not null default now();
alter table public.leads drop constraint if exists leads_appointment_status_check;
alter table public.leads add constraint leads_appointment_status_check check (appointment_status in ('not_set', 'pending', 'reserved'));

create index if not exists idx_leads_agency_id on public.leads(agency_id);
create index if not exists idx_leads_last_message_at on public.leads(last_message_at desc);
create index if not exists idx_messages_lead_id_timestamp on public.messages(lead_id, timestamp desc);
create unique index if not exists idx_unique_lead_email_per_agency on public.leads(agency_id, email) where email is not null;
create unique index if not exists idx_unique_lead_phone_per_agency on public.leads(agency_id, phone) where phone is not null;

insert into public.agencies (name, api_key)
values ('Demo Realty', 'demo-agency-key')
on conflict (api_key) do nothing;
