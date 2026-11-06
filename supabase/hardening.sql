-- Security and performance hardening (November 2026).
-- Safe to run more than once.

-- 1. Trigger and event-trigger functions should never be callable through the API.
revoke execute on function public.guard_list_flags() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 2. Replace the two security-definer views with small tables kept in sync by triggers.
--    They hold only what is meant to be public: a member's id, handle and name, and save counts.
drop view if exists public.member_profiles;
drop view if exists public.list_save_counts;

create table if not exists public.member_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  handle text not null unique,
  display_name text
);
alter table public.member_profiles enable row level security;
drop policy if exists "read member profiles" on public.member_profiles;
create policy "read member profiles" on public.member_profiles for select to anon, authenticated using (true);

create table if not exists public.list_save_counts (
  list_id uuid primary key references public.lists(id) on delete cascade,
  saves integer not null default 0
);
alter table public.list_save_counts enable row level security;
drop policy if exists "read save counts" on public.list_save_counts;
create policy "read save counts" on public.list_save_counts for select to anon, authenticated using (true);

create or replace function public.sync_member_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.handle is null then
    delete from public.member_profiles where id = new.id;
  else
    insert into public.member_profiles (id, handle, display_name) values (new.id, new.handle, new.display_name)
    on conflict (id) do update set handle = excluded.handle, display_name = excluded.display_name;
  end if;
  return new;
end $$;
revoke execute on function public.sync_member_profile() from public, anon, authenticated;
drop trigger if exists sync_member_profile on public.profiles;
create trigger sync_member_profile after insert or update of handle, display_name on public.profiles
  for each row execute function public.sync_member_profile();

create or replace function public.sync_save_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.list_save_counts (list_id, saves) values (new.list_id, 1)
    on conflict (list_id) do update set saves = public.list_save_counts.saves + 1;
  else
    update public.list_save_counts set saves = greatest(saves - 1, 0) where list_id = old.list_id;
  end if;
  return null;
end $$;
revoke execute on function public.sync_save_count() from public, anon, authenticated;
drop trigger if exists sync_save_count on public.list_saves;
create trigger sync_save_count after insert or delete on public.list_saves
  for each row execute function public.sync_save_count();

-- Backfill.
insert into public.member_profiles (id, handle, display_name)
  select id, handle, display_name from public.profiles where handle is not null
  on conflict (id) do update set handle = excluded.handle, display_name = excluded.display_name;
insert into public.list_save_counts (list_id, saves)
  select list_id, count(*)::int from public.list_saves group by list_id
  on conflict (list_id) do update set saves = excluded.saves;

-- 3. Limits on member-written profile fields, and handles that look official.
update public.profiles set display_name = left(display_name, 60) where char_length(display_name) > 60;
alter table public.profiles drop constraint if exists profiles_display_name_length;
alter table public.profiles add constraint profiles_display_name_length check (char_length(display_name) <= 60);
alter table public.profiles drop constraint if exists profiles_handle_reserved;
alter table public.profiles add constraint profiles_handle_reserved check (handle not in (
  'admin','administrator','pheelm','staff','team','support','help','official','moderator','mod',
  'root','system','security','press','contact','about','account','login','logout','signin','signup',
  'settings','me','api','auth','www','mail','directors','films','collections','journal','submit'
));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), 60))
  on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 4. Indexes for foreign keys.
create index if not exists collection_films_film_id_idx on public.collection_films (film_id);
create index if not exists follows_person_id_idx on public.follows (person_id);
create index if not exists list_films_film_id_idx on public.list_films (film_id);
create index if not exists list_reports_list_id_idx on public.list_reports (list_id);
create index if not exists list_reports_user_id_idx on public.list_reports (user_id);
create index if not exists list_saves_user_id_idx on public.list_saves (user_id);
create index if not exists submissions_film_id_idx on public.submissions (film_id);
create index if not exists submissions_user_id_idx on public.submissions (user_id);
create index if not exists watchlist_film_id_idx on public.watchlist (film_id);

-- 5. Policies: one policy per action, and auth.uid() / is_admin() evaluated once per query.

