-- Security hardening from the November 2026 review. Safe to run more than once.
-- Everything here closes a gap that exists when someone talks to the database directly
-- (with the public key from the site) instead of going through Pheelm's own forms.

-- 1. Rate limits. Forms on the site have a bot check, but the tables behind them accept rows
--    straight from the API. Each insert below notifies admins or queues an email, so a script
--    could flood both. A cap per person (or per email) and one overall keeps that bounded.
create schema if not exists pheelm_private;

create or replace function pheelm_private.limit_inserts() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  per_person int := tg_argv[0]::int;   -- rows per person (or per email) in the window; 0 = no per-person cap
  overall int := tg_argv[1]::int;      -- rows from everyone in the window
  span interval := tg_argv[2]::interval;
  who_column text := nullif(tg_argv[3], '');
  who text;
  n bigint;
begin
  -- The time is the server's, so an old date can't be sent to slip under the cap.
  new.created_at := now();
  execute format('select count(*) from %I.%I where created_at > now() - $1', tg_table_schema, tg_table_name) into n using span;
  if n >= overall then
    raise exception 'Too many requests right now. Try again later.' using errcode = '53400';
  end if;
  if who_column is not null and per_person > 0 then
    who := lower(to_jsonb(new) ->> who_column);
    if who is not null then
      execute format('select count(*) from %I.%I where lower(%I::text) = $1 and created_at > now() - $2', tg_table_schema, tg_table_name, who_column)
        into n using who, span;
      if n >= per_person then
        raise exception 'Too many requests right now. Try again later.' using errcode = '53400';
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function pheelm_private.limit_inserts() from public, anon, authenticated;

drop trigger if exists limit_messages on public.messages;
create trigger limit_messages before insert on public.messages
  for each row execute function pheelm_private.limit_inserts('5', '120', '1 hour', 'email');

drop trigger if exists limit_subscribers on public.subscribers;
create trigger limit_subscribers before insert on public.subscribers
  for each row execute function pheelm_private.limit_inserts('0', '300', '1 hour', '');

drop trigger if exists limit_list_reports on public.list_reports;
create trigger limit_list_reports before insert on public.list_reports
  for each row execute function pheelm_private.limit_inserts('10', '60', '1 hour', 'user_id');

drop trigger if exists limit_comment_reports on public.comment_reports;
create trigger limit_comment_reports before insert on public.comment_reports
  for each row execute function pheelm_private.limit_inserts('20', '120', '1 hour', 'user_id');

drop trigger if exists limit_submissions on public.submissions;
create trigger limit_submissions before insert on public.submissions
  for each row execute function pheelm_private.limit_inserts('20', '300', '1 day', 'user_id');

drop trigger if exists limit_lists on public.lists;
create trigger limit_lists before insert on public.lists
  for each row execute function pheelm_private.limit_inserts('60', '5000', '1 day', 'user_id');

-- 2. Reports can't be filed in someone else's name.
drop policy if exists "anyone reports" on public.list_reports;
create policy "anyone reports" on public.list_reports for insert to anon, authenticated
  with check (
    resolved = false
    and (user_id is null or user_id = (select auth.uid()))
    and exists (select 1 from public.lists l where l.id = list_reports.list_id and l.is_public)
  );

-- 3. A new submission can't arrive with its own "review" already filled in, a link that isn't a
--    web address, or an oversized details blob.
drop policy if exists "add submission" on public.submissions;
create policy "add submission" on public.submissions for insert to authenticated
  with check (
    user_id = (select auth.uid()) and status = 'pending'
    and reviewed_at is null and film_id is null and review_note is null and reviewed_by is null
  );
alter table public.submissions drop constraint if exists submissions_link_web;
alter table public.submissions add constraint submissions_link_web check (link is null or link ~* '^https?://[^[:space:]]+$');
alter table public.submissions drop constraint if exists submissions_details_size;
alter table public.submissions add constraint submissions_details_size check (details is null or pg_column_size(details) <= 32768);

-- 4. The page a message is "about" is always one of Pheelm's own paths (it becomes a link in the inbox).
alter table public.messages drop constraint if exists messages_page_internal;
alter table public.messages add constraint messages_page_internal check (page is null or page ~ '^/([^/\\[:space:]][^\\[:space:]]*)?$');

-- 5. New accounts no longer get the first half of their email address as their name (it became
--    public the moment they made a profile without changing it). Google's name is still used.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 60), ''))
  on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- 6. A member keeps at most five photo files, so the photo bucket can't be filled through the API.
drop policy if exists "members upload own avatars" on storage.objects;
create policy "members upload own avatars" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.extension(name) = 'webp'
    and (select count(*) from storage.objects o
         where o.bucket_id = 'avatars' and (storage.foldername(o.name))[1] = (select auth.uid())::text) < 5
  );

-- 7. Indexes Supabase's performance check asked for.
create index if not exists admin_activity_actor_idx on public.admin_activity (actor_id);
create index if not exists film_editorial_versions_edited_by_idx on public.film_editorial_versions (edited_by);
create index if not exists film_editorials_updated_by_idx on public.film_editorials (updated_by);
create index if not exists submissions_reviewed_by_idx on public.submissions (reviewed_by);
create index if not exists messages_created_idx on public.messages (created_at);
create index if not exists subscribers_created_idx on public.subscribers (created_at);
