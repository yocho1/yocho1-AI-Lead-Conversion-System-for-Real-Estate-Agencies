alter table public.messages add column if not exists sender text;

update public.messages
set sender = case
  when role = 'assistant' then 'ai'
  else 'user'
end
where sender is null;

alter table public.messages alter column sender set default 'user';
alter table public.messages alter column sender set not null;

alter table public.messages drop constraint if exists messages_sender_check;
alter table public.messages add constraint messages_sender_check check (sender in ('user', 'ai', 'agent'));

create index if not exists idx_messages_lead_timestamp on public.messages(lead_id, timestamp desc);
create index if not exists idx_messages_sender on public.messages(sender);
