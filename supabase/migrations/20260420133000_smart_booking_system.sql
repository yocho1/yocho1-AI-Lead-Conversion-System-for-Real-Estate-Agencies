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

create index if not exists idx_agent_availability_agent_weekday on public.agent_availability(agent_id, weekday);
create index if not exists idx_bookings_agent_datetime on public.bookings(agent_id, datetime);
create unique index if not exists idx_bookings_unique_active_slot on public.bookings(agent_id, datetime)
where status in ('pending', 'confirmed');
