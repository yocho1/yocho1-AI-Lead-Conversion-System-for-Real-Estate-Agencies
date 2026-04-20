alter table public.leads add column if not exists preferred_channel text;
alter table public.leads add column if not exists last_channel_used text;
alter table public.leads add column if not exists delivery_status text not null default 'pending';

alter table public.leads drop constraint if exists leads_preferred_channel_check;
alter table public.leads add constraint leads_preferred_channel_check check (
  preferred_channel in ('whatsapp', 'sms', 'email') or preferred_channel is null
);

alter table public.leads drop constraint if exists leads_last_channel_used_check;
alter table public.leads add constraint leads_last_channel_used_check check (
  last_channel_used in ('whatsapp', 'sms', 'email') or last_channel_used is null
);

alter table public.leads drop constraint if exists leads_delivery_status_check;
alter table public.leads add constraint leads_delivery_status_check check (
  delivery_status in ('pending', 'sent', 'failed')
);

create index if not exists idx_leads_delivery_status on public.leads(delivery_status);
create index if not exists idx_leads_last_channel_used on public.leads(last_channel_used);
