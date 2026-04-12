-- Align inbox_thread_meta / inbox_thread_notes with app expectations

alter table public.inbox_thread_meta
  add column if not exists created_at timestamptz not null default timezone('utc', now());

update public.inbox_thread_meta
set created_at = coalesce(created_at, updated_at, timezone('utc', now()));

-- inbox_thread_notes: column "note" (migrate legacy "body")
alter table public.inbox_thread_notes
  add column if not exists note text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inbox_thread_notes'
      and column_name = 'body'
  ) then
    execute 'update public.inbox_thread_notes set note = body where note is null';
  end if;
end $$;

update public.inbox_thread_notes
set note = coalesce(note, '')
where note is null;

alter table public.inbox_thread_notes
  drop column if exists body;

alter table public.inbox_thread_notes
  alter column note set not null;
