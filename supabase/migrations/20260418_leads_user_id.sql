-- CRM lead ownership: every row is tied to auth.users (app always sets user_id on insert).
alter table public.leads
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists leads_user_id_idx on public.leads (user_id);
