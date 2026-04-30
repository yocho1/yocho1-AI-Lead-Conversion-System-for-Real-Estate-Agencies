-- Sample data for validating /api/analytics/summary
-- Agency key: analytics-test-key
-- Window assumption: run summary with days>=7 to include these rows.

insert into public.agencies (id, name, api_key)
values ('11111111-1111-1111-1111-111111111111', 'Analytics Test Realty', 'analytics-test-key')
on conflict (api_key) do update set name = excluded.name;

delete from public.messages where lead_id in (
  '11111111-1111-1111-1111-000000000001',
  '11111111-1111-1111-1111-000000000002',
  '11111111-1111-1111-1111-000000000003',
  '11111111-1111-1111-1111-000000000004'
);

delete from public.events where agency_id = '11111111-1111-1111-1111-111111111111';
delete from public.leads where agency_id = '11111111-1111-1111-1111-111111111111';

insert into public.leads (
  id,
  agency_id,
  name,
  status,
  appointment_status,
  lead_state,
  created_at,
  last_message_at
) values
  (
    '11111111-1111-1111-1111-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'Lead One',
    'hot',
    'reserved',
    jsonb_build_object('status','booked','stage','booked'),
    now() - interval '3 day',
    now() - interval '3 day'
  ),
  (
    '11111111-1111-1111-1111-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'Lead Two',
    'warm',
    'pending',
    jsonb_build_object('status','warm','stage','closing'),
    now() - interval '2 day',
    now() - interval '2 day'
  ),
  (
    '11111111-1111-1111-1111-000000000003',
    '11111111-1111-1111-1111-111111111111',
    'Lead Three',
    'cold',
    'not_set',
    jsonb_build_object('status','cold','stage','collecting'),
    now() - interval '1 day',
    now() - interval '1 day'
  ),
  (
    '11111111-1111-1111-1111-000000000004',
    '11111111-1111-1111-1111-111111111111',
    'Lead Four',
    'hot',
    'not_set',
    jsonb_build_object('status','hot','stage','closing'),
    now() - interval '1 day',
    now() - interval '1 day'
  );

insert into public.messages (agency_id, lead_id, sender, role, content, timestamp) values
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-000000000001', 'user', 'user', 'Hi', now() - interval '3 day' + interval '10 minute'),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-000000000001', 'ai', 'assistant', 'Hello', now() - interval '3 day' + interval '12 minute'),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-000000000002', 'user', 'user', 'Need a villa', now() - interval '2 day' + interval '20 minute'),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-000000000002', 'agent', 'assistant', 'We can help', now() - interval '2 day' + interval '23 minute'),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-000000000003', 'user', 'user', 'Budget is 100k', now() - interval '1 day' + interval '8 minute'),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-000000000003', 'ai', 'assistant', 'Thanks', now() - interval '1 day' + interval '10 minute');

insert into public.events (event_id, agency_id, lead_id, event_type, status, attempts, max_attempts, payload, created_at, updated_at) values
  (gen_random_uuid()::text, '11111111-1111-1111-1111-111111111111', null, 'visitor_page_view', 'success', 0, 6, '{}'::jsonb, now() - interval '3 day', now() - interval '3 day'),
  (gen_random_uuid()::text, '11111111-1111-1111-1111-111111111111', null, 'visitor_page_view', 'success', 0, 6, '{}'::jsonb, now() - interval '2 day', now() - interval '2 day'),
  (gen_random_uuid()::text, '11111111-1111-1111-1111-111111111111', null, 'visitor_page_view', 'success', 0, 6, '{}'::jsonb, now() - interval '1 day', now() - interval '1 day'),
  (gen_random_uuid()::text, '11111111-1111-1111-1111-111111111111', null, 'visitor_page_view', 'success', 0, 6, '{}'::jsonb, now() - interval '1 day' + interval '2 minute', now() - interval '1 day' + interval '2 minute');

-- Expected aggregate across these seeded leads:
-- visitors = 4
-- leads = 4
-- qualified = 3
-- booked = 1
-- conversion_rate = 25.00
-- avg_response_time_seconds = 140.00
