alter table public.leads add column if not exists lead_score int;
alter table public.leads add column if not exists lead_category text;
alter table public.leads add column if not exists next_action text;

alter table public.leads drop constraint if exists leads_lead_category_check;
alter table public.leads add constraint leads_lead_category_check check (lead_category in ('HOT', 'WARM', 'COLD') or lead_category is null);

alter table public.leads drop constraint if exists leads_next_action_check;
alter table public.leads add constraint leads_next_action_check check (next_action in ('send_whatsapp', 'schedule_followup', 'none') or next_action is null);

create index if not exists idx_leads_lead_score on public.leads(lead_score desc);
create index if not exists idx_leads_lead_category on public.leads(lead_category);
