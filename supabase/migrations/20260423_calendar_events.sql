-- Lead-tied calendar events (CRM scheduling; no external sync).

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  type text not null check (type in ('call', 'follow_up', 'tour', 'meeting')),
  title text not null,
  description text not null default '',
  start_time timestamptz not null,
  end_time timestamptz not null,
  urgency_level text not null default 'medium' check (urgency_level in ('low', 'medium', 'high')),
  ai_generated boolean not null default false,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'missed')),
  created_at timestamptz not null default timezone('utc', now()),
  constraint calendar_events_time_order check (end_time >= start_time)
);

create index if not exists calendar_events_user_start_idx on public.calendar_events (user_id, start_time);
create index if not exists calendar_events_lead_id_idx on public.calendar_events (lead_id);

alter table public.calendar_events enable row level security;

drop policy if exists "Users manage own calendar events" on public.calendar_events;
create policy "Users manage own calendar events"
  on public.calendar_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
