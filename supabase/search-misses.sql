-- Searches that found nothing, so admins can see what people look for and Pheelm lacks.
-- Only the words and a count are kept: no account, no IP, no time per person.
create table if not exists public.search_misses (
  q text primary key check (char_length(q) between 3 and 120),
  count integer not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  resolved boolean not null default false
);
alter table public.search_misses enable row level security;
drop policy if exists "Admins read search misses" on public.search_misses;
create policy "Admins read search misses" on public.search_misses for select using (public.is_admin());
drop policy if exists "Admins update search misses" on public.search_misses;
create policy "Admins update search misses" on public.search_misses for update using (public.is_admin());
revoke all on public.search_misses from anon, authenticated;
grant select, update on public.search_misses to authenticated;

create or replace function public.log_search_miss(q text) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare clean text := lower(btrim(regexp_replace(coalesce(log_search_miss.q, ''), '\s+', ' ', 'g')));
begin
  if char_length(clean) < 3 or char_length(clean) > 120 then return; end if;
  -- Leave out anything that looks like an email address or a long number.
  if clean ~ '@.+\.' or clean ~ '\d{6,}' then return; end if;
  insert into public.search_misses as m (q) values (clean)
  on conflict on constraint search_misses_pkey do update set count = m.count + 1, last_at = now(), resolved = false;
end $$;
revoke all on function public.log_search_miss(text) from public;
grant execute on function public.log_search_miss(text) to anon, authenticated;
