insert into public.properties (city, price, type, bedrooms) values
  ('casablanca', 900000, 'apartment', 2),
  ('casablanca', 1000000, 'apartment', 3),
  ('casablanca', 1080000, 'apartment', 3),
  ('rabat', 950000, 'apartment', 2),
  ('casablanca', 1200000, 'villa', 4)
on conflict do nothing;
