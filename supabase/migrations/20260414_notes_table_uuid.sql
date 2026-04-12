-- Unified notes table (replaces inbox_thread_notes for app logic).
-- Assumes leads.id is uuid and auth.users.id is uuid.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  thread_id text,
  content text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint notes_context_check check (lead_id is not null or thread_id is not null)
);

create index if not exists notes_user_id_idx on public.notes (user_id);
create index if not exists notes_lead_id_idx on public.notes (lead_id) where lead_id is not null;
create index if not exists notes_user_thread_idx on public.notes (user_id, thread_id) where thread_id is not null;

alter table public.notes enable row level security;

drop policy if exists "Users manage own notes" on public.notes;
create policy "Users manage own notes"
  on public.notes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- One-time copy from legacy inbox_thread_notes when present (fresh DBs may skip)
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'inbox_thread_notes'
  ) then
    insert into public.notes (id, user_id, lead_id, thread_id, content, created_at)
    select n.id, n.user_id, n.lead_id, n.thread_id, coalesce(n.note, ''), n.created_at
    from public.inbox_thread_notes n
    where not exists (select 1 from public.notes x where x.id = n.id)
    on conflict (id) do nothing;
  end if;
end $$;

drop table if exists public.inbox_thread_notes cascade;
