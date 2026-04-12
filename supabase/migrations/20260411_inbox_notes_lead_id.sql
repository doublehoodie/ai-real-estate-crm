-- Link inbox notes to leads; allow CRM-only notes (thread_id nullable)

alter table public.inbox_thread_notes
  add column if not exists lead_id uuid references public.leads (id) on delete set null;

alter table public.inbox_thread_notes
  alter column thread_id drop not null;

create index if not exists inbox_thread_notes_user_lead_idx
  on public.inbox_thread_notes (user_id, lead_id)
  where lead_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inbox_thread_notes_thread_or_lead_check'
  ) then
    alter table public.inbox_thread_notes
      add constraint inbox_thread_notes_thread_or_lead_check
      check (thread_id is not null or lead_id is not null);
  end if;
end $$;
