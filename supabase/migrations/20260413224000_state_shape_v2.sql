alter table public.leads add column if not exists currency text;
alter table public.leads add column if not exists location_city text;
alter table public.leads add column if not exists location_country text;
alter table public.leads add column if not exists timeline_normalized text;

alter table public.leads alter column lead_state set default jsonb_build_object(
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

update public.leads
set location_city = coalesce(location_city, split_part(location, ',', 1)),
    location_country = coalesce(location_country, nullif(split_part(location, ',', 2), '')),
    currency = coalesce(currency, 'USD'),
    timeline_normalized = coalesce(
      timeline_normalized,
      case
        when buying_timeline ilike '%asap%' or buying_timeline ilike '%today%' or buying_timeline ilike '%tomorrow%' then 'asap'
        when buying_timeline ilike '%this week%' then 'this_week'
        when buying_timeline ilike '%next week%' then 'next_week'
        when buying_timeline ilike '%this month%' then 'this_month'
        when buying_timeline ilike '%next month%' then 'next_month'
        else null
      end
    );

update public.leads
set lead_state = jsonb_build_object(
  'name', coalesce(lead_state->>'name', name),
  'contact', coalesce(lead_state->>'contact', email, phone),
  'budget', coalesce((lead_state->>'budget')::bigint, budget_value),
  'currency', coalesce(lead_state->>'currency', currency, 'USD'),
  'location', jsonb_build_object(
    'raw', coalesce(lead_state->'location'->>'raw', location),
    'city', coalesce(lead_state->'location'->>'city', location_city),
    'country', coalesce(lead_state->'location'->>'country', location_country)
  ),
  'property_type', coalesce(lead_state->>'property_type', property_type),
  'timeline', coalesce(lead_state->>'timeline', buying_timeline),
  'timeline_normalized', coalesce(lead_state->>'timeline_normalized', timeline_normalized),
  'status', coalesce(lead_state->>'status', status, 'new'),
  'stage', case when appointment_status = 'reserved' then 'booked' else coalesce(lead_state->>'stage', 'collecting') end,
  'created_at', coalesce(lead_state->>'created_at', created_at::text)
);
