-- A site-wide ceiling on how often the two counters anyone can call (tour_count, log_search_miss)
-- may add to their totals each minute. Both already cap how many rows they can create; this stops a
-- script from inflating the counts themselves. Nothing about the caller is stored: only a count per
-- counter per minute, and only the last hour is kept.
create table if not exists pheelm_private.counter_budget (
  name text not null,
  minute timestamptz not null,
  used int not null default 0,
  primary key (name, minute)
);
alter table pheelm_private.counter_budget enable row level security; -- no policies: only the functions below use it
revoke all on table pheelm_private.counter_budget from public, anon, authenticated;

-- True while this minute's budget for `p_name` lasts, and counts the use.
create or replace function pheelm_private.within_budget(p_name text, p_per_minute int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare this_minute timestamptz := date_trunc('minute', now()); n int;
begin
  insert into pheelm_private.counter_budget as b (name, minute, used) values (p_name, this_minute, 1)
  on conflict (name, minute) do update set used = b.used + 1
  returning used into n;
  -- Now and then, forget minutes older than an hour.
  if n = 1 then delete from pheelm_private.counter_budget where minute < now() - interval '1 hour'; end if;
  return n <= p_per_minute;
end $$;
revoke all on function pheelm_private.within_budget(text, int) from public, anon, authenticated;

create or replace function public.tour_count(p_tour text, p_step int, p_event text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_tour is null or p_tour !~ '^[a-z0-9-]{1,40}$' or p_step is null or p_step not between 0 and 30
     or p_event is null or p_event not in ('started', 'step', 'finished', 'skipped', 'off') then return; end if;
  -- A fixed ceiling on distinct rows, so the table can never be grown by calling this with made-up names.
  if (select count(*) from public.tour_stats) >= 400
     and not exists (select 1 from public.tour_stats s where s.tour = p_tour and s.step = p_step and s.event = p_event) then return; end if;
  if not pheelm_private.within_budget('tour_count', 600) then return; end if;
  insert into public.tour_stats as t (tour, step, event, total) values (p_tour, p_step, p_event, 1)
  on conflict (tour, step, event) do update set total = t.total + 1;
end $$;
revoke all on function public.tour_count(text, int, text) from public;
grant execute on function public.tour_count(text, int, text) to anon, authenticated;

create or replace function public.log_search_miss(q text)
returns void language plpgsql security definer set search_path = '' as $function$
#variable_conflict use_column
declare clean text := lower(btrim(regexp_replace(coalesce(log_search_miss.q, ''), '\s+', ' ', 'g')));
begin
  if char_length(clean) < 3 or char_length(clean) > 120 then return; end if;
  if clean ~ '@.+\.' or clean ~ '\d{6,}' then return; end if;
  if (select count(*) from public.search_misses) >= 5000 and not exists (select 1 from public.search_misses s where s.q = clean) then return; end if;
  if not pheelm_private.within_budget('log_search_miss', 300) then return; end if;
  insert into public.search_misses as m (q) values (clean)
  on conflict on constraint search_misses_pkey do update set count = m.count + 1, last_at = now(), resolved = false;
end $function$;
revoke all on function public.log_search_miss(text) from public;
grant execute on function public.log_search_miss(text) to anon, authenticated, service_role;
