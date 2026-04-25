-- Enforce per-user data isolation for leads at DB level.
alter table public.leads enable row level security;

drop policy if exists "Users manage own leads" on public.leads;
create policy "Users manage own leads"
  on public.leads
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
