-- Align column name with app + remote DBs that used `body` before `content`.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notes'
      and column_name = 'body'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notes'
      and column_name = 'content'
  ) then
    alter table public.notes rename column body to content;
  end if;
end $$;