-- Catalog tables: everyone reads, admins write.
do $$
declare t text;
begin
  foreach t in array array['collection_films','collections','credits','people'] loop
    execute format('drop policy if exists "admin %s" on public.%I', replace(t, '_', ' '), t);
    execute format('drop policy if exists "read %s" on public.%I', replace(t, '_', ' '), t);
    execute format('drop policy if exists "read" on public.%I', t);
    execute format('drop policy if exists "admin insert" on public.%I', t);
    execute format('drop policy if exists "admin update" on public.%I', t);
    execute format('drop policy if exists "admin delete" on public.%I', t);
    execute format('create policy "read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "admin insert" on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy "admin update" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy "admin delete" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
  foreach t in array array['articles','films'] loop
    execute format('drop policy if exists "admin %s" on public.%I', t, t);
    execute format('drop policy if exists "read %s" on public.%I', t, t);
    execute format('drop policy if exists "read" on public.%I', t);
    execute format('drop policy if exists "admin insert" on public.%I', t);
    execute format('drop policy if exists "admin update" on public.%I', t);
    execute format('drop policy if exists "admin delete" on public.%I', t);
    execute format($p$create policy "read" on public.%I for select to anon, authenticated using (status = 'published' or (select public.is_admin()))$p$, t);
    execute format('create policy "admin insert" on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy "admin update" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy "admin delete" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;

-- Follows and watchlist: each member's own rows only.
drop policy if exists "own follows" on public.follows;
create policy "own follows" on public.follows for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "own watchlist" on public.watchlist;
create policy "own watchlist" on public.watchlist for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Lists.
drop policy if exists "read lists" on public.lists;
drop policy if exists "own lists" on public.lists;
drop policy if exists "admins manage lists" on public.lists;
drop policy if exists "insert own lists" on public.lists;
drop policy if exists "update lists" on public.lists;
drop policy if exists "delete own lists" on public.lists;
create policy "read lists" on public.lists for select to anon, authenticated
  using ((is_public and not hidden) or user_id = (select auth.uid()) or (select public.is_admin()));
create policy "insert own lists" on public.lists for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "update lists" on public.lists for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "delete own lists" on public.lists for delete to authenticated
  using (user_id = (select auth.uid()));

-- Films in lists.
drop policy if exists "read list films" on public.list_films;
drop policy if exists "own list films" on public.list_films;
drop policy if exists "insert own list films" on public.list_films;
drop policy if exists "update own list films" on public.list_films;
drop policy if exists "delete own list films" on public.list_films;
create policy "read list films" on public.list_films for select to anon, authenticated
  using (exists (select 1 from public.lists l where l.id = list_id
    and ((l.is_public and not l.hidden) or l.user_id = (select auth.uid()) or (select public.is_admin()))));
create policy "insert own list films" on public.list_films for insert to authenticated
  with check (exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid())));
create policy "update own list films" on public.list_films for update to authenticated
  using (exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid())))
  with check (exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid())));
create policy "delete own list films" on public.list_films for delete to authenticated
  using (exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid())));

-- Saves: only public, visible collections can be saved.
drop policy if exists "own saves" on public.list_saves;
drop policy if exists "admins read saves" on public.list_saves;
drop policy if exists "read saves" on public.list_saves;
drop policy if exists "save public lists" on public.list_saves;
drop policy if exists "remove own saves" on public.list_saves;
create policy "read saves" on public.list_saves for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "save public lists" on public.list_saves for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.lists l where l.id = list_id and l.is_public and not l.hidden));
create policy "remove own saves" on public.list_saves for delete to authenticated
  using (user_id = (select auth.uid()));

-- Reports: anyone files one, admins handle them.
drop policy if exists "admins manage reports" on public.list_reports;
drop policy if exists "anyone reports" on public.list_reports;
drop policy if exists "admins read reports" on public.list_reports;
drop policy if exists "admins update reports" on public.list_reports;
drop policy if exists "admins delete reports" on public.list_reports;
create policy "anyone reports" on public.list_reports for insert to anon, authenticated
  with check (resolved = false
    and exists (select 1 from public.lists l where l.id = list_id and l.is_public));
create policy "admins read reports" on public.list_reports for select to authenticated using ((select public.is_admin()));
create policy "admins update reports" on public.list_reports for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins delete reports" on public.list_reports for delete to authenticated using ((select public.is_admin()));

-- Messages and subscribers: admin side.
drop policy if exists "Admins read messages" on public.messages;
drop policy if exists "Admins update messages" on public.messages;
drop policy if exists "Admins delete messages" on public.messages;
create policy "Admins read messages" on public.messages for select to authenticated using ((select public.is_admin()));
create policy "Admins update messages" on public.messages for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete messages" on public.messages for delete to authenticated using ((select public.is_admin()));
drop policy if exists "Admins read subscribers" on public.subscribers;
drop policy if exists "Admins remove subscribers" on public.subscribers;
create policy "Admins read subscribers" on public.subscribers for select to authenticated using ((select public.is_admin()));
create policy "Admins remove subscribers" on public.subscribers for delete to authenticated using ((select public.is_admin()));

-- Profiles.
drop policy if exists "read own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid())
    and is_admin = (select p.is_admin from public.profiles p where p.id = (select auth.uid())));

-- Submissions.
drop policy if exists "add submission" on public.submissions;
drop policy if exists "read submissions" on public.submissions;
drop policy if exists "review submissions" on public.submissions;
drop policy if exists "delete submissions" on public.submissions;
create policy "add submission" on public.submissions for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and reviewed_at is null and film_id is null);
create policy "read submissions" on public.submissions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "review submissions" on public.submissions for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "delete submissions" on public.submissions for delete to authenticated
  using ((select public.is_admin()));
