-- Pheelm admin improvements. Run after supabase/admins-watched-blocks.sql (public.is_admin).
-- This mirrors the production schema for quality checks, editorial revisions and audit history.
create table if not exists public.film_editorials (
  film_id uuid primary key references public.films(id) on delete cascade,
  essay text not null default '',
  sources text not null default '',
  status text not null default 'draft' check (status in ('draft','published')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.film_editorials enable row level security;
drop policy if exists "Published editorials visible" on public.film_editorials;
create policy "Published editorials visible" on public.film_editorials for select to anon, authenticated
  using (status = 'published' or (select public.is_admin()));
drop policy if exists "Admins create editorials" on public.film_editorials;
create policy "Admins create editorials" on public.film_editorials for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "Admins edit editorials" on public.film_editorials;
create policy "Admins edit editorials" on public.film_editorials for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.film_editorials to anon, authenticated;
grant insert, update on public.film_editorials to authenticated;

create table if not exists public.film_editorial_versions (
 id bigint generated always as identity primary key,
 film_id uuid not null references public.films(id) on delete cascade,
 essay text not null,
 sources text not null,
 status text not null,
 edited_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists film_editorial_versions_film_idx on public.film_editorial_versions(film_id,created_at desc);
alter table public.film_editorial_versions enable row level security;
drop policy if exists "Admins read editorial revisions" on public.film_editorial_versions;
create policy "Admins read editorial revisions" on public.film_editorial_versions for select to authenticated using ((select public.is_admin()));
drop policy if exists "Admins record editorial revisions" on public.film_editorial_versions;
create policy "Admins record editorial revisions" on public.film_editorial_versions for insert to authenticated
 with check ((select public.is_admin()) and edited_by = (select auth.uid()));
grant select,insert on public.film_editorial_versions to authenticated;

create table if not exists public.admin_activity (
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null,
 target_type text not null,
 target_id text,
 details text,
 created_at timestamptz not null default now()
);
create index if not exists admin_activity_created_idx on public.admin_activity(created_at desc);
alter table public.admin_activity enable row level security;
drop policy if exists "Admins read activity" on public.admin_activity;
create policy "Admins read activity" on public.admin_activity for select to authenticated using ((select public.is_admin()));
drop policy if exists "Admins record activity" on public.admin_activity;
create policy "Admins record activity" on public.admin_activity for insert to authenticated with check
  ((select public.is_admin()) and actor_id = (select auth.uid()));
grant select,insert on public.admin_activity to authenticated;

create or replace view public.admin_film_quality with (security_invoker=true) as
select f.id,f.slug,f.title,f.year,f.status,issues.issues,cardinality(issues.issues) as issue_count
from public.films f
left join public.film_editorials e on e.film_id=f.id
cross join lateral (
 select array_remove(array[
  case when nullif(btrim(coalesce(f.poster_url,'')),'') is null then 'poster' end,
  case when nullif(btrim(coalesce(f.synopsis,'')),'') is null then 'synopsis' end,
  case when not exists(select 1 from public.credits c where c.film_id=f.id and c.role='director') then 'director' end,
  case when cardinality(f.countries)=0 or f.countries is null then 'country' end,
  case when cardinality(f.languages)=0 or f.languages is null then 'language' end,
  case when f.runtime is null then 'runtime' end,
  case when f.tmdb_id is null then 'tmdb' end,
  case when e.status is distinct from 'published' then 'editorial' end,
  case when exists(select 1 from public.films other where other.id<>f.id and other.year=f.year
   and lower(regexp_replace(other.title,'[^a-zA-Z0-9]','','g'))=lower(regexp_replace(f.title,'[^a-zA-Z0-9]','','g'))) then 'duplicate' end
 ]::text[],null) as issues
) issues
where (select public.is_admin());
revoke all on public.admin_film_quality from public,anon;
grant select on public.admin_film_quality to authenticated;

create or replace view public.admin_people_quality with (security_invoker=true) as
select p.id,p.name,p.slug,p.country,p.bio,p.photo_url,p.tmdb_id,
 count(c.film_id) filter(where c.role='director')::integer as directed,
 count(c.film_id)::integer as credits
from public.people p left join public.credits c on c.person_id=p.id
where (select public.is_admin())
group by p.id;
revoke all on public.admin_people_quality from public,anon;
grant select on public.admin_people_quality to authenticated;

alter table public.submissions add column if not exists review_note text;
alter table public.submissions add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
