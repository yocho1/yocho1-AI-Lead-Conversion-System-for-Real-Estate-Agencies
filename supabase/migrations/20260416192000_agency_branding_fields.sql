alter table public.agencies add column if not exists primary_color text;
alter table public.agencies add column if not exists logo_url text;

update public.agencies
set primary_color = coalesce(primary_color, '#0f766e')
where api_key = 'demo-agency-key';
