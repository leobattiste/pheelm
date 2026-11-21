-- Counting in the database instead of downloading rows to count them in the app.
-- Used by admin Analytics and the Films filters. Safe to run more than once.

-- New films, members, watchlists and watchlist saves per month, for the last few months
-- (this month included). Months with nothing still appear, with zeros.
create or replace function public.admin_monthly_counts(months int default 6)
returns table (month date, films bigint, members bigint, watchlists bigint, saves bigint)
language plpgsql stable security definer set search_path = '' as $$
declare first_month date := (date_trunc('month', now()) - make_interval(months => least(greatest(months, 1), 36) - 1))::date;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return query
    with series as (select generate_series(first_month, date_trunc('month', now())::date, interval '1 month')::date as m)
    select s.m,
      (select count(*) from public.films f where f.created_at >= s.m and f.created_at < s.m + interval '1 month'),
      (select count(*) from public.profiles p where p.created_at >= s.m and p.created_at < s.m + interval '1 month'),
      (select count(*) from public.lists l where l.created_at >= s.m and l.created_at < s.m + interval '1 month'),
      (select count(*) from public.list_saves v where v.created_at >= s.m and v.created_at < s.m + interval '1 month')
    from series s order by s.m;
end $$;
revoke all on function public.admin_monthly_counts(int) from public, anon;
grant execute on function public.admin_monthly_counts(int) to authenticated;

-- The choices for the Films filters: every decade, country and genre in the catalog.
create or replace function public.admin_film_facets() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  select jsonb_build_object(
    'decades', coalesce((select jsonb_agg(d order by d desc) from (select distinct (year / 10) * 10 as d from public.films where year is not null) x), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(c order by c) from (select distinct unnest(countries) as c from public.films) x where c is not null), '[]'::jsonb),
    'genres', coalesce((select jsonb_agg(g order by g) from (select distinct unnest(genres) as g from public.films) x where g is not null), '[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.admin_film_facets() from public, anon;
grant execute on function public.admin_film_facets() to authenticated;
