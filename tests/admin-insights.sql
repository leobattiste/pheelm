-- Checks for supabase/admin-insights.sql.
begin;
do $$begin begin perform * from public.admin_monthly_counts();raise exception 'Non-admin read counts';exception when insufficient_privilege then null;end;end$$;
select set_config('test.is_admin','true',true);
do $$declare r record;begin
  if (select count(*) from public.admin_monthly_counts(6))<>6 then raise exception 'Expected six months';end if;
  select * into r from public.admin_monthly_counts(6) order by month desc limit 1;
  if r.month<>date_trunc('month', now())::date or r.films<>2 or r.members<>2 or r.watchlists<>1 or r.saves<>0 then raise exception 'This month wrong: %', r;end if;
  if (select sum(films) from public.admin_monthly_counts(6))<>3 then raise exception 'Old films counted';end if;
  if (select count(*) from public.admin_monthly_counts(500))<>36 then raise exception 'Months not capped';end if;
end$$;
do $$declare f jsonb := public.admin_film_facets();begin
  if f->'decades'<>'[2010, 1990]'::jsonb then raise exception 'Decades wrong: %', f->'decades';end if;
  if f->'countries'<>'["FR", "SN", "US"]'::jsonb then raise exception 'Countries wrong: %', f->'countries';end if;
  if f->'genres'<>'["Drama", "Romance"]'::jsonb then raise exception 'Genres wrong: %', f->'genres';end if;
end$$;
rollback;
