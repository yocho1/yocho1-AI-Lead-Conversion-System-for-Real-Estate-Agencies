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

create index if not exists idx_daily_stats_agency_date on public.daily_stats(agency_id, stat_date desc);
