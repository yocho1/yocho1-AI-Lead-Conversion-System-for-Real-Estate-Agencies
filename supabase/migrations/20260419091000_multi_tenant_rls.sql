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
