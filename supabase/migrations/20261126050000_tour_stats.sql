-- Private totals for the onboarding tours: how many times each step was seen and how each tour
-- ended. Counts only: no user id, no address, nothing that says who. Read them with SQL.
create table if not exists public.tour_stats (
  tour text not null check (tour ~ '^[a-z0-9-]{1,40}$'),
  step int not null check (step between 0 and 30),
  event text not null check (event in ('started', 'step', 'finished', 'skipped', 'off')),
  total bigint not null default 0,
  primary key (tour, step, event)
);
alter table public.tour_stats enable row level security; -- no policies: nobody reads it through the API

create or replace function public.tour_count(p_tour text, p_step int, p_event text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_tour is null or p_tour !~ '^[a-z0-9-]{1,40}$' or p_step is null or p_step not between 0 and 30
     or p_event is null or p_event not in ('started', 'step', 'finished', 'skipped', 'off') then return; end if;
  -- A fixed ceiling on distinct rows, so the table can never be grown by calling this with made-up names.
  if (select count(*) from public.tour_stats) >= 400
     and not exists (select 1 from public.tour_stats s where s.tour = p_tour and s.step = p_step and s.event = p_event) then return; end if;
  insert into public.tour_stats as t (tour, step, event, total) values (p_tour, p_step, p_event, 1)
  on conflict (tour, step, event) do update set total = t.total + 1;
end $$;
revoke all on function public.tour_count(text, int, text) from public;
grant execute on function public.tour_count(text, int, text) to anon, authenticated;
