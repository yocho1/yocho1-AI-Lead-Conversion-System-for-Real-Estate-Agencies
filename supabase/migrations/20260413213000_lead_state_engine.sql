alter table public.leads add column if not exists budget_value bigint;
alter table public.leads add column if not exists currency text;
alter table public.leads add column if not exists location_city text;
alter table public.leads add column if not exists location_country text;
alter table public.leads add column if not exists timeline_normalized text;
alter table public.leads add column if not exists lead_state jsonb not null default jsonb_build_object(
  'name', null,
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
  'created_at', now()
);
alter table public.leads add column if not exists chat_locked boolean not null default false;

update public.leads
set lead_state = jsonb_build_object(
  'name', name,
  'contact', coalesce(email, phone),
  'budget', budget_value,
  'currency', currency,
  'location', jsonb_build_object(
    'raw', location,
    'city', location_city,
    'country', location_country
  ),
  'property_type', property_type,
  'timeline', buying_timeline,
  'timeline_normalized', timeline_normalized,
  'status', case when status in ('hot', 'warm', 'cold') then status else 'new' end,
  'stage', case when appointment_status = 'reserved' then 'booked' else 'collecting' end,
  'created_at', created_at
)
where lead_state is null
   or lead_state = '{}'::jsonb;

update public.leads
set budget_value = nullif(regexp_replace(coalesce(budget, ''), '[^0-9]', '', 'g'), '')::bigint
where budget_value is null and budget is not null;

update public.leads
set timeline_normalized = case
  when buying_timeline ilike '%asap%' or buying_timeline ilike '%today%' or buying_timeline ilike '%tomorrow%' then 'asap'
  when buying_timeline ilike '%this week%' then 'this_week'
  when buying_timeline ilike '%next week%' then 'next_week'
  when buying_timeline ilike '%this month%' then 'this_month'
  when buying_timeline ilike '%next month%' then 'next_month'
  else timeline_normalized
end
where timeline_normalized is null and buying_timeline is not null;

create index if not exists idx_leads_chat_locked on public.leads(chat_locked);
create index if not exists idx_leads_budget_value on public.leads(budget_value);
