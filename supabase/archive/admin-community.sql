-- Member and community moderation: suspending members, deleting watchlists, and a log of
-- text the content check refused. Safe to run more than once.

-- Suspending members -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists suspended_by uuid references auth.users (id) on delete set null;
alter table public.profiles drop constraint if exists profiles_suspended_reason_length;
alter table public.profiles add constraint profiles_suspended_reason_length check (coalesce(length(suspended_reason), 0) <= 500);

create or replace function public.is_suspended(who uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select suspended_at is not null from public.profiles where id = who), false);
$$;
revoke all on function public.is_suspended(uuid) from public, anon;
grant execute on function public.is_suspended(uuid) to authenticated;

-- A suspended member can still sign in to see their own things (until their sign-in is also
-- blocked), but can't comment, like, create or change watchlists, add films or submit.
create or replace function public.block_suspended_writes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and public.is_suspended(auth.uid()) and not public.is_admin() then
    raise exception 'Your account is suspended.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
revoke all on function public.block_suspended_writes() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['list_comments', 'lists', 'list_films', 'comment_likes', 'submissions'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists block_suspended_writes on public.%I', t);
      execute format('create trigger block_suspended_writes before insert or update on public.%I for each row execute function public.block_suspended_writes()', t);
    end if;
  end loop;
end $$;

-- Suspends or restores a member, with a reason. Admins can suspend members; only the owner
-- can suspend an admin; nobody can suspend the owner or themselves. Optionally hides all
-- their public watchlists at the same time.
create or replace function public.admin_set_suspended(who uuid, suspend boolean, reason text default null, hide_watchlists boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare target record;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  select id, is_admin, is_owner into target from public.profiles where id = who;
  if not found then raise exception 'Member not found'; end if;
  if who = auth.uid() then raise exception 'You can''t suspend yourself' using errcode = '42501'; end if;
  if target.is_owner then raise exception 'The owner can''t be suspended' using errcode = '42501'; end if;
  if target.is_admin and not public.is_owner() then raise exception 'Only the owner can suspend an admin' using errcode = '42501'; end if;
  if suspend then
    update public.profiles set suspended_at = coalesce(suspended_at, now()), suspended_reason = nullif(left(btrim(coalesce(reason, '')), 500), ''),
      suspended_by = auth.uid() where id = who;
    if hide_watchlists then update public.lists set hidden = true where user_id = who and is_public; end if;
  else
    update public.profiles set suspended_at = null, suspended_reason = null, suspended_by = null where id = who;
  end if;
end $$;
revoke all on function public.admin_set_suspended(uuid, boolean, text, boolean) from public, anon;
grant execute on function public.admin_set_suspended(uuid, boolean, text, boolean) to authenticated;

-- Members for the admin list, now with whether they're suspended. Email only for the owner.
drop function if exists public.admin_members();
create function public.admin_members()
returns table (id uuid, handle text, display_name text, email text, created_at timestamptz, last_seen timestamptz,
  is_admin boolean, is_owner boolean, is_private boolean, lists bigint, saved bigint, comments bigint,
  suspended_at timestamptz, suspended_reason text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only admins can see members.'; end if;
  return query
    select p.id, p.handle, p.display_name,
      case when public.is_owner() then u.email::text end,
      p.created_at, u.last_sign_in_at, p.is_admin, p.is_owner, coalesce(p.is_private, false),
      (select count(*) from public.lists l where l.user_id = p.id),
      (select count(*) from public.watchlist w where w.user_id = p.id),
      (select count(*) from public.list_comments c where c.user_id = p.id and c.removed_at is null),
      p.suspended_at, p.suspended_reason
    from public.profiles p left join auth.users u on u.id = p.id
    order by p.created_at desc;
end $$;
revoke all on function public.admin_members() from public, anon;
grant execute on function public.admin_members() to authenticated;

-- Watchlists -------------------------------------------------------------------------------------
-- The owner can delete any watchlist (admins can hide them).
drop policy if exists "Owner deletes watchlists" on public.lists;
create policy "Owner deletes watchlists" on public.lists for delete using ((select public.is_owner()));

-- Refused text -----------------------------------------------------------------------------------
-- When the content check refuses a comment, bio or watchlist description, the server keeps a
-- short excerpt and why, for 90 days, so admins can see what's being blocked.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.moderation_refusals (
  id bigint generated always as identity primary key,
  actor_id uuid,
  field text not null check (field in ('comment', 'bio', 'watchlist_description')),
  excerpt text not null check (length(excerpt) <= 300),
  reason text not null check (length(reason) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists moderation_refusals_created on private.moderation_refusals (created_at desc);
revoke all on private.moderation_refusals from public, anon, authenticated;
grant select, insert, delete on private.moderation_refusals to service_role;
grant usage, select on sequence private.moderation_refusals_id_seq to service_role;

create or replace function public.record_moderation_refusal(p_actor uuid, p_field text, p_text text, p_reason text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  delete from private.moderation_refusals where created_at < now() - interval '90 days';
  insert into private.moderation_refusals (actor_id, field, excerpt, reason)
    values (p_actor, p_field, left(btrim(coalesce(p_text, '')), 300), left(coalesce(p_reason, 'Refused'), 200));
end $$;
revoke all on function public.record_moderation_refusal(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.record_moderation_refusal(uuid, text, text, text) to service_role;

-- What admins see: newest first, with who wrote it.
create or replace function public.admin_moderation_log(page_size int default 50, page_offset int default 0)
returns table (id bigint, actor_id uuid, handle text, field text, excerpt text, reason text, created_at timestamptz, total bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return query
    select r.id, r.actor_id, p.handle, r.field, r.excerpt, r.reason, r.created_at, count(*) over ()
    from private.moderation_refusals r left join public.profiles p on p.id = r.actor_id
    order by r.created_at desc
    limit least(greatest(page_size, 1), 200) offset greatest(page_offset, 0);
end $$;
revoke all on function public.admin_moderation_log(int, int) from public, anon;
grant execute on function public.admin_moderation_log(int, int) to authenticated;
