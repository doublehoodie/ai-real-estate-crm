alter table public.leads
  add column if not exists ai_score_breakdown jsonb,
  add column if not exists has_contradictions boolean not null default false;
