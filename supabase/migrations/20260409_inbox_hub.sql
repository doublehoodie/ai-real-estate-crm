-- Inbox hub: email direction, thread metadata, notes

alter table public.emails
  add column if not exists direction text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'emails_direction_check'
  ) then
    alter table public.emails
      add constraint emails_direction_check
      check (direction is null or direction in ('inbound', 'outbound'));
  end if;
end $$;

create table if not exists public.inbox_thread_meta (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id text not null,
  is_favorite boolean not null default false,
  needs_action boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, thread_id)
);

create index if not exists inbox_thread_meta_user_id_idx
  on public.inbox_thread_meta (user_id);

alter table public.inbox_thread_meta enable row level security;

drop policy if exists "Users manage own inbox thread meta" on public.inbox_thread_meta;
create policy "Users manage own inbox thread meta"
  on public.inbox_thread_meta
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.inbox_thread_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id text not null,
  body text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists inbox_thread_notes_user_thread_idx
  on public.inbox_thread_notes (user_id, thread_id);

alter table public.inbox_thread_notes enable row level security;

drop policy if exists "Users manage own inbox notes" on public.inbox_thread_notes;
create policy "Users manage own inbox notes"
  on public.inbox_thread_notes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
