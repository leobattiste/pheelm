-- A single number that goes up whenever the public catalog changes (films, people, credits,
-- collections, collection_films). The site keeps one copy of the catalog in memory per server and,
-- instead of re-reading ~55 pages of rows every minute, asks for this one row; it reads the catalog
-- again only when the number has moved. Statement-level triggers, so a bulk import bumps it once
-- per statement rather than once per row. Safe to run twice.
create table if not exists public.catalog_version (
  id smallint primary key default 1 check (id = 1),
  v bigint not null default 1,
  changed_at timestamptz not null default now()
);
insert into public.catalog_version (id) values (1) on conflict (id) do nothing;

alter table public.catalog_version enable row level security;
drop policy if exists "anyone can read the catalog version" on public.catalog_version;
create policy "anyone can read the catalog version" on public.catalog_version for select to anon, authenticated using (true);
revoke all on public.catalog_version from anon, authenticated;
grant select on public.catalog_version to anon, authenticated;

create or replace function pheelm_private.bump_catalog_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.catalog_version set v = v + 1, changed_at = now() where id = 1;
  return null;
end $$;
revoke execute on function pheelm_private.bump_catalog_version() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['films', 'people', 'credits', 'collections', 'collection_films'] loop
    execute format('drop trigger if exists bump_catalog_version on public.%I', t);
    execute format('create trigger bump_catalog_version after insert or update or delete or truncate on public.%I
      for each statement execute function pheelm_private.bump_catalog_version()', t);
  end loop;
end $$;

-- The scheduled film-queue job (pheelm-film-queue) called the site every minute even when nothing
-- was waiting, and under load pg_cron couldn't start it in time. It has been removed: queued films
-- are added from Admin → Films → Add. /api/internal/queue stays for a manual or future trigger.
do $$ begin
  if exists (select 1 from cron.job where jobname = 'pheelm-film-queue') then
    perform cron.unschedule('pheelm-film-queue');
  end if;
end $$;
