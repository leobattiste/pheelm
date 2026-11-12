-- Just enough of Supabase and the live comments schema (as before film comments) for
-- supabase/film-comments.sql to run against.
do $$begin create role anon;exception when duplicate_object then null;end$$;
do $$begin create role authenticated;exception when duplicate_object then null;end$$;
create schema if not exists auth;
grant usage on schema auth to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant execute on function auth.uid() to anon, authenticated;

create table public.profiles(id uuid primary key, handle text unique, display_name text, is_admin boolean not null default false, is_private boolean not null default false);
create view public.member_profiles as select id, handle, display_name, is_private from public.profiles where handle is not null;
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$select coalesce((select is_admin from public.profiles where id = auth.uid()), false)$$;

create table public.films(id uuid primary key default gen_random_uuid(), slug text, title text, status text not null default 'published');
alter table public.films enable row level security;
create policy "read" on public.films for select using (status = 'published' or (select public.is_admin()));

create table public.lists(id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), title text,
  is_public boolean not null default true, hidden boolean not null default false, comments_enabled boolean not null default true, pinned_comment_id uuid);
alter table public.lists enable row level security;
create policy "read lists" on public.lists for select using (is_public or user_id = auth.uid());
create table public.list_members(list_id uuid, user_id uuid, status text);
create table public.blocks(blocker_id uuid, blocked_id uuid);
create function public.is_blocked(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as
  $$select exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))$$;
create function public.can_edit_list(lid uuid) returns boolean language sql stable security definer set search_path = public as
  $$select exists (select 1 from public.lists where id = lid and user_id = auth.uid())$$;

create table public.list_comments (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.list_comments(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  removed_at timestamptz
);
alter table public.list_comments enable row level security;
create policy "edit own comments" on public.list_comments for update to authenticated
  using (user_id = (select auth.uid()) and removed_at is null) with check (user_id = (select auth.uid()));

create table public.notifications(id uuid primary key default gen_random_uuid(), user_id uuid, actor_id uuid, type text,
  list_id uuid, film_id uuid, comment_id uuid references public.list_comments(id) on delete cascade, ref_id uuid, detail text);
create function public.notify(recipient uuid, kind text, actor uuid, lid uuid, cid uuid default null) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if recipient is null or recipient = actor then return; end if;
  insert into public.notifications (user_id, actor_id, type, list_id, comment_id) values (recipient, actor, kind, lid, cid);
end $$;
create table public.comment_reports(id uuid primary key default gen_random_uuid(), comment_id uuid references public.list_comments(id) on delete cascade, user_id uuid, reason text);

-- The triggers as they are live; the migration replaces their functions.
create function public.guard_comment() returns trigger language plpgsql as $$begin return new; end$$;
create function public.guard_blocked_comment() returns trigger language plpgsql as $$begin return new; end$$;
create function public.notify_comment() returns trigger language plpgsql as $$begin return null; end$$;
create function public.notify_admins_comment_report() returns trigger language plpgsql as $$begin return null; end$$;
create trigger guard_comment before insert or update on public.list_comments for each row execute function public.guard_comment();
create trigger blocked_comment_guard before insert on public.list_comments for each row execute function public.guard_blocked_comment();
create trigger notify_comment after insert on public.list_comments for each row execute function public.notify_comment();
create trigger comment_report_notify after insert on public.comment_reports for each row execute function public.notify_admins_comment_report();

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on public.list_comments to authenticated;
grant insert on public.comment_reports to authenticated;

insert into public.profiles(id, handle, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', true),
  ('00000000-0000-0000-0000-00000000000b', 'ama', false),
  ('00000000-0000-0000-0000-00000000000c', 'kofi', false);
insert into public.profiles(id) values ('00000000-0000-0000-0000-00000000000d'); -- signed in, no profile yet
insert into public.films(id, slug, title) values ('10000000-0000-0000-0000-000000000001', 'atlantics', 'Atlantics');
insert into public.films(id, slug, title, status) values ('10000000-0000-0000-0000-000000000002', 'draft', 'Draft', 'draft');
insert into public.lists(id, user_id, title) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'Kofi''s list');
insert into public.list_comments(list_id, user_id, body) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'An older watchlist comment');
