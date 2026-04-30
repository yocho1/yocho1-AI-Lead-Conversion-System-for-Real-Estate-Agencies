create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  price bigint not null,
  type text not null,
  bedrooms int not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_properties_city on public.properties(city);
create index if not exists idx_properties_city_price on public.properties(city, price);
create index if not exists idx_properties_type on public.properties(type);
