alter table public.leads
  add column if not exists ai_summary text,
  add column if not exists ai_intent_level text,
  add column if not exists ai_score integer,
  add column if not exists ai_confidence double precision,
  add column if not exists ai_signals jsonb,
  add column if not exists ai_next_action jsonb,
  add column if not exists ai_followup text,
  add column if not exists ai_processed boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_ai_score_range_check'
  ) then
    alter table public.leads
      add constraint leads_ai_score_range_check
      check (ai_score is null or (ai_score >= 0 and ai_score <= 100));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_ai_confidence_range_check'
  ) then
    alter table public.leads
      add constraint leads_ai_confidence_range_check
      check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1));
  end if;
end $$;

create index if not exists leads_ai_processed_idx
  on public.leads (user_id, ai_processed);
