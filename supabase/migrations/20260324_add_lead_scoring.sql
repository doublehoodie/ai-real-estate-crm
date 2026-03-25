alter table public.leads
  add column if not exists score integer,
  add column if not exists score_breakdown jsonb,
  add column if not exists score_explanation jsonb,
  add column if not exists updated_at timestamptz default timezone('utc', now());

alter table public.leads
  alter column updated_at set default timezone('utc', now());

update public.leads
set updated_at = coalesce(updated_at, created_at, timezone('utc', now()));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_score_range_check'
  ) then
    alter table public.leads
      add constraint leads_score_range_check
      check (score is null or (score >= 0 and score <= 100));
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;

create trigger leads_set_updated_at
before update on public.leads
for each row
execute function public.set_updated_at();
