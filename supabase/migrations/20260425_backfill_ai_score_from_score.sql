-- One-time alignment: legacy `score` → canonical `ai_score` (columns are not dropped).
update public.leads
set ai_score = score
where ai_score is null
  and score is not null;
