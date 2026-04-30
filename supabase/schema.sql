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
  source text,
  campaign_id text,
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
  preferred_channel text,
  last_channel_used text,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed')),
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
  lead_score int,
  lead_category text check (lead_category in ('HOT', 'WARM', 'COLD')),
  next_action text check (next_action in ('send_whatsapp', 'schedule_followup', 'none')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  sender text not null default 'user' check (sender in ('user', 'ai', 'agent')),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  timestamp timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  price bigint not null,
  type text not null,
  bedrooms int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_availability (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes int not null default 30,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  agent_id text not null,
  datetime timestamptz not null,
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_stats (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  stat_date date not null,
  visitors int not null default 0,
  leads int not null default 0,
  qualified int not null default 0,
  booked int not null default 0,
  conversion_rate numeric(6,2) not null default 0,
  avg_response_time_seconds numeric(10,2) not null default 0,
  leads_per_day numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (agency_id, stat_date)
);

create table if not exists public.event_outbox (
  id uuid primary key default gen_random_uuid(),
  event_id text,
  agency_id text,
  lead_id uuid,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  retry_count int not null default 0,
  max_attempts int not null default 6,
  next_retry_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

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

create table if not exists public.event_logs (
  id uuid primary key default gen_random_uuid(),
  agency_id text not null,
  lead_id uuid,
  event_type text not null,
  status text not null,
  message text,
  attempt int not null default 0,
  event_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid,
  event_type text not null,
  status text not null check (status in ('queued', 'processing', 'success', 'failed', 'retrying', 'dead_letter')),
  attempts int not null default 0,
  max_attempts int not null default 6,
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

alter table public.leads add column if not exists preferred_visit_day text;
alter table public.leads add column if not exists preferred_visit_period text;
alter table public.leads add column if not exists appointment_status text not null default 'not_set';
alter table public.leads add column if not exists hot_alert_sent boolean not null default false;
alter table public.leads add column if not exists budget_value bigint;
alter table public.leads add column if not exists source text;
alter table public.leads add column if not exists campaign_id text;
alter table public.leads add column if not exists currency text;
alter table public.leads add column if not exists location_city text;
alter table public.leads add column if not exists location_country text;
alter table public.leads add column if not exists timeline_normalized text;
alter table public.leads add column if not exists preferred_channel text;
alter table public.leads add column if not exists last_channel_used text;
alter table public.leads add column if not exists delivery_status text not null default 'pending';
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
alter table public.leads add column if not exists lead_score int;
alter table public.leads add column if not exists lead_category text;
alter table public.leads add column if not exists next_action text;
alter table public.leads add column if not exists last_message_at timestamptz not null default now();
alter table public.leads drop constraint if exists leads_appointment_status_check;
alter table public.leads add constraint leads_appointment_status_check check (appointment_status in ('not_set', 'pending', 'reserved'));
alter table public.leads drop constraint if exists leads_lead_category_check;
alter table public.leads add constraint leads_lead_category_check check (lead_category in ('HOT', 'WARM', 'COLD') or lead_category is null);
alter table public.leads drop constraint if exists leads_next_action_check;
alter table public.leads add constraint leads_next_action_check check (next_action in ('send_whatsapp', 'schedule_followup', 'none') or next_action is null);
alter table public.leads drop constraint if exists leads_preferred_channel_check;
alter table public.leads add constraint leads_preferred_channel_check check (preferred_channel in ('whatsapp', 'sms', 'email') or preferred_channel is null);
alter table public.leads drop constraint if exists leads_last_channel_used_check;
alter table public.leads add constraint leads_last_channel_used_check check (last_channel_used in ('whatsapp', 'sms', 'email') or last_channel_used is null);
alter table public.leads drop constraint if exists leads_delivery_status_check;
alter table public.leads add constraint leads_delivery_status_check check (delivery_status in ('pending', 'sent', 'failed'));
alter table public.event_outbox add column if not exists event_id text;
alter table public.event_outbox add column if not exists agency_id text;
alter table public.event_outbox add column if not exists lead_id uuid;
alter table public.event_outbox add column if not exists max_attempts int not null default 6;
alter table public.event_outbox add column if not exists next_retry_at timestamptz;
alter table public.event_outbox alter column next_retry_at set default now();
alter table public.event_outbox drop constraint if exists event_outbox_status_check;
alter table public.event_outbox add constraint event_outbox_status_check check (status in ('pending', 'success', 'failed'));

create index if not exists idx_leads_agency_id on public.leads(agency_id);
create index if not exists idx_leads_source on public.leads(source);
create index if not exists idx_leads_campaign_id on public.leads(campaign_id);
create index if not exists idx_leads_last_message_at on public.leads(last_message_at desc);
create index if not exists idx_leads_lead_score on public.leads(lead_score desc);
create index if not exists idx_leads_lead_category on public.leads(lead_category);
create index if not exists idx_leads_delivery_status on public.leads(delivery_status);
create index if not exists idx_leads_last_channel_used on public.leads(last_channel_used);
create index if not exists idx_messages_lead_id_timestamp on public.messages(lead_id, timestamp desc);
create index if not exists idx_messages_agency_lead_timestamp on public.messages(agency_id, lead_id, timestamp desc);
create index if not exists idx_messages_sender on public.messages(sender);
create index if not exists idx_properties_city on public.properties(city);
create index if not exists idx_properties_city_price on public.properties(city, price);
create index if not exists idx_properties_type on public.properties(type);
create index if not exists idx_agent_availability_agent_weekday on public.agent_availability(agent_id, weekday);
create index if not exists idx_bookings_agent_datetime on public.bookings(agent_id, datetime);
create unique index if not exists idx_bookings_unique_active_slot on public.bookings(agent_id, datetime)
where status in ('pending', 'confirmed');
create index if not exists idx_daily_stats_agency_date on public.daily_stats(agency_id, stat_date desc);
create index if not exists idx_event_outbox_pending_retry on public.event_outbox(status, next_retry_at);
create index if not exists idx_event_logs_agency_created_at on public.event_logs(agency_id, created_at desc);
create index if not exists idx_events_agency_created_at on public.events(agency_id, created_at desc);
create unique index if not exists idx_events_event_id on public.events(event_id);
create unique index if not exists idx_outbox_event_id on public.event_outbox(event_id) where event_id is not null;
create unique index if not exists idx_dead_letter_event_id on public.dead_letter_queue(event_id);
create unique index if not exists idx_event_outbox_failed_event_id on public.event_outbox_failed(event_id) where event_id is not null;
create unique index if not exists idx_unique_lead_email_per_agency on public.leads(agency_id, email) where email is not null;
create unique index if not exists idx_unique_lead_phone_per_agency on public.leads(agency_id, phone) where phone is not null;

create or replace function public.current_agency_id()
returns uuid
language plpgsql
stable
as $$
declare
  claim text;
begin
  claim := nullif(auth.jwt() ->> 'agency_id', '');
  if claim is null then
    return null;
  end if;

  begin
    return claim::uuid;
  exception when others then
    return null;
  end;
end;
$$;

alter table public.leads enable row level security;
alter table public.messages enable row level security;
alter table public.events enable row level security;

drop policy if exists leads_agency_isolation on public.leads;
create policy leads_agency_isolation
on public.leads
for all
to authenticated
using (agency_id = public.current_agency_id())
with check (agency_id = public.current_agency_id());

drop policy if exists messages_agency_isolation on public.messages;
create policy messages_agency_isolation
on public.messages
for all
to authenticated
using (agency_id = public.current_agency_id())
with check (agency_id = public.current_agency_id());

drop policy if exists events_agency_isolation on public.events;
create policy events_agency_isolation
on public.events
for all
to authenticated
using (agency_id = public.current_agency_id())
with check (agency_id = public.current_agency_id());

insert into public.agencies (name, api_key)
values ('Demo Realty', 'demo-agency-key')
on conflict (api_key) do nothing;
