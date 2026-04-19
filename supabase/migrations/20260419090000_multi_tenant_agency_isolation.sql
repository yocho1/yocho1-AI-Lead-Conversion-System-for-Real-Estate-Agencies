alter table public.leads add column if not exists agency_id uuid references public.agencies(id) on delete cascade;

alter table public.messages add column if not exists agency_id uuid references public.agencies(id) on delete cascade;
update public.messages m
set agency_id = l.agency_id
from public.leads l
where m.lead_id = l.id
  and m.agency_id is null;

create index if not exists idx_messages_agency_lead_timestamp
  on public.messages(agency_id, lead_id, timestamp desc);

-- Normalize events.agency_id to uuid when the existing column is text.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = 'agency_id'
      and data_type <> 'uuid'
  ) then
    alter table public.events add column if not exists agency_id_uuid uuid;

    update public.events e
    set agency_id_uuid = a.id
    from public.agencies a
    where e.agency_id_uuid is null
      and (e.agency_id = a.id::text or e.agency_id = a.api_key);

    alter table public.events drop column agency_id;
    alter table public.events rename column agency_id_uuid to agency_id;
  end if;
end $$;

alter table public.events alter column agency_id type uuid using agency_id::uuid;
alter table public.events add constraint events_agency_id_fkey foreign key (agency_id) references public.agencies(id) on delete cascade;
create index if not exists idx_events_agency_created_at on public.events(agency_id, created_at desc);
