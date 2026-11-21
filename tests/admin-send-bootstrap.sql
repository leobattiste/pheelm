-- Tables the Send migration reads, on top of tests/email-bootstrap.sql and the email archive scripts.
-- Test database only: never run this on production.
\set ON_ERROR_STOP on
-- profiles, people and films come from tests/catalog-digest-bootstrap.sql; add what Send reads.
alter table public.profiles add column if not exists display_name text, add column if not exists is_admin boolean default false,
  add column if not exists is_owner boolean default false, add column if not exists suspended_at timestamptz;
create table if not exists public.follows(user_id uuid, person_id uuid, created_at timestamptz default now(), primary key(user_id, person_id));
create table if not exists public.watchlist(user_id uuid, film_id uuid, seen boolean default false, added_at timestamptz default now(), primary key(user_id, film_id));
alter table public.notifications add column if not exists actor_id uuid, add column if not exists detail text, add column if not exists ref_id uuid;
-- The live table's own check, so the migration's replacement is tested against it.
alter table public.notifications add constraint notifications_type_check check (type = any (array['invite','request','invite_accepted','invite_declined','request_accepted','request_declined','removed','comment','reply','mention','new_film','collection_film','report','comment_report','submission','message','new_member','featured']));
create or replace function public.respect_notification_preferences() returns trigger language plpgsql as $$
begin if exists (select 1 from public.notification_preferences p where p.user_id = new.user_id and new.type = any(p.disabled_types)) then return null; end if; return new; end $$;
create trigger respect_notification_preferences before insert on public.notifications for each row execute function public.respect_notification_preferences();
-- Admin checks read the signed-in profile, as they do live.
create or replace function public.is_admin() returns boolean language sql stable as $$ select coalesce((select is_admin and suspended_at is null from public.profiles where id = auth.uid()), false) $$;
create or replace function public.is_owner() returns boolean language sql stable as $$ select coalesce((select is_owner and suspended_at is null from public.profiles where id = auth.uid()), false) $$;
