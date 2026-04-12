-- Ensure inbox_thread_meta has updated_at for upsert touch timestamps

alter table public.inbox_thread_meta
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.inbox_thread_meta
set updated_at = coalesce(updated_at, created_at, timezone('utc', now()));
