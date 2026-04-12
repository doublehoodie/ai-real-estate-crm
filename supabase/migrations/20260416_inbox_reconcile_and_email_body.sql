-- Store full message text when populated (sync route unchanged; column available for future/backfill).
alter table public.emails
  add column if not exists body text;

-- Link unassigned emails to leads when from/to matches lead.email (single source of truth).
create or replace function public.reconcile_emails_to_leads(p_user_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.emails e
  set lead_id = l.id
  from public.leads l
  where e.user_id = p_user_id
    and e.user_id = auth.uid()
    and l.email is not null
    and trim(l.email) <> ''
    and e.lead_id is null
    and (
      lower(trim(e.from_email)) = lower(trim(l.email))
      or lower(trim(e.to_email)) = lower(trim(l.email))
    );
$$;

grant execute on function public.reconcile_emails_to_leads(uuid) to authenticated;
