-- Only link emails to leads owned by the same user (requires leads.user_id).
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
    and l.user_id = e.user_id
    and l.email is not null
    and trim(l.email) <> ''
    and e.lead_id is null
    and (
      lower(trim(e.from_email)) = lower(trim(l.email))
      or lower(trim(e.to_email)) = lower(trim(l.email))
    );
$$;
