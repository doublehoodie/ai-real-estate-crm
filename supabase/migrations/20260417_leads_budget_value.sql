-- Optional parsed USD amount for analytics; `budget` remains the source of truth (free text).
alter table public.leads
  add column if not exists budget_value numeric;

comment on column public.leads.budget_value is 'Best-effort single USD amount derived from budget text; null if ambiguous or unparseable.';
