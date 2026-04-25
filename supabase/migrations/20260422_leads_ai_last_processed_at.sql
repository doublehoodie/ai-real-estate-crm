-- Track when AI last ran so we can re-run when new emails arrive for the same lead.
alter table public.leads
  add column if not exists ai_last_processed_at timestamptz null;

comment on column public.leads.ai_last_processed_at is 'Timestamp of last successful AI qualification run for this lead; used to detect new email content.';
