-- Baseline: the live database's structure on 2026-11-21, exported from the catalogue with
-- supabase/export-schema.sql (run that again to refresh it).
--
-- This is the starting point for a fresh Supabase project: run it once on an empty project, then
-- seed.sql for the starter catalogue. Changes from here on go in new, dated files in this folder.
-- The older one-off scripts in supabase/*.sql are history; they are already part of this baseline.
--
-- Not included, because they aren't structure: data, vault secrets (create pheelm_email_worker_secret,
-- pheelm_worker_secret, pheelm_resend_api_key, pheelm_resend_webhook_secret and pheelm_postal_address
-- in the vault before the scheduled job and the email worker can run), and Supabase's own schemas.

set check_function_bodies = false;
set search_path = public, extensions;

create schema if not exists pheelm_email;

create schema if not exists pheelm_private;

create schema if not exists private;

create extension if not exists pg_cron with schema pg_catalog;

create extension if not exists pg_net with schema extensions;

create extension if not exists pg_stat_statements with schema extensions;

create extension if not exists pgcrypto with schema extensions;

create extension if not exists supabase_vault with schema vault;

create extension if not exists "uuid-ossp" with schema extensions;

create table if not exists pheelm_email.catalog_additions (
  kind text not null,
  entity_id uuid not null,
  added_at timestamp with time zone default now() not null
);

create table if not exists pheelm_email.events (
  id text not null,
  type text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists pheelm_email.outbox (
  id uuid default gen_random_uuid() not null,
  event_key text not null,
  user_id uuid,
  recipient text not null,
  template text not null,
  message text not null,
  action_path text default '/account'::text not null,
  category text default 'transactional'::text not null,
  state text default 'pending'::text not null,
  attempts integer default 0 not null,
  available_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  sent_at timestamp with time zone,
  provider_id text,
  last_error text,
  lease uuid,
  digest_from timestamp with time zone,
  digest_until timestamp with time zone
);

create table if not exists pheelm_email.subscriptions (
  email text not null,
  token text default encode(extensions.gen_random_bytes(32), 'hex'::text) not null,
  confirmed_at timestamp with time zone,
  requested_at timestamp with time zone default now() not null,
  unsubscribed_at timestamp with time zone
);

create table if not exists pheelm_email.suppressions (
  email text not null,
  reason text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists pheelm_private.collaboration_requests (
  list_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone default now() not null,
  id bigint generated always as identity not null
);

create table if not exists private.banned_words (
  word text not null,
  added_at timestamp with time zone default now() not null,
  kind text default 'swearing'::text not null,
  instead text
);

create table if not exists private.moderation_refusals (
  id bigint generated always as identity not null,
  actor_id uuid,
  field text not null,
  excerpt text not null,
  reason text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.admin_activity (
  id bigint generated always as identity not null,
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id text,
  details text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.blocks (
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.catalog_version (
  id smallint default 1 not null,
  v bigint default 1 not null,
  changed_at timestamp with time zone default now() not null
);

create table if not exists public.collection_films (
  collection_id uuid not null,
  film_id uuid not null,
  sort integer default 0 not null
);

create table if not exists public.collections (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  title text not null,
  description text,
  kind text default 'theme'::text not null,
  featured boolean default false not null,
  sort_order integer default 99 not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.comment_likes (
  comment_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.comment_reports (
  id uuid default gen_random_uuid() not null,
  comment_id uuid not null,
  user_id uuid default auth.uid(),
  reason text,
  resolved boolean default false not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.credits (
  film_id uuid not null,
  person_id uuid not null,
  role text not null,
  "character" text,
  sort integer default 0 not null
);

create table if not exists public.director_bio_jobs (
  person_id uuid not null,
  status text default 'queued'::text not null,
  attempts integer default 0 not null,
  draft_bio text,
  source_urls text[] default '{}'::text[] not null,
  evidence text,
  reason text,
  next_attempt_at timestamp with time zone default now() not null,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.email_preferences (
  user_id uuid not null,
  collaboration_emails boolean default true not null,
  digest_frequency text default 'off'::text not null,
  updated_at timestamp with time zone default now() not null,
  unsubscribe_token text default encode(extensions.gen_random_bytes(32), 'hex'::text) not null,
  digest_cursor timestamp with time zone default now() not null,
  activity_emails boolean default true not null
);

create table if not exists public.film_editorial_versions (
  id bigint generated always as identity not null,
  film_id uuid not null,
  essay text not null,
  sources text not null,
  status text not null,
  edited_by uuid,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.film_editorials (
  film_id uuid not null,
  essay text default ''::text not null,
  sources text default ''::text not null,
  status text default 'draft'::text not null,
  updated_by uuid,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.film_queue (
  id uuid default gen_random_uuid() not null,
  title text not null,
  year integer,
  director_name text,
  director_keys text[] default '{}'::text[] not null,
  synopsis text,
  last_error text,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone default now() not null
);

create table if not exists public.films (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  title text not null,
  original_title text,
  year integer not null,
  type text default 'feature'::text not null,
  countries text[] default '{}'::text[] not null,
  languages text[] default '{}'::text[] not null,
  genres text[] default '{}'::text[] not null,
  runtime integer,
  synopsis text,
  poster_url text,
  backdrop_url text,
  trailer_url text,
  awards jsonb default '[]'::jsonb not null,
  watch jsonb default '[]'::jsonb not null,
  tmdb_id integer,
  status text default 'published'::text not null,
  featured boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  color text,
  aka text[] default '{}'::text[] not null,
  note text,
  published_at timestamp with time zone
);

create table if not exists public.follows (
  user_id uuid not null,
  person_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.list_comments (
  id uuid default gen_random_uuid() not null,
  list_id uuid,
  user_id uuid not null,
  parent_id uuid,
  body text not null,
  created_at timestamp with time zone default now() not null,
  edited_at timestamp with time zone,
  removed_at timestamp with time zone,
  film_id uuid,
  spoiler boolean default false not null
);

create table if not exists public.list_films (
  list_id uuid not null,
  film_id uuid not null,
  added_at timestamp with time zone default now() not null,
  added_by uuid default auth.uid()
);

create table if not exists public.list_members (
  list_id uuid not null,
  user_id uuid not null,
  status text not null,
  note text,
  invited_by uuid,
  created_at timestamp with time zone default now() not null,
  responded_at timestamp with time zone
);

create table if not exists public.list_reports (
  id uuid default gen_random_uuid() not null,
  list_id uuid not null,
  user_id uuid default auth.uid(),
  reason text not null,
  resolved boolean default false not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.list_save_counts (
  list_id uuid not null,
  saves integer default 0 not null
);

create table if not exists public.list_saves (
  list_id uuid not null,
  user_id uuid default auth.uid() not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.lists (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  title text not null,
  description text,
  is_public boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  hidden boolean default false not null,
  staff_pick boolean default false not null,
  comments_enabled boolean default true not null,
  pinned_comment_id uuid,
  legacy_slug text,
  featured boolean default false not null,
  slug text not null
);

create table if not exists public.member_follows (
  follower_id uuid not null,
  followed_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.member_profiles (
  id uuid not null,
  handle text not null,
  display_name text,
  is_private boolean default false not null,
  country text,
  bio text,
  avatar_url text,
  social_platform text,
  social_url text,
  website_url text
);

create table if not exists public.message_replies (
  id uuid default gen_random_uuid() not null,
  message_id uuid not null,
  author_id uuid default auth.uid(),
  body text not null,
  via text default 'pheelm'::text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.messages (
  id uuid default gen_random_uuid() not null,
  name text,
  email text not null,
  organization text,
  topic text default 'general'::text not null,
  body text not null,
  handled boolean default false not null,
  created_at timestamp with time zone default now() not null,
  page text,
  page_title text,
  status text default 'new'::text not null,
  stage text,
  partnership_type text,
  website text,
  notes text,
  due_at timestamp with time zone,
  replied_at timestamp with time zone,
  closed_at timestamp with time zone,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.notification_preferences (
  user_id uuid not null,
  disabled_types text[] default '{}'::text[] not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.notifications (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  actor_id uuid,
  type text not null,
  list_id uuid,
  comment_id uuid,
  created_at timestamp with time zone default now() not null,
  read_at timestamp with time zone,
  film_id uuid,
  person_id uuid,
  ref_id uuid,
  detail text
);

create table if not exists public.people (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  name text not null,
  bio text,
  country text,
  birth_year integer,
  photo_url text,
  tmdb_id integer,
  created_at timestamp with time zone default now() not null,
  born date,
  died date,
  birthplace text,
  known_for text,
  imdb_id text,
  instagram text,
  details_at timestamp with time zone,
  in_directory boolean default true not null
);

create table if not exists public.profiles (
  id uuid not null,
  display_name text,
  is_admin boolean default false not null,
  created_at timestamp with time zone default now() not null,
  handle text,
  is_private boolean default false not null,
  country text,
  bio text,
  is_owner boolean default false not null,
  hide_watched boolean default false not null,
  hide_following boolean default false not null,
  avatar_url text,
  social_platform text,
  social_url text,
  website_url text,
  suspended_at timestamp with time zone,
  suspended_reason text,
  suspended_by uuid
);

create table if not exists public.search_misses (
  q text not null,
  count integer default 1 not null,
  first_at timestamp with time zone default now() not null,
  last_at timestamp with time zone default now() not null,
  resolved boolean default false not null
);

create table if not exists public.submissions (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  title text not null,
  director text not null,
  year integer,
  link text,
  note text,
  status text default 'pending'::text not null,
  film_id uuid,
  created_at timestamp with time zone default now() not null,
  reviewed_at timestamp with time zone,
  review_note text,
  reviewed_by uuid,
  kind text default 'suggestion'::text not null,
  details jsonb
);

create table if not exists public.subscribers (
  email text not null,
  source text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.watched (
  user_id uuid not null,
  film_id uuid not null,
  watched_at timestamp with time zone default now() not null
);

create table if not exists public.watchlist (
  user_id uuid not null,
  film_id uuid not null,
  seen boolean default false not null,
  added_at timestamp with time zone default now() not null
);

CREATE OR REPLACE FUNCTION pheelm_email.account_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if TG_OP='DELETE' then
  delete from pheelm_email.outbox where user_id=old.id and state in ('pending','processing');
  delete from public.subscribers where lower(email)=lower(old.email);
  delete from pheelm_email.subscriptions where email=lower(old.email);
  perform pheelm_email.enqueue('deleted:'||old.id,null,old.email,'account-deleted','Your Pheelm account has been deleted. If you did not request this, contact Pheelm.','/contact');
  return old;
 end if;
 if new.email_confirmed_at is not null and (TG_OP='INSERT' or old.email_confirmed_at is null) then
  perform pheelm_email.enqueue('welcome:'||new.id,new.id,new.email,'welcome','Discover films, make watchlists, and follow directors. Your Pheelm account is ready.','/films');
 end if;
 if TG_OP='UPDATE' and new.email is distinct from old.email and old.email_confirmed_at is not null then
  perform pheelm_email.enqueue('email-change-old:'||new.id||':'||new.updated_at,new.id,old.email,'security-notice','The sign-in email on your Pheelm account changed. If this was not you, contact Pheelm immediately.','/contact');
  perform pheelm_email.enqueue('email-change-new:'||new.id||':'||new.updated_at,new.id,new.email,'security-notice','The sign-in email on your Pheelm account changed. If this was not you, contact Pheelm immediately.','/account');
 end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION pheelm_email.digest_due(frequency text, at_time timestamp with time zone DEFAULT now())
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 with t as (select (at_time at time zone 'America/New_York') as local_now),
 d as (select ((date_trunc('day', local_now) + interval '16 hours') at time zone 'America/New_York') as today4,
  ((date_trunc('day', local_now) - make_interval(days => ((extract(isodow from local_now)::int - 5 + 7) % 7)) + interval '16 hours') at time zone 'America/New_York') as friday4 from t)
 select case when frequency = 'weekly' then case when at_time >= friday4 then friday4 else friday4 - interval '7 days' end
  else case when at_time >= today4 then today4 else today4 - interval '1 day' end end from d;
$function$
;

CREATE OR REPLACE FUNCTION pheelm_email.digest_items(since_time timestamp with time zone, until_time timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with items as (
  select c.kind, c.entity_id, c.title, c.path, a.added_at,
   row_number() over (partition by c.kind order by a.added_at desc, c.entity_id) as n,
   count(*) over (partition by c.kind) as total
  from pheelm_email.discoverable_catalog c join pheelm_email.catalog_additions a using (kind, entity_id)
  where a.added_at > since_time and a.added_at <= until_time),
 films as (select jsonb_build_object('total', max(i.total), 'items', jsonb_agg(jsonb_build_object('title', left(i.title, 100), 'path', i.path, 'year', f.year, 'poster', f.poster_url) order by i.n)) j
  from items i join public.films f on f.id = i.entity_id where i.kind = 'film' and i.n <= 6),
 directors as (select jsonb_build_object('total', max(i.total), 'items', jsonb_agg(jsonb_build_object('title', left(i.title, 100), 'path', i.path, 'photo', p.photo_url) order by i.n)) j
  from items i join public.people p on p.id = i.entity_id where i.kind = 'director' and i.n <= 4),
 watchlists as (select jsonb_build_object('total', max(i.total), 'items', jsonb_agg(jsonb_build_object('title', left(i.title, 100), 'path', i.path) order by i.n)) j
  from items i where i.kind = 'collection' and i.n <= 4)
 select case when exists (select 1 from items) then jsonb_strip_nulls(jsonb_build_object(
  'films', (select j from films where jsonb_typeof(j->'items') = 'array'),
  'directors', (select j from directors where jsonb_typeof(j->'items') = 'array'),
  'watchlists', (select j from watchlists where jsonb_typeof(j->'items') = 'array'))) end;
$function$
;

CREATE OR REPLACE FUNCTION pheelm_email.digest_message(since_time timestamp with time zone, until_time timestamp with time zone)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with items as (select c.*,row_number() over(partition by c.kind order by a.added_at desc,c.entity_id) n,count(*) over(partition by c.kind) total from pheelm_email.discoverable_catalog c join pheelm_email.catalog_additions a using(kind,entity_id) where a.added_at>since_time and a.added_at<=until_time),
 sections as (select kind,max(total) total,string_agg(left(title,100)||case when length(title)>100 then '…' else '' end||E'\nhttps://www.pheelm.com'||path,E'\n\n' order by n) body from items where n<=4 group by kind)
 select E'New on Pheelm\n\n'||string_agg(case kind when 'film' then 'Films' when 'director' then 'Directors' else 'Watchlists' end||' ('||total||E')\n'||body||case when total>4 then E'\nMore on Pheelm.' else '' end,E'\n\n' order by case kind when 'film' then 1 when 'director' then 2 else 3 end) from sections;
$function$
;

CREATE OR REPLACE FUNCTION pheelm_email.enqueue(k text, uid uuid, address text, tid text, body text, path text DEFAULT '/account'::text, kind text DEFAULT 'transactional'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if address is null or address !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(address)>254 then return; end if;
 if exists(select 1 from pheelm_email.suppressions where email=lower(address)) then return; end if;
 -- Anonymous acknowledgments are deliberately bounded, even if a client bypasses the form.
 if tid in ('contact-received','newsletter-confirmation') and
 (exists(select 1 from pheelm_email.outbox where lower(recipient)=lower(address) and template=tid and created_at>now()-interval '1 hour')
 or (select count(*) from pheelm_email.outbox where template=tid and created_at>now()-interval '1 hour')>=50) then return; end if;
 insert into pheelm_email.outbox(event_key,user_id,recipient,template,message,action_path,category)
 values(k,uid,lower(address),tid,left(body,6000),path,kind) on conflict(event_key) do nothing;
end $function$
;

CREATE OR REPLACE FUNCTION pheelm_email.member_notice()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare address text;
begin
  select email into address from auth.users where id = new.id and email_confirmed_at is not null;
  if address is null then return new; end if;
  if new.is_admin is distinct from old.is_admin then
    if new.is_admin then
      perform pheelm_email.enqueue('role-granted:'||new.id||':'||extract(epoch from clock_timestamp())::bigint, new.id, address, 'role-granted',
        'The owner made you an admin on Pheelm.', '/admin');
    else
      perform pheelm_email.enqueue('role-removed:'||new.id||':'||extract(epoch from clock_timestamp())::bigint, new.id, address, 'role-removed',
        'The owner removed your admin role on Pheelm.', '/');
    end if;
  end if;
  if new.suspended_at is not null and old.suspended_at is null then
    perform pheelm_email.enqueue('suspended:'||new.id||':'||extract(epoch from new.suspended_at)::bigint, new.id, address, 'account-suspended',
      'Your Pheelm account has been suspended.', '/contact');
  elsif new.suspended_at is null and old.suspended_at is not null then
    perform pheelm_email.enqueue('restored:'||new.id||':'||extract(epoch from clock_timestamp())::bigint, new.id, address, 'account-restored',
      'Your Pheelm account has been restored.', '/login');
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION pheelm_email.message_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform pheelm_email.enqueue('message:'||new.id,null,new.email,'contact-received','We received your '||case when new.topic='partnership' then 'partnership enquiry' when new.topic in ('feedback','correction') then 'feedback' else 'message' end||'. Keep this reference if you contact us again: '||new.id||'. We do not promise a specific response time.','/contact');return new;
end $function$
;

CREATE OR REPLACE FUNCTION pheelm_email.newsletter_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare token_value text;
begin
 if TG_OP='DELETE' then update pheelm_email.subscriptions set unsubscribed_at=now(),confirmed_at=null where email=lower(old.email);return old; end if;
 insert into pheelm_email.subscriptions(email) values(lower(new.email)) on conflict(email) do update set token=encode(extensions.gen_random_bytes(32),'hex'),confirmed_at=null,requested_at=now(),unsubscribed_at=null returning token into token_value;
 perform pheelm_email.enqueue('newsletter-confirm:'||token_value,null,new.email,'newsletter-confirmation','Confirm that you want to receive the Pheelm newsletter. If you did not request this, ignore this email; you will not be subscribed.','/newsletter-confirm?token='||token_value,'confirmation');return new;
end $function$
;

CREATE OR REPLACE FUNCTION pheelm_email.notification_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare address text; collaboration boolean; activity boolean;
begin
 if new.type not in ('invite','request','invite_accepted','invite_declined','request_accepted','request_declined','removed','comment','reply','mention','new_film') then return new; end if;
 select email into address from auth.users where id=new.user_id and email_confirmed_at is not null and (banned_until is null or banned_until<now());
 select collaboration_emails,activity_emails into collaboration,activity from public.email_preferences where user_id=new.user_id;
 if exists(select 1 from public.notification_preferences where user_id=new.user_id and new.type=any(disabled_types)) then return new; end if;
 insert into public.email_preferences(user_id) values(new.user_id) on conflict do nothing;
 if new.type in ('comment','reply','mention','new_film') then
  if activity is false then return new; end if;
  if (select count(*) from pheelm_email.outbox where user_id=new.user_id and template='activity-update' and created_at>now()-interval '1 hour')>=5 then return new; end if;
  perform pheelm_email.enqueue('notification:'||new.id,new.user_id,address,'activity-update',
   case new.type when 'reply' then 'Someone replied to your comment. Sign in to read it.' when 'mention' then 'Someone mentioned you in a comment. Sign in to read it.' when 'comment' then 'Someone commented on one of your watchlists. Sign in to read it.' else 'A new film by a director you follow was added to Pheelm. Sign in to see it.' end,'/notifications','optional');
  return new;
 end if;
 if collaboration is false then return new; end if;
 if (select count(*) from pheelm_email.outbox where user_id=new.user_id and template in ('collection-invitation','collaboration-update') and created_at>now()-interval '1 hour')>=5 then return new; end if;
 perform pheelm_email.enqueue('notification:'||new.id,new.user_id,address,case when new.type='invite' then 'collection-invitation' else 'collaboration-update' end,
 case new.type when 'invite' then 'You have been invited to help curate a watchlist. Sign in to review and accept or decline.' when 'request' then 'A member requested to help curate your watchlist. Sign in to review the request.' when 'removed' then 'Your membership of a watchlist changed. Sign in to review the update.' else 'There is an update on your watchlist collaboration. Sign in to review it.' end,'/notifications','collaboration');return new;
end $function$
;

CREATE OR REPLACE FUNCTION pheelm_email.reset_digest_cursor()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin if new.digest_frequency is distinct from old.digest_frequency then new.digest_cursor:=now();end if;return new;end$function$
;

CREATE OR REPLACE FUNCTION pheelm_email.submission_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare address text;
begin
 select email into address from auth.users where id=new.user_id and email_confirmed_at is not null;
 if TG_OP='INSERT' then
  perform pheelm_email.enqueue('submission:'||new.id,new.user_id,address,'submission-received','We received your film submission: '||new.title||'. It is awaiting review; it has not been published. Reference: '||new.id,'/account?tab=submissions');
 elsif new.status is distinct from old.status then
  perform pheelm_email.enqueue('submission-update:'||new.id||':'||new.status||':'||coalesce(new.reviewed_at::text,''),new.user_id,address,'submission-update','Your submission “'||new.title||'” has an update. Current status: '||new.status||'. Sign in to see the review notes.','/account?tab=submissions');
 end if;return new;
end $function$
;

CREATE OR REPLACE FUNCTION pheelm_private.assign_watchlist_slug()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare base text; candidate text; suffix integer:=1;
begin
 if tg_op='UPDATE' and old.slug is not null then new.slug:=old.slug;return new;end if;
 base:=trim(both '-' from left(regexp_replace(lower(regexp_replace(normalize(coalesce(new.title,''),NFKD),U&'[\0300-\036f]','','g')),'[^a-z0-9]+','-','g'),90));
 if base='' then base:='watchlist';end if;
 -- Serialize allocation across all names, including a name that already ends in '-2'.
 perform pg_advisory_xact_lock(hashtextextended('pheelm-watchlist-slug-allocation',0));
 candidate:=base;
 while exists(select 1 from public.lists where slug=candidate and id<>new.id) loop
  suffix:=suffix+1;candidate:=base||'-'||suffix;
 end loop;
 new.slug:=candidate;return new;
end $function$
;

CREATE OR REPLACE FUNCTION pheelm_private.bump_catalog_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.catalog_version set v = v + 1, changed_at = now() where id = 1;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION pheelm_private.guard_profile_moderation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- Admins can't lift their own suspension either (the owner suspends admins).
  if auth.uid() is null or (coalesce(public.is_admin(), false) and new.id is distinct from auth.uid()) then return new; end if;
  if tg_op = 'INSERT' then
    new.suspended_at := null; new.suspended_reason := null; new.suspended_by := null;
  else
    new.suspended_at := old.suspended_at; new.suspended_reason := old.suspended_reason; new.suspended_by := old.suspended_by;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION pheelm_private.limit_inserts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  per_person int := tg_argv[0]::int;
  overall int := tg_argv[1]::int;
  span interval := tg_argv[2]::interval;
  who_column text := nullif(tg_argv[3], '');
  who text;
  n bigint;
begin
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
end $function$
;

CREATE OR REPLACE FUNCTION private.banned_word_message(w text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case b.kind
      when 'swearing' then 'Swearing isn''t allowed on Pheelm.'
      when 'sexist' then 'Sexist slurs aren''t allowed on Pheelm.'
      when 'racist' then 'Racial slurs aren''t allowed on Pheelm.'
      when 'antisemitic' then 'Antisemitic slurs aren''t allowed on Pheelm.'
      when 'homophobic' then 'Homophobic slurs aren''t allowed on Pheelm.'
      when 'transphobic' then 'Transphobic slurs aren''t allowed on Pheelm.'
      when 'ableist' then 'Ableist slurs aren''t allowed on Pheelm.'
      else 'That word isn''t allowed on Pheelm.'
    end || case when b.instead is not null then ' Try “' || b.instead || '” instead.' else ' Remove it and try again.' end
  from (select w) x left join private.banned_words b on b.word = x.w
$function$
;

CREATE OR REPLACE FUNCTION private.first_banned_word(p_text text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare t text := private.words_for_matching(p_text); w text;
begin
  if btrim(t) = '' then return null; end if;
  for w in select b.word from private.banned_words b order by length(b.word) desc, b.word loop
    if t ~ ('\m' || replace(regexp_replace(w, '([a-z])', '\1+', 'g'), ' ', '[^a-z]*') || '(s|es|ed|er|ers|ing|in|y|ty|z)?\M') then
      return w;
    end if;
  end loop;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.remove_blocked_member_follows()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  delete from public.member_follows
  where (follower_id = new.blocker_id and followed_id = new.blocked_id)
     or (follower_id = new.blocked_id and followed_id = new.blocker_id);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.words_for_matching(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select regexp_replace(translate(lower(coalesce(t, '')), '01345@$', 'oieasas'), '([a-z])[-._*]+(?=[a-z])', '\1', 'g')
$function$
;

CREATE OR REPLACE FUNCTION public.admin_banned_words()
 RETURNS TABLE(word text, kind text, instead text, added_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Admin access required' using errcode = '42501'; end if;
  return query select b.word, b.kind, b.instead, b.added_at from private.banned_words b order by b.kind, b.word;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_film_facets()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  select jsonb_build_object(
    'decades', coalesce((select jsonb_agg(d order by d desc) from (select distinct (year / 10) * 10 as d from public.films where year is not null) x), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(c order by c) from (select distinct unnest(countries) as c from public.films) x where c is not null), '[]'::jsonb),
    'genres', coalesce((select jsonb_agg(g order by g) from (select distinct unnest(genres) as g from public.films) x where g is not null), '[]'::jsonb)
  ) into result;
  return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_films_without_director()
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return query
    select f.id from public.films f
    where not exists (select 1 from public.credits c where c.film_id = f.id and c.role = 'director')
    limit 500;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_members()
 RETURNS TABLE(id uuid, handle text, display_name text, email text, created_at timestamp with time zone, last_seen timestamp with time zone, is_admin boolean, is_owner boolean, is_private boolean, lists bigint, saved bigint, comments bigint, suspended_at timestamp with time zone, suspended_reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_moderation_log(page_size integer DEFAULT 50, page_offset integer DEFAULT 0)
 RETURNS TABLE(id bigint, actor_id uuid, handle text, field text, excerpt text, reason text, created_at timestamp with time zone, total bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return query
    select r.id, r.actor_id, p.handle, r.field, r.excerpt, r.reason, r.created_at, count(*) over ()
    from private.moderation_refusals r left join public.profiles p on p.id = r.actor_id
    order by r.created_at desc
    limit least(greatest(page_size, 1), 200) offset greatest(page_offset, 0);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_monthly_counts(months integer DEFAULT 6)
 RETURNS TABLE(month date, films bigint, members bigint, watchlists bigint, saves bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare first_month date := (date_trunc('month', now()) - make_interval(months => least(greatest(months, 1), 36) - 1))::date;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return query
    with series as (select generate_series(first_month, date_trunc('month', now())::date, interval '1 month')::date as m)
    select s.m,
      (select count(*) from public.films f where f.created_at >= s.m and f.created_at < s.m + interval '1 month'),
      (select count(*) from public.profiles p where p.created_at >= s.m and p.created_at < s.m + interval '1 month'),
      (select count(*) from public.lists l where l.created_at >= s.m and l.created_at < s.m + interval '1 month'),
      (select count(*) from public.list_saves v where v.created_at >= s.m and v.created_at < s.m + interval '1 month')
    from series s order by s.m;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_newsletter_counts()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  with people as (
    select case
      when exists (select 1 from pheelm_email.suppressions x where x.email = lower(p.email)) then 'suppressed'
      when s.unsubscribed_at is not null then 'unsubscribed'
      when s.confirmed_at is not null then 'confirmed'
      else 'pending' end as state
    from public.subscribers p left join pheelm_email.subscriptions s on s.email = lower(p.email)
  )
  select jsonb_build_object(
    'total', count(*),
    'confirmed', count(*) filter (where state = 'confirmed'),
    'pending', count(*) filter (where state = 'pending'),
    'unsubscribed', count(*) filter (where state = 'unsubscribed'),
    'suppressed', count(*) filter (where state = 'suppressed')
  ) into result from people;
  return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_newsletter(search text DEFAULT NULL::text, only_state text DEFAULT NULL::text, page_size integer DEFAULT 50, page_offset integer DEFAULT 0)
 RETURNS TABLE(email text, source text, created_at timestamp with time zone, state text, confirmed_at timestamp with time zone, unsubscribed_at timestamp with time zone, total bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_owner() then raise exception 'Owner access required' using errcode = '42501'; end if;
  return query
  with people as (
    select p.email, p.source, p.created_at, s.confirmed_at, s.unsubscribed_at,
      case
        when exists (select 1 from pheelm_email.suppressions x where x.email = lower(p.email)) then 'suppressed'
        when s.unsubscribed_at is not null then 'unsubscribed'
        when s.confirmed_at is not null then 'confirmed'
        else 'pending' end as state
    from public.subscribers p left join pheelm_email.subscriptions s on s.email = lower(p.email)
  ), matching as (
    select * from people
    where (search is null or search = '' or people.email ilike '%' || replace(replace(search, '%', ''), '_', '') || '%')
      and (only_state is null or only_state = '' or people.state = only_state)
  )
  select m.email, m.source, m.created_at, m.state, m.confirmed_at, m.unsubscribed_at, count(*) over ()
  from matching m order by m.created_at desc
  limit least(greatest(page_size, 1), 200) offset greatest(page_offset, 0);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_remove_banned_word(p_word text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Admin access required' using errcode = '42501'; end if;
  delete from private.banned_words where word = lower(btrim(p_word));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_remove_subscriber(address text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_owner() then raise exception 'Owner access required' using errcode = '42501'; end if;
  update pheelm_email.subscriptions set unsubscribed_at = now() where email = lower(address) and unsubscribed_at is null;
  delete from public.subscribers where lower(email) = lower(address);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_save_banned_word(p_word text, p_kind text, p_instead text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare w text := regexp_replace(lower(btrim(coalesce(p_word, ''))), '\s+', ' ', 'g'); alt text := nullif(btrim(coalesce(p_instead, '')), '');
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Admin access required' using errcode = '42501'; end if;
  if w !~ '^[a-z]+( [a-z]+)*$' or length(w) < 3 or length(w) > 40 then
    raise exception 'Use letters only, at least 3 (a phrase can have spaces).' using errcode = '22023';
  end if;
  if p_kind not in ('swearing', 'sexist', 'racist', 'antisemitic', 'homophobic', 'transphobic', 'ableist') then
    raise exception 'Choose what kind of word it is.' using errcode = '22023';
  end if;
  if alt is not null and alt !~ '^[A-Za-z][A-Za-z -]{0,23}$' then
    raise exception 'The suggested word can use letters, spaces and dashes, up to 24 characters.' using errcode = '22023';
  end if;
  if alt is not null and private.first_banned_word(alt) is not null then
    raise exception 'The suggested word can''t be a banned word itself.' using errcode = '22023';
  end if;
  insert into private.banned_words (word, kind, instead) values (w, p_kind, alt)
    on conflict (word) do update set kind = excluded.kind, instead = excluded.instead;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_suspended(who uuid, suspend boolean, reason text DEFAULT NULL::text, hide_watchlists boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.block_suspended_writes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is not null and public.is_suspended(auth.uid()) and not public.is_admin() then
    raise exception 'Your account is suspended.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $function$
;

CREATE OR REPLACE FUNCTION public.can_edit_list(lid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.is_list_owner(lid) or public.is_list_collaborator(lid);
$function$
;

CREATE OR REPLACE FUNCTION public.check_text(p_field text, p_text text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare w text;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if p_field not in ('comment', 'bio', 'watchlist_description') or char_length(coalesce(p_text, '')) > 10000 then
    raise exception 'Invalid text check' using errcode = '22023';
  end if;
  w := private.first_banned_word(p_text);
  if w is not null and (select count(*) from private.moderation_refusals where actor_id = auth.uid() and created_at > now() - interval '1 hour') < 30 then
    delete from private.moderation_refusals where created_at < now() - interval '90 days';
    insert into private.moderation_refusals (actor_id, field, excerpt, reason)
      values (auth.uid(), p_field, left(btrim(p_text), 300), 'Banned word: ' || w);
  end if;
  return case when w is null then null else private.banned_word_message(w) end;
end $function$
;

CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end $function$
;

CREATE OR REPLACE FUNCTION public.email_claim(batch_size integer DEFAULT 20)
 RETURNS SETOF pheelm_email.outbox
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 update pheelm_email.outbox set state='failed',last_error='Delivery expired; manual review required.' where state in ('pending','processing') and created_at<now()-interval '12 hours';
 update pheelm_email.outbox o set state='suppressed',message='',last_error='Suppressed or preference disabled' where o.state in ('pending','processing') and
 (exists(select 1 from pheelm_email.suppressions s where s.email=lower(o.recipient)) or
 (o.category='collaboration' and exists(select 1 from public.email_preferences p where p.user_id=o.user_id and not p.collaboration_emails)) or
 (o.category='optional' and not exists(select 1 from public.email_preferences p where p.user_id=o.user_id and p.digest_frequency<>'off')) or
 (o.category='confirmation' and not exists(select 1 from pheelm_email.subscriptions s where s.email=lower(o.recipient) and s.confirmed_at is null and s.unsubscribed_at is null and o.action_path='/newsletter-confirm?token='||s.token)));
 return query with due as (
 select id from pheelm_email.outbox where (state='pending' or (state='processing' and available_at<now())) and available_at<=now() and attempts<6 order by created_at for update skip locked limit greatest(1,least(batch_size,20))
 ) update pheelm_email.outbox o set state='processing',attempts=o.attempts+1,available_at=now()+interval '15 minutes',lease=gen_random_uuid() from due where o.id=due.id returning o.*;
end $function$
;

CREATE OR REPLACE FUNCTION public.email_complete(job_id uuid, lease_id uuid, provider text DEFAULT NULL::text, failure text DEFAULT NULL::text, retryable boolean DEFAULT false)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 update pheelm_email.outbox set state=case when failure is null then 'sent' when retryable and attempts<6 then 'pending' else 'failed' end,
 provider_id=coalesce(provider,provider_id),sent_at=case when failure is null then now() else sent_at end,last_error=left(failure,200),
 available_at=now()+make_interval(secs=>least(3600,60*power(2,attempts)::int)),lease=null where id=job_id and lease=lease_id and state='processing';
$function$
;

CREATE OR REPLACE FUNCTION public.email_confirmed_subscribers()
 RETURNS TABLE(email text, source text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not public.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 return query select p.email,p.source,p.created_at from public.subscribers p join pheelm_email.subscriptions s on s.email=lower(p.email) where s.confirmed_at is not null and s.unsubscribed_at is null and not exists(select 1 from pheelm_email.suppressions b where b.email=lower(p.email)) order by p.created_at,p.email;
end $function$
;

CREATE OR REPLACE FUNCTION public.email_delivery_config()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_object_agg(name,decrypted_secret),'{}'::jsonb) from vault.decrypted_secrets where name in ('pheelm_resend_api_key','pheelm_email_worker_secret','pheelm_resend_webhook_secret','pheelm_postal_address');
$function$
;

CREATE OR REPLACE FUNCTION public.email_digest_items(job_id uuid, lease_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select pheelm_email.digest_items(o.digest_from, o.digest_until) || jsonb_build_object('frequency', p.digest_frequency)
 from pheelm_email.outbox o join public.email_preferences p on p.user_id=o.user_id and p.digest_frequency<>'off'
 where o.id=job_id and o.lease=lease_id and o.state='processing' and o.template='activity-digest';
$function$
;

CREATE OR REPLACE FUNCTION public.email_job_preferences(uid uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('token',unsubscribe_token,'collaboration',collaboration_emails,'digest',digest_frequency) from public.email_preferences where user_id=uid;
$function$
;

CREATE OR REPLACE FUNCTION public.email_prepare_digests()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p record; body text; event text; cutoff timestamptz := now(); due timestamptz;
begin
 if not pg_try_advisory_xact_lock(hashtextextended('pheelm-catalog-digest',0)) then return; end if;
 insert into pheelm_email.catalog_additions(kind,entity_id) select kind,entity_id from pheelm_email.discoverable_catalog on conflict do nothing;
 for p in select ep.*,u.email from public.email_preferences ep join auth.users u on u.id=ep.user_id
  where ep.digest_frequency<>'off' and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<now())
  and ep.digest_cursor < pheelm_email.digest_due(ep.digest_frequency, cutoff)
  for update of ep skip locked loop
  due := pheelm_email.digest_due(p.digest_frequency, cutoff);
  body := pheelm_email.digest_message(p.digest_cursor, cutoff);
  if body is not null then
   event := 'catalog-digest:'||p.user_id||':'||p.digest_frequency||':'||extract(epoch from due)::bigint::text;
   perform pheelm_email.enqueue(event,p.user_id,p.email,'activity-digest',body,'/films','optional');
   update pheelm_email.outbox set digest_from=p.digest_cursor,digest_until=cutoff where event_key=event;
  end if;
  update public.email_preferences set digest_cursor=cutoff where user_id=p.user_id;
 end loop;
 delete from pheelm_email.outbox where created_at<now()-interval '14 days';
 delete from pheelm_email.events where created_at<now()-interval '14 days';
end $function$
;

CREATE OR REPLACE FUNCTION public.email_record_event(event_id text, event_type text, email_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare address text;
begin
 insert into pheelm_email.events(id,type) values(event_id,event_type) on conflict do nothing;if not found then return; end if;
 if event_type in ('email.bounced','email.complained','email.suppressed') then
 select recipient into address from pheelm_email.outbox where provider_id=email_id;
 if address is not null then
 insert into pheelm_email.suppressions(email,reason) values(lower(address),event_type) on conflict(email) do update set reason=excluded.reason;
 update pheelm_email.outbox set state='suppressed',message='' where lower(recipient)=lower(address) and state in ('pending','processing');
 end if;
 end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.email_reply_to_message(message_id uuid, reply text, close boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare m record;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if length(btrim(reply)) not between 1 and 5000 then raise exception 'Write a reply of 1–5000 characters'; end if;
  select * into m from public.messages where id = message_id;
  if not found then raise exception 'Message not found'; end if;
  perform pheelm_email.enqueue('reply:' || gen_random_uuid(), null, m.email, 'support-response', btrim(reply) || E'\n\nReference: ' || m.id, '/contact');
  insert into public.message_replies (message_id, author_id, body, via) values (m.id, auth.uid(), btrim(reply), 'pheelm');
  update public.messages set
    replied_at = now(),
    status = case when close then 'done' when status = 'new' then 'open' else status end
  where id = m.id;
end $function$
;

CREATE OR REPLACE FUNCTION public.email_token_action(token_value text, action text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare address text;
begin
 if length(token_value)<>64 then return false; end if;
 if action='confirm' then
 update pheelm_email.subscriptions s set confirmed_at=now() where token=token_value and unsubscribed_at is null and requested_at>now()-interval '7 days' and exists(select 1 from public.subscribers p where lower(p.email)=s.email) returning email into address;return found;
 elsif action='unsubscribe' then
 update pheelm_email.subscriptions set unsubscribed_at=now(),confirmed_at=null where token=token_value returning email into address;
 if address is not null then delete from public.subscribers where lower(email)=address;return true;end if;
 update public.email_preferences set collaboration_emails=false,activity_emails=false,digest_frequency='off',updated_at=now() where unsubscribe_token=token_value;return found;
 end if;return false;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_blocked_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.list_id is not null and public.is_blocked((select user_id from public.lists where id = new.list_id), new.user_id) then
    raise exception 'You can''t comment on this collection.';
  end if;
  if new.parent_id is not null and public.is_blocked((select user_id from public.list_comments where id = new.parent_id), new.user_id) then
    raise exception 'You can''t reply to this comment.';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_blocked_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.is_blocked((select user_id from public.lists where id = new.list_id), new.user_id) then
    raise exception 'That isn''t possible for this collection.';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.list_comments;
begin
  if tg_op = 'INSERT' then
    if new.parent_id is not null then
      select * into p from public.list_comments where id = new.parent_id;
      if p.id is null or p.list_id is distinct from new.list_id or p.film_id is distinct from new.film_id or p.removed_at is not null then
        raise exception 'Reply to a comment on this page.' using errcode = 'check_violation';
      end if;
      if p.parent_id is not null then new.parent_id := p.parent_id; end if;
    end if;
    if (select count(*) from public.list_comments
        where user_id = new.user_id and created_at > now() - interval '1 minute') >= 6 then
      raise exception 'You''re commenting very fast. Wait a minute and try again.' using errcode = 'check_violation';
    end if;
    new.body := btrim(new.body);
    new.created_at := now();
    new.edited_at := null;
    new.removed_at := null;
    if new.list_id is not null then new.spoiler := false; end if;
  else
    new.id := old.id; new.list_id := old.list_id; new.film_id := old.film_id; new.user_id := old.user_id;
    new.parent_id := old.parent_id; new.created_at := old.created_at;
    new.body := btrim(new.body);
    if new.list_id is not null then new.spoiler := false; end if;
    if new.removed_at is null then new.removed_at := old.removed_at; end if;
    if new.removed_at is null and new.body is distinct from old.body then new.edited_at := now(); else new.edited_at := old.edited_at; end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_list_flags()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.hidden := false;
      new.staff_pick := false;
      new.featured := false;
    else
      new.hidden := old.hidden;
      new.staff_pick := old.staff_pick;
      new.featured := old.featured;
    end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_list_owner_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.is_admin() then return new; end if;
  new.user_id := old.user_id;
  if old.user_id is distinct from auth.uid() then
    new.is_public := old.is_public;
    new.comments_enabled := old.comments_enabled;
    if new.pinned_comment_id is not null then new.pinned_comment_id := old.pinned_comment_id; end if;
  end if;
  if new.pinned_comment_id is not null and new.pinned_comment_id is distinct from old.pinned_comment_id
     and not exists (select 1 from public.list_comments where id = new.pinned_comment_id and list_id = new.id and parent_id is null) then
    raise exception 'Pin a comment from this collection.' using errcode = 'check_violation';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 60), ''))
  on conflict (id) do nothing;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.invite_collaborator(lid uuid, who text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); target uuid; cur text;
begin
  if public.is_suspended(me) then raise exception 'Your account is suspended.' using errcode = 'insufficient_privilege'; end if;
  if not exists (select 1 from public.lists where id = lid and user_id = me) then
    raise exception 'Only the owner can invite people.' using errcode = 'insufficient_privilege';
  end if;
  select id into target from public.member_profiles where handle = lower(ltrim(btrim(who), '@')) and not is_private;
  if target is null then raise exception 'There''s no public profile with that handle.' using errcode = 'no_data_found'; end if;
  if target = me then raise exception 'That''s you.' using errcode = 'check_violation'; end if;
  select status into cur from public.list_members where list_id = lid and user_id = target;
  if cur = 'active' then raise exception 'They already collaborate on this collection.' using errcode = 'unique_violation'; end if;
  if cur = 'invited' then raise exception 'They''re already invited.' using errcode = 'unique_violation'; end if;
  if cur = 'requested' then
    update public.list_members set status = 'active', responded_at = now(), invited_by = me where list_id = lid and user_id = target;
    perform public.notify(target, 'request_accepted', me, lid);
    return 'active';
  end if;
  if (select count(*) from public.list_members where list_id = lid and status in ('active', 'invited')) >= 10 then
    raise exception 'A collection can have up to 10 collaborators.' using errcode = 'check_violation';
  end if;
  insert into public.list_members (list_id, user_id, status, invited_by, created_at, responded_at, note)
  values (lid, target, 'invited', me, now(), null, null)
  on conflict (list_id, user_id) do update set status = 'invited', invited_by = me, created_at = now(), responded_at = null, note = null;
  perform public.notify(target, 'invite', me, lid);
  return 'invited';
end $function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select is_admin and suspended_at is null from public.profiles where id = auth.uid()), false);
$function$
;

CREATE OR REPLACE FUNCTION public.is_blocked(a uuid, b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$function$
;

CREATE OR REPLACE FUNCTION public.is_list_collaborator(lid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.list_members where list_id = lid and user_id = auth.uid() and status = 'active');
$function$
;

CREATE OR REPLACE FUNCTION public.is_list_owner(lid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.lists where id = lid and user_id = auth.uid());
$function$
;

CREATE OR REPLACE FUNCTION public.is_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select is_owner and suspended_at is null from public.profiles where id = auth.uid()), false);
$function$
;

CREATE OR REPLACE FUNCTION public.is_suspended(who uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((select suspended_at is not null from public.profiles where id = who), false);
$function$
;

CREATE OR REPLACE FUNCTION public.log_search_miss(q text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare clean text := lower(btrim(regexp_replace(coalesce(log_search_miss.q, ''), '\s+', ' ', 'g')));
begin
  if char_length(clean) < 3 or char_length(clean) > 120 then return; end if;
  if clean ~ '@.+\.' or clean ~ '\d{6,}' then return; end if;
  if (select count(*) from public.search_misses) >= 5000 and not exists (select 1 from public.search_misses s where s.q = clean) then return; end if;
  insert into public.search_misses as m (q) values (clean)
  on conflict on constraint search_misses_pkey do update set count = m.count + 1, last_at = now(), resolved = false;
end $function$
;

CREATE OR REPLACE FUNCTION public.messages_keep_state()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then
    new.status := 'new';
    new.handled := false;
    new.notes := null;
    new.replied_at := null;
    new.closed_at := null;
    new.stage := case when new.topic = 'partnership' then 'new' end;
    new.due_at := case when new.topic = 'privacy' then now() + interval '30 days' end;
    new.updated_at := now();
    return new;
  end if;
  if new.handled is distinct from old.handled and new.status is not distinct from old.status then
    new.status := case when new.handled then 'done' else 'open' end;
  end if;
  new.handled := new.status in ('done', 'spam');
  if new.status in ('done', 'spam') and old.status not in ('done', 'spam') then new.closed_at := now(); end if;
  if new.status not in ('done', 'spam') then new.closed_at := null; end if;
  new.updated_at := now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_admins_comment_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.notifications (user_id, actor_id, type, list_id, film_id, comment_id, ref_id, detail)
  select a.id, new.user_id, 'comment_report', c.list_id, c.film_id, new.comment_id, new.id, left(new.reason, 200)
  from public.profiles a, public.list_comments c where a.is_admin and c.id = new.comment_id;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_admins_list_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.notifications (user_id, actor_id, type, list_id, ref_id, detail)
  select a.id, case when exists (select 1 from public.profiles where id = new.user_id) then new.user_id end,
    'report', new.list_id, new.id, left(new.reason, 200)
  from public.profiles a where a.is_admin;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_admins_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.notifications (user_id, type, ref_id, detail)
  select a.id, 'message', new.id, left(coalesce(nullif(new.name, ''), 'Someone') || ' • ' || coalesce(new.topic, 'message')
    || coalesce(' on ' || new.page_title, '') || ': ' || new.body, 200)
  from public.profiles a where a.is_admin;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_admins_submission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.notifications (user_id, actor_id, type, ref_id, detail)
  select a.id, new.user_id, 'submission', new.id, left(new.title || coalesce(' (' || new.year || ')', ''), 200)
  from public.profiles a where a.is_admin and a.id is distinct from new.user_id;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare told uuid[] := array[new.user_id]; r uuid; parent_author uuid;
begin
  if new.parent_id is not null then
    select user_id into parent_author from public.list_comments where id = new.parent_id;
    if parent_author is not null and not parent_author = any(told) then
      if new.film_id is not null then
        insert into public.notifications (user_id, actor_id, type, film_id, comment_id) values (parent_author, new.user_id, 'reply', new.film_id, new.id);
      else
        perform public.notify(parent_author, 'reply', new.user_id, new.list_id, new.id);
      end if;
      told := told || parent_author;
    end if;
  end if;
  for r in
    select distinct m.id from public.member_profiles m
    where m.handle in (select lower(rm.x[1]) from regexp_matches(new.body, '@([A-Za-z0-9_]{3,24})', 'g') as rm(x))
    limit 10
  loop
    if not r = any(told) then
      if new.film_id is not null then
        insert into public.notifications (user_id, actor_id, type, film_id, comment_id) values (r, new.user_id, 'mention', new.film_id, new.id);
      else
        perform public.notify(r, 'mention', new.user_id, new.list_id, new.id);
      end if;
      told := told || r;
    end if;
  end loop;
  if new.list_id is not null then
    for r in
      select user_id from public.lists where id = new.list_id
      union select user_id from public.list_members where list_id = new.list_id and status = 'active'
    loop
      if not r = any(told) then
        perform public.notify(r, 'comment', new.user_id, new.list_id, new.id);
        told := told || r;
      end if;
    end loop;
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_featured()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.featured and not old.featured and new.user_id is distinct from auth.uid() then
    insert into public.notifications (user_id, actor_id, type, list_id) values (new.user_id, auth.uid(), 'featured', new.id);
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_new_film(fid uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into public.notifications (user_id, type, film_id, person_id)
  select distinct on (fo.user_id) fo.user_id, 'new_film', fid, fo.person_id
  from public.credits c
  join public.follows fo on fo.person_id = c.person_id
  join public.profiles pr on pr.id = fo.user_id
  join public.films f on f.id = c.film_id and f.status = 'published'
  where c.film_id = fid and c.role = 'director'
    and not exists (select 1 from public.notifications n where n.user_id = fo.user_id and n.type = 'new_film' and n.film_id = fid)
  order by fo.user_id, c.sort nulls last;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_owner_new_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.notifications (user_id, actor_id, type, detail)
  select o.id, new.id, 'new_member', new.display_name from public.profiles o where o.is_owner and o.id <> new.id;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify(recipient uuid, kind text, actor uuid, lid uuid, cid uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if recipient is null or recipient = actor then return; end if;
  insert into public.notifications (user_id, actor_id, type, list_id, comment_id) values (recipient, actor, kind, lid, cid);
end $function$
;

CREATE OR REPLACE FUNCTION public.on_block()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.list_members m using public.lists l
    where l.id = m.list_id and ((l.user_id = new.blocker_id and m.user_id = new.blocked_id) or (l.user_id = new.blocked_id and m.user_id = new.blocker_id));
  delete from public.list_saves s using public.lists l
    where l.id = s.list_id and ((l.user_id = new.blocker_id and s.user_id = new.blocked_id) or (l.user_id = new.blocked_id and s.user_id = new.blocker_id));
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.on_director_credit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.role = 'director' then perform public.notify_new_film(new.film_id); end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.on_film_published()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    perform public.notify_new_film(new.id);
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.on_list_film_added()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.notifications (user_id, actor_id, type, list_id, film_id)
  select s.user_id, new.added_by, 'collection_film', new.list_id, new.film_id
  from public.list_saves s
  join public.lists l on l.id = s.list_id and l.is_public and not l.hidden
  join public.films f on f.id = new.film_id and f.status = 'published'
  join public.profiles pr on pr.id = s.user_id
  where s.list_id = new.list_id
    and s.user_id is distinct from new.added_by
    and not exists (select 1 from public.notifications n
      where n.user_id = s.user_id and n.type = 'collection_film' and n.list_id = new.list_id and n.film_id = new.film_id);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.refuse_banned_words()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare body_text text; w text;
begin
  if auth.uid() is null then return new; end if;
  if tg_table_name = 'list_comments' then
    if tg_op = 'UPDATE' and (new.body is not distinct from old.body or new.removed_at is not null) then return new; end if;
    body_text := new.body;
  elsif tg_table_name = 'profiles' then
    if tg_op = 'UPDATE' and new.bio is not distinct from old.bio then return new; end if;
    body_text := new.bio;
  elsif tg_table_name = 'lists' then
    if tg_op = 'UPDATE' and new.description is not distinct from old.description then return new; end if;
    body_text := new.description;
  else
    return new;
  end if;
  w := private.first_banned_word(body_text);
  if w is not null then
    raise exception '%', private.banned_word_message(w) using errcode = '23514';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.remove_collaborator(lid uuid, who uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); target uuid := coalesce(who, auth.uid()); was text; owner uuid;
begin
  select user_id into owner from public.lists where id = lid;
  if target <> me and owner is distinct from me then
    raise exception 'Only the owner can remove people.' using errcode = 'insufficient_privilege';
  end if;
  select status into was from public.list_members where list_id = lid and user_id = target;
  delete from public.list_members where list_id = lid and user_id = target and status <> 'declined';
  delete from public.notifications where list_id = lid and type in ('invite', 'request') and read_at is null
    and ((user_id = target and actor_id = owner) or (user_id = owner and actor_id = target));
  if target <> me and was = 'active' then perform public.notify(target, 'removed', me, lid); end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.remove_comment(cid uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.list_comments;
begin
  select * into c from public.list_comments where id = cid;
  if c.id is null then return 'gone'; end if;
  if not (c.user_id = auth.uid() or public.is_admin()
          or (not public.is_suspended(auth.uid()) and (
               exists (select 1 from public.lists where id = c.list_id and user_id = auth.uid())
            or exists (select 1 from public.list_members where list_id = c.list_id and user_id = auth.uid() and status = 'active')))) then
    raise exception 'You can''t remove this comment.' using errcode = 'insufficient_privilege';
  end if;
  if c.parent_id is null and exists (select 1 from public.list_comments where parent_id = cid) then
    update public.list_comments set removed_at = now(), body = 'removed' where id = cid;
    delete from public.comment_likes where comment_id = cid;
    update public.lists set pinned_comment_id = null where pinned_comment_id = cid;
    return 'removed';
  end if;
  delete from public.list_comments where id = cid;
  return 'deleted';
end $function$
;

CREATE OR REPLACE FUNCTION public.remove_film_from_watchlist(fid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  delete from public.list_films lf using public.lists l
    where lf.list_id = l.id and l.user_id = auth.uid() and lf.film_id = fid;
  delete from public.watchlist where user_id = auth.uid() and film_id = fid;
end $function$
;

CREATE OR REPLACE FUNCTION public.request_collaboration(lid uuid, message text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); owner uuid; cur public.list_members;
begin
  if me is null then raise exception 'Sign in first.' using errcode = 'insufficient_privilege'; end if;
  if public.is_suspended(me) then raise exception 'Your account is suspended.' using errcode = 'insufficient_privilege'; end if;
  select user_id into owner from public.lists where id = lid and is_public and not hidden;
  if owner is null then raise exception 'You can only ask to join public collections.' using errcode = 'insufficient_privilege'; end if;
  if owner = me then raise exception 'It''s your collection.' using errcode = 'check_violation'; end if;
  if not exists (select 1 from public.member_profiles where id = me) then
    raise exception 'Create your profile first.' using errcode = 'insufficient_privilege';
  end if;
  select * into cur from public.list_members where list_id = lid and user_id = me;
  if cur.status = 'active' then raise exception 'You already collaborate on this collection.' using errcode = 'unique_violation'; end if;
  if cur.status = 'invited' then raise exception 'You''re already invited: accept the invite instead.' using errcode = 'unique_violation'; end if;
  if cur.status = 'requested' then raise exception 'Your request is waiting for an answer.' using errcode = 'unique_violation'; end if;
  if cur.status = 'declined' and cur.responded_at > now() - interval '30 days' then
    raise exception 'You can ask again 30 days after a request is declined.' using errcode = 'check_violation';
  end if;
  if (select count(*) from pheelm_private.collaboration_requests where user_id = me and list_id = lid and created_at > now() - interval '1 day') >= 3
     or (select count(*) from pheelm_private.collaboration_requests where user_id = me and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'You''ve asked a few times already. Try again tomorrow.' using errcode = 'check_violation';
  end if;
  delete from pheelm_private.collaboration_requests where created_at < now() - interval '2 days';
  insert into pheelm_private.collaboration_requests (list_id, user_id) values (lid, me);
  insert into public.list_members (list_id, user_id, status, note, created_at, responded_at, invited_by)
  values (lid, me, 'requested', nullif(left(btrim(message), 280), ''), now(), null, null)
  on conflict (list_id, user_id) do update set status = 'requested', note = excluded.note, created_at = now(), responded_at = null, invited_by = null;
  perform public.notify(owner, 'request', me, lid);
  return 'requested';
end $function$
;

CREATE OR REPLACE FUNCTION public.respect_notification_preferences()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin if exists (select 1 from public.notification_preferences p where p.user_id = new.user_id and new.type = any(p.disabled_types)) then return null; end if; return new; end $function$
;

CREATE OR REPLACE FUNCTION public.respond_to_invite(lid uuid, accept boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); m public.list_members;
begin
  if accept and public.is_suspended(me) then raise exception 'Your account is suspended.' using errcode = 'insufficient_privilege'; end if;
  select * into m from public.list_members where list_id = lid and user_id = me and status = 'invited';
  if m.list_id is null then raise exception 'This invite is no longer open.' using errcode = 'no_data_found'; end if;
  update public.list_members set status = case when accept then 'active' else 'declined' end, responded_at = now()
  where list_id = lid and user_id = me;
  perform public.notify(coalesce(m.invited_by, (select user_id from public.lists where id = lid)),
    case when accept then 'invite_accepted' else 'invite_declined' end, me, lid);
  update public.notifications set read_at = now() where user_id = me and list_id = lid and type = 'invite' and read_at is null;
  return case when accept then 'active' else 'declined' end;
end $function$
;

CREATE OR REPLACE FUNCTION public.respond_to_request(lid uuid, who uuid, accept boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid();
begin
  if accept and public.is_suspended(me) then raise exception 'Your account is suspended.' using errcode = 'insufficient_privilege'; end if;
  if not exists (select 1 from public.lists where id = lid and user_id = me) then
    raise exception 'Only the owner can answer requests.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.list_members where list_id = lid and user_id = who and status = 'requested') then
    raise exception 'This request is no longer open.' using errcode = 'no_data_found';
  end if;
  if accept and (select count(*) from public.list_members where list_id = lid and status in ('active', 'invited')) >= 10 then
    raise exception 'A collection can have up to 10 collaborators.' using errcode = 'check_violation';
  end if;
  update public.list_members set status = case when accept then 'active' else 'declined' end, responded_at = now(), invited_by = me
  where list_id = lid and user_id = who;
  perform public.notify(who, case when accept then 'request_accepted' else 'request_declined' end, me, lid);
  update public.notifications set read_at = now() where user_id = me and list_id = lid and actor_id = who and type = 'request' and read_at is null;
  return case when accept then 'active' else 'declined' end;
end $function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.save_film_to_collection(fid uuid, lid uuid DEFAULT NULL::uuid, collection_title text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare target uuid := lid; owner_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if target is null then
    if collection_title is null or char_length(btrim(collection_title)) not between 1 and 80 then
      raise exception 'Enter a collection name.' using errcode = '22023';
    end if;
    insert into public.lists (user_id, title) values (auth.uid(), btrim(collection_title)) returning id into target;
  end if;
  select user_id into owner_id from public.lists where id = target;
  if owner_id is null then raise exception 'Collection not available.' using errcode = '42501'; end if;
  insert into public.list_films (list_id, film_id) values (target, fid) on conflict do nothing;
  if owner_id = auth.uid() then
    insert into public.watchlist (user_id, film_id) values (auth.uid(), fid) on conflict do nothing;
  end if;
  return target;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_admin(who uuid, make boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_owner() then raise exception 'Only the owner can change admins.'; end if;
  update public.profiles set is_admin = make where id = who and not is_owner;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_my_newsletter_subscription(want_subscribed boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare my_email text;
begin
 select lower(email) into my_email from auth.users where id = (select auth.uid());
 if my_email is null then raise exception 'Sign in to manage newsletter'; end if;
 if want_subscribed then
   insert into public.subscribers (email, source) values (my_email, 'settings') on conflict (email) do nothing;
 else
   delete from public.subscribers where lower(email) = my_email;
 end if;
 return want_subscribed;
end $function$
;

CREATE OR REPLACE FUNCTION public.shows_following(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.profiles where id = uid and not coalesce(is_private, false) and not hide_following);
$function$
;

CREATE OR REPLACE FUNCTION public.shows_watched(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.profiles where id = uid and not coalesce(is_private, false) and not hide_watched);
$function$
;

CREATE OR REPLACE FUNCTION public.skip_blocked_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.actor_id is not null and exists (select 1 from public.blocks where blocker_id = new.user_id and blocked_id = new.actor_id) then
    return null;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.stamp_film_publication()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.status='published' then
  if TG_OP='INSERT' then new.published_at=now();
  elsif old.status is distinct from 'published' then new.published_at=now();
  else new.published_at=old.published_at;
  end if;
 end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.sync_member_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if new.handle is null then delete from public.member_profiles where id=new.id;
 else
 insert into public.member_profiles(id,handle,display_name,is_private,country,bio,avatar_url,social_platform,social_url,website_url)
 values(new.id,new.handle,case when new.is_private then null else new.display_name end,new.is_private,
 case when new.is_private then null else new.country end,case when new.is_private then null else new.bio end,
 case when new.is_private then null else new.avatar_url end,case when new.is_private then null else new.social_platform end,
 case when new.is_private then null else new.social_url end,case when new.is_private then null else new.website_url end)
 on conflict(id) do update set handle=excluded.handle,display_name=excluded.display_name,is_private=excluded.is_private,
 country=excluded.country,bio=excluded.bio,avatar_url=excluded.avatar_url,social_platform=excluded.social_platform,social_url=excluded.social_url,website_url=excluded.website_url;
 end if;return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.sync_save_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    insert into public.list_save_counts (list_id, saves) values (new.list_id, 1)
    on conflict (list_id) do update set saves = public.list_save_counts.saves + 1;
  else
    update public.list_save_counts set saves = greatest(saves - 1, 0) where list_id = old.list_id;
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.worker_secret_ok(token text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(length(token) >= 24 and token = (select decrypted_secret from vault.decrypted_secrets where name = 'pheelm_worker_secret'), false);
$function$
;

alter table pheelm_email.catalog_additions add constraint catalog_additions_pkey PRIMARY KEY (kind, entity_id);
alter table pheelm_email.events add constraint events_pkey PRIMARY KEY (id);
alter table pheelm_email.outbox add constraint outbox_event_key_key UNIQUE (event_key);
alter table pheelm_email.outbox add constraint outbox_pkey PRIMARY KEY (id);
alter table pheelm_email.outbox add constraint outbox_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'suppressed'::text])));
alter table pheelm_email.subscriptions add constraint subscriptions_pkey PRIMARY KEY (email);
alter table pheelm_email.subscriptions add constraint subscriptions_token_key UNIQUE (token);
alter table pheelm_email.suppressions add constraint suppressions_pkey PRIMARY KEY (email);
alter table pheelm_private.collaboration_requests add constraint collaboration_requests_pkey PRIMARY KEY (id);
alter table private.banned_words add constraint banned_words_kind_check CHECK ((kind = ANY (ARRAY['swearing'::text, 'sexist'::text, 'racist'::text, 'antisemitic'::text, 'homophobic'::text, 'transphobic'::text, 'ableist'::text])));
alter table private.banned_words add constraint banned_words_pkey PRIMARY KEY (word);
alter table private.banned_words add constraint banned_words_word_check CHECK ((word ~ '^[a-z]+( [a-z]+)*$'::text));
alter table private.moderation_refusals add constraint moderation_refusals_excerpt_check CHECK ((length(excerpt) <= 300));
alter table private.moderation_refusals add constraint moderation_refusals_field_check CHECK ((field = ANY (ARRAY['comment'::text, 'bio'::text, 'watchlist_description'::text])));
alter table private.moderation_refusals add constraint moderation_refusals_pkey PRIMARY KEY (id);
alter table private.moderation_refusals add constraint moderation_refusals_reason_check CHECK ((length(reason) <= 200));
alter table public.admin_activity add constraint admin_activity_pkey PRIMARY KEY (id);
alter table public.blocks add constraint blocks_check CHECK ((blocker_id <> blocked_id));
alter table public.blocks add constraint blocks_pkey PRIMARY KEY (blocker_id, blocked_id);
alter table public.catalog_version add constraint catalog_version_id_check CHECK ((id = 1));
alter table public.catalog_version add constraint catalog_version_pkey PRIMARY KEY (id);
alter table public.collection_films add constraint collection_films_pkey PRIMARY KEY (collection_id, film_id);
alter table public.collections add constraint collections_kind_check CHECK ((kind = ANY (ARRAY['country'::text, 'decade'::text, 'movement'::text, 'theme'::text, 'genre'::text])));
alter table public.collections add constraint collections_pkey PRIMARY KEY (id);
alter table public.collections add constraint collections_slug_key UNIQUE (slug);
alter table public.comment_likes add constraint comment_likes_pkey PRIMARY KEY (comment_id, user_id);
alter table public.comment_reports add constraint comment_reports_pkey PRIMARY KEY (id);
alter table public.comment_reports add constraint comment_reports_reason_check CHECK ((char_length(reason) <= 500));
alter table public.credits add constraint credits_pkey PRIMARY KEY (film_id, person_id, role);
alter table public.credits add constraint credits_role_check CHECK ((role = ANY (ARRAY['director'::text, 'writer'::text, 'producer'::text, 'cinematographer'::text, 'editor'::text, 'composer'::text, 'cast'::text])));
alter table public.director_bio_jobs add constraint director_bio_jobs_attempts_check CHECK ((attempts >= 0));
alter table public.director_bio_jobs add constraint director_bio_jobs_pkey PRIMARY KEY (person_id);
alter table public.director_bio_jobs add constraint director_bio_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'review'::text, 'done'::text, 'skipped'::text, 'failed'::text])));
alter table public.email_preferences add constraint email_preferences_digest_frequency_check CHECK ((digest_frequency = ANY (ARRAY['off'::text, 'daily'::text, 'weekly'::text])));
alter table public.email_preferences add constraint email_preferences_pkey PRIMARY KEY (user_id);
alter table public.email_preferences add constraint email_preferences_unsubscribe_token_key UNIQUE (unsubscribe_token);
alter table public.film_editorial_versions add constraint film_editorial_versions_pkey PRIMARY KEY (id);
alter table public.film_editorials add constraint film_editorials_pkey PRIMARY KEY (film_id);
alter table public.film_editorials add constraint film_editorials_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])));
alter table public.film_queue add constraint film_queue_director_name_check CHECK ((char_length(director_name) <= 200));
alter table public.film_queue add constraint film_queue_pkey PRIMARY KEY (id);
alter table public.film_queue add constraint film_queue_synopsis_check CHECK ((char_length(synopsis) <= 10000));
alter table public.film_queue add constraint film_queue_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 300)));
alter table public.film_queue add constraint film_queue_year_check CHECK (((year >= 1880) AND (year <= 2100)));
alter table public.films add constraint films_color_check CHECK ((color ~ '^#[0-9a-fA-F]{6}$'::text));
alter table public.films add constraint films_pkey PRIMARY KEY (id);
alter table public.films add constraint films_slug_key UNIQUE (slug);
alter table public.films add constraint films_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])));
alter table public.films add constraint films_tmdb_id_key UNIQUE (tmdb_id);
alter table public.films add constraint films_type_check CHECK ((type = ANY (ARRAY['feature'::text, 'documentary'::text, 'short'::text, 'animation'::text])));
alter table public.films add constraint films_year_check CHECK (((year >= 1890) AND (year <= 2100)));
alter table public.follows add constraint follows_pkey PRIMARY KEY (user_id, person_id);
alter table public.list_comments add constraint list_comments_body_check CHECK (((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 1000)));
alter table public.list_comments add constraint list_comments_one_target CHECK ((num_nonnulls(list_id, film_id) = 1));
alter table public.list_comments add constraint list_comments_pkey PRIMARY KEY (id);
alter table public.list_films add constraint list_films_pkey PRIMARY KEY (list_id, film_id);
alter table public.list_members add constraint list_members_note_check CHECK ((char_length(note) <= 280));
alter table public.list_members add constraint list_members_pkey PRIMARY KEY (list_id, user_id);
alter table public.list_members add constraint list_members_status_check CHECK ((status = ANY (ARRAY['invited'::text, 'requested'::text, 'active'::text, 'declined'::text])));
alter table public.list_reports add constraint list_reports_pkey PRIMARY KEY (id);
alter table public.list_reports add constraint list_reports_reason_check CHECK (((length(reason) >= 1) AND (length(reason) <= 500)));
alter table public.list_save_counts add constraint list_save_counts_pkey PRIMARY KEY (list_id);
alter table public.list_saves add constraint list_saves_pkey PRIMARY KEY (list_id, user_id);
alter table public.lists add constraint lists_description_check CHECK ((char_length(description) <= 10000));
alter table public.lists add constraint lists_pkey PRIMARY KEY (id);
alter table public.lists add constraint lists_slug_format CHECK (((length(slug) <= 120) AND (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)));
alter table public.lists add constraint lists_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 80)));
alter table public.member_follows add constraint member_follows_no_self CHECK ((follower_id <> followed_id));
alter table public.member_follows add constraint member_follows_pkey PRIMARY KEY (follower_id, followed_id);
alter table public.member_profiles add constraint member_profiles_handle_key UNIQUE (handle);
alter table public.member_profiles add constraint member_profiles_pkey PRIMARY KEY (id);
alter table public.message_replies add constraint message_replies_body_check CHECK (((length(btrim(body)) >= 1) AND (length(btrim(body)) <= 5000)));
alter table public.message_replies add constraint message_replies_pkey PRIMARY KEY (id);
alter table public.message_replies add constraint message_replies_via_check CHECK ((via = ANY (ARRAY['pheelm'::text, 'email'::text])));
alter table public.messages add constraint messages_body_check CHECK (((length(body) >= 1) AND (length(body) <= 5000)));
alter table public.messages add constraint messages_detail_lengths CHECK (((COALESCE(length(notes), 0) <= 10000) AND (COALESCE(length(partnership_type), 0) <= 100) AND (COALESCE(length(website), 0) <= 500)));
alter table public.messages add constraint messages_email_check CHECK (((email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text) AND (length(email) <= 254)));
alter table public.messages add constraint messages_name_check CHECK ((length(name) <= 200));
alter table public.messages add constraint messages_organization_check CHECK ((length(organization) <= 200));
alter table public.messages add constraint messages_page_check CHECK ((char_length(page) <= 500));
alter table public.messages add constraint messages_page_internal CHECK (((page IS NULL) OR (page ~ '^/([^/\\[:space:]][^\\[:space:]]*)?$'::text)));
alter table public.messages add constraint messages_page_title_check CHECK ((char_length(page_title) <= 200));
alter table public.messages add constraint messages_pkey PRIMARY KEY (id);
alter table public.messages add constraint messages_stage_check CHECK (((stage IS NULL) OR (stage = ANY (ARRAY['new'::text, 'talking'::text, 'accepted'::text, 'declined'::text]))));
alter table public.messages add constraint messages_status_check CHECK ((status = ANY (ARRAY['new'::text, 'open'::text, 'done'::text, 'spam'::text])));
alter table public.messages add constraint messages_topic_check CHECK ((topic = ANY (ARRAY['general'::text, 'feedback'::text, 'correction'::text, 'partnership'::text, 'press'::text, 'privacy'::text])));
alter table public.notification_preferences add constraint allowed_notification_types CHECK ((disabled_types <@ ARRAY['invite'::text, 'request'::text, 'invite_accepted'::text, 'invite_declined'::text, 'request_accepted'::text, 'request_declined'::text, 'removed'::text, 'comment'::text, 'reply'::text, 'mention'::text, 'new_film'::text, 'collection_film'::text, 'report'::text, 'comment_report'::text, 'submission'::text, 'message'::text, 'new_member'::text, 'featured'::text]));
alter table public.notification_preferences add constraint notification_preferences_pkey PRIMARY KEY (user_id);
alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table public.notifications add constraint notifications_type_check CHECK ((type = ANY (ARRAY['invite'::text, 'request'::text, 'invite_accepted'::text, 'invite_declined'::text, 'request_accepted'::text, 'request_declined'::text, 'removed'::text, 'comment'::text, 'reply'::text, 'mention'::text, 'new_film'::text, 'collection_film'::text, 'report'::text, 'comment_report'::text, 'submission'::text, 'message'::text, 'new_member'::text, 'featured'::text])));
alter table public.people add constraint people_pkey PRIMARY KEY (id);
alter table public.people add constraint people_slug_key UNIQUE (slug);
alter table public.people add constraint people_tmdb_id_key UNIQUE (tmdb_id);
alter table public.profiles add constraint profile_social_host CHECK (((social_url IS NULL) OR (social_url ~* (('^https://([a-z0-9-]+[.])*'::text ||
CASE social_platform
    WHEN 'instagram'::text THEN 'instagram[.]com'::text
    WHEN 'tiktok'::text THEN 'tiktok[.]com'::text
    WHEN 'youtube'::text THEN '(youtube[.]com|youtu[.]be)'::text
    WHEN 'threads'::text THEN '(threads[.]com|threads[.]net)'::text
    WHEN 'x'::text THEN '(x[.]com|twitter[.]com)'::text
    WHEN 'facebook'::text THEN '(facebook[.]com|fb[.]com)'::text
    WHEN 'bluesky'::text THEN 'bsky[.]app'::text
    WHEN 'linkedin'::text THEN 'linkedin[.]com'::text
    ELSE NULL::text
END) || '([/?#]|$)'::text))));
alter table public.profiles add constraint profile_social_pair CHECK (((social_platform IS NULL) = (social_url IS NULL)));
alter table public.profiles add constraint profile_social_platform CHECK (((social_platform IS NULL) OR (social_platform = ANY (ARRAY['instagram'::text, 'tiktok'::text, 'youtube'::text, 'threads'::text, 'x'::text, 'facebook'::text, 'bluesky'::text, 'linkedin'::text]))));
alter table public.profiles add constraint profile_social_url CHECK (((social_url IS NULL) OR ((char_length(social_url) <= 500) AND (social_url ~ '^https://[^[:space:]]+$'::text))));
alter table public.profiles add constraint profile_website_url CHECK (((website_url IS NULL) OR ((char_length(website_url) <= 500) AND (website_url ~ '^https?://[^[:space:]]+$'::text))));
alter table public.profiles add constraint profiles_avatar_own_path CHECK (((avatar_url IS NULL) OR (avatar_url ~ (('^https://mvhwfmlairwrngdttzjh[.]supabase[.]co/storage/v1/object/public/avatars/'::text || (id)::text) || '/[0-9a-f-]+[.]webp$'::text))));
alter table public.profiles add constraint profiles_bio_150_chars_except_leo CHECK ((COALESCE(((handle = 'leo'::text) AND is_owner), false) OR (char_length(bio) <= 150)));
alter table public.profiles add constraint profiles_country_code CHECK ((country ~ '^[A-Z]{2}$'::text));
alter table public.profiles add constraint profiles_display_name_length CHECK ((char_length(display_name) <= 60));
alter table public.profiles add constraint profiles_handle_format CHECK ((handle ~ '^[a-z0-9_]{3,24}$'::text));
alter table public.profiles add constraint profiles_handle_reserved CHECK ((handle <> ALL (ARRAY['admin'::text, 'administrator'::text, 'pheelm'::text, 'staff'::text, 'team'::text, 'support'::text, 'help'::text, 'official'::text, 'moderator'::text, 'mod'::text, 'root'::text, 'system'::text, 'security'::text, 'press'::text, 'contact'::text, 'about'::text, 'account'::text, 'login'::text, 'logout'::text, 'signin'::text, 'signup'::text, 'settings'::text, 'me'::text, 'api'::text, 'auth'::text, 'www'::text, 'mail'::text, 'directors'::text, 'films'::text, 'collections'::text, 'journal'::text, 'submit'::text])));
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_suspended_reason_length CHECK ((COALESCE(length(suspended_reason), 0) <= 500));
alter table public.search_misses add constraint search_misses_pkey PRIMARY KEY (q);
alter table public.search_misses add constraint search_misses_q_check CHECK (((char_length(q) >= 3) AND (char_length(q) <= 120)));
alter table public.submissions add constraint submissions_details_size CHECK (((details IS NULL) OR (pg_column_size(details) <= 32768)));
alter table public.submissions add constraint submissions_director_check CHECK (((char_length(director) >= 1) AND (char_length(director) <= 200)));
alter table public.submissions add constraint submissions_kind_check CHECK ((kind = ANY (ARRAY['suggestion'::text, 'own'::text])));
alter table public.submissions add constraint submissions_link_check CHECK ((char_length(link) <= 500));
alter table public.submissions add constraint submissions_link_web CHECK (((link IS NULL) OR (link ~* '^https?://[^[:space:]]+$'::text)));
alter table public.submissions add constraint submissions_note_check CHECK ((char_length(note) <= 2000));
alter table public.submissions add constraint submissions_pkey PRIMARY KEY (id);
alter table public.submissions add constraint submissions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
alter table public.submissions add constraint submissions_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 200)));
alter table public.submissions add constraint submissions_year_check CHECK (((year >= 1890) AND (year <= 2100)));
alter table public.subscribers add constraint subscribers_email_check CHECK (((email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text) AND (length(email) <= 254)));
alter table public.subscribers add constraint subscribers_pkey PRIMARY KEY (email);
alter table public.watched add constraint watched_pkey PRIMARY KEY (user_id, film_id);
alter table public.watchlist add constraint watchlist_pkey PRIMARY KEY (user_id, film_id);
alter table public.admin_activity add constraint admin_activity_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.blocks add constraint blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.blocks add constraint blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.collection_films add constraint collection_films_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;
alter table public.collection_films add constraint collection_films_film_id_fkey FOREIGN KEY (film_id) REFERENCES public.films(id) ON DELETE CASCADE;
alter table public.comment_likes add constraint comment_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.list_comments(id) ON DELETE CASCADE;
alter table public.comment_likes add constraint comment_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.comment_reports add constraint comment_reports_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.list_comments(id) ON DELETE CASCADE;
alter table public.comment_reports add constraint comment_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
alter table public.credits add constraint credits_film_id_fkey FOREIGN KEY (film_id) REFERENCES public.films(id) ON DELETE CASCADE;
alter table public.credits add constraint credits_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;
alter table public.director_bio_jobs add constraint director_bio_jobs_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;
alter table public.email_preferences add constraint email_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.film_editorial_versions add constraint film_editorial_versions_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.film_editorial_versions add constraint film_editorial_versions_film_id_fkey FOREIGN KEY (film_id) REFERENCES public.films(id) ON DELETE CASCADE;
alter table public.film_editorials add constraint film_editorials_film_id_fkey FOREIGN KEY (film_id) REFERENCES public.films(id) ON DELETE CASCADE;
alter table public.film_editorials add constraint film_editorials_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.film_queue add constraint film_queue_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.follows add constraint follows_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;
alter table public.follows add constraint follows_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.list_comments add constraint list_comments_film_id_fkey FOREIGN KEY (film_id) REFERENCES public.films(id) ON DELETE CASCADE;
alter table public.list_comments add constraint list_comments_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.lists(id) ON DELETE CASCADE;
alter table public.list_comments add constraint list_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.list_comments(id) ON DELETE CASCADE;
alter table public.list_comments add constraint list_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.list_films add constraint list_films_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
alter table public.list_films add constraint list_films_film_id_fkey FOREIGN KEY (film_id) REFERENCES public.films(id) ON DELETE CASCADE;
alter table public.list_films add constraint list_films_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.lists(id) ON DELETE CASCADE;
alter table public.list_members add constraint list_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
alter table public.list_members add constraint list_members_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.lists(id) ON DELETE CASCADE;
alter table public.list_members add constraint list_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.list_reports add constraint list_reports_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.lists(id) ON DELETE CASCADE;
alter table public.list_reports add constraint list_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.list_save_counts add constraint list_save_counts_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.lists(id) ON DELETE CASCADE;
alter table public.list_saves add constraint list_saves_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.lists(id) ON DELETE CASCADE;
alter table public.list_saves add constraint list_saves_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.lists add constraint lists_pinned_comment_id_fkey FOREIGN KEY (pinned_comment_id) REFERENCES public.list_comments(id) ON DELETE SET NULL;
alter table public.lists add constraint lists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.member_follows add constraint member_follows_followed_id_fkey FOREIGN KEY (followed_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.member_follows add constraint member_follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.member_profiles add constraint member_profiles_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.message_replies add constraint message_replies_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.message_replies add constraint message_replies_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;
alter table public.notification_preferences add constraint notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.list_comments(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_film_id_fkey FOREIGN KEY (film_id) REFERENCES public.films(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.lists(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_suspended_by_fkey FOREIGN KEY (suspended_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.submissions add constraint submissions_film_id_fkey FOREIGN KEY (film_id) REFERENCES public.films(id) ON DELETE SET NULL;
alter table public.submissions add constraint submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.submissions add constraint submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.watched add constraint watched_film_id_fkey FOREIGN KEY (film_id) REFERENCES public.films(id) ON DELETE CASCADE;
alter table public.watched add constraint watched_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.watchlist add constraint watchlist_film_id_fkey FOREIGN KEY (film_id) REFERENCES public.films(id) ON DELETE CASCADE;
alter table public.watchlist add constraint watchlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX catalog_additions_time ON pheelm_email.catalog_additions USING btree (added_at);
CREATE INDEX outbox_due ON pheelm_email.outbox USING btree (available_at) WHERE (state = ANY (ARRAY['pending'::text, 'processing'::text]));
CREATE INDEX outbox_recipient_created ON pheelm_email.outbox USING btree (lower(recipient), created_at DESC);
CREATE INDEX collaboration_requests_recent ON pheelm_private.collaboration_requests USING btree (user_id, created_at);
CREATE INDEX moderation_refusals_created ON private.moderation_refusals USING btree (created_at DESC);
CREATE INDEX admin_activity_actor_idx ON public.admin_activity USING btree (actor_id);
CREATE INDEX admin_activity_created_idx ON public.admin_activity USING btree (created_at DESC);
CREATE INDEX blocks_blocked_idx ON public.blocks USING btree (blocked_id);
CREATE INDEX collection_films_film_id_idx ON public.collection_films USING btree (film_id);
CREATE INDEX comment_likes_user_idx ON public.comment_likes USING btree (user_id);
CREATE INDEX comment_reports_comment_idx ON public.comment_reports USING btree (comment_id);
CREATE INDEX comment_reports_user_idx ON public.comment_reports USING btree (user_id);
CREATE INDEX credits_person_idx ON public.credits USING btree (person_id);
CREATE INDEX director_bio_jobs_pending_idx ON public.director_bio_jobs USING btree (status, next_attempt_at, created_at);
CREATE INDEX film_editorial_versions_edited_by_idx ON public.film_editorial_versions USING btree (edited_by);
CREATE INDEX film_editorial_versions_film_idx ON public.film_editorial_versions USING btree (film_id, created_at DESC);
CREATE INDEX film_editorials_updated_by_idx ON public.film_editorials USING btree (updated_by);
CREATE INDEX film_queue_created_by_idx ON public.film_queue USING btree (created_by);
CREATE UNIQUE INDEX film_queue_title_year ON public.film_queue USING btree (lower(title), COALESCE(year, 0));
CREATE INDEX films_year_idx ON public.films USING btree (year DESC, title);
CREATE INDEX follows_person_id_idx ON public.follows USING btree (person_id);
CREATE INDEX list_comments_film_idx ON public.list_comments USING btree (film_id, created_at) WHERE (film_id IS NOT NULL);
CREATE INDEX list_comments_list_idx ON public.list_comments USING btree (list_id, created_at);
CREATE INDEX list_comments_parent_idx ON public.list_comments USING btree (parent_id);
CREATE INDEX list_comments_user_created_idx ON public.list_comments USING btree (user_id, created_at DESC);
CREATE INDEX list_comments_user_idx ON public.list_comments USING btree (user_id);
CREATE INDEX list_films_added_by_idx ON public.list_films USING btree (added_by);
CREATE INDEX list_films_film_id_idx ON public.list_films USING btree (film_id);
CREATE INDEX list_members_invited_by_idx ON public.list_members USING btree (invited_by);
CREATE INDEX list_members_user_idx ON public.list_members USING btree (user_id, status);
CREATE INDEX list_reports_list_id_idx ON public.list_reports USING btree (list_id);
CREATE INDEX list_reports_user_id_idx ON public.list_reports USING btree (user_id);
CREATE INDEX list_saves_user_id_idx ON public.list_saves USING btree (user_id);
CREATE UNIQUE INDEX lists_legacy_slug_idx ON public.lists USING btree (legacy_slug) WHERE (legacy_slug IS NOT NULL);
CREATE INDEX lists_pinned_comment_idx ON public.lists USING btree (pinned_comment_id);
CREATE UNIQUE INDEX lists_slug_unique ON public.lists USING btree (slug);
CREATE INDEX lists_user_idx ON public.lists USING btree (user_id, created_at);
CREATE INDEX member_follows_followed_idx ON public.member_follows USING btree (followed_id);
CREATE INDEX message_replies_author_idx ON public.message_replies USING btree (author_id);
CREATE INDEX message_replies_message ON public.message_replies USING btree (message_id, created_at);
CREATE INDEX messages_created_idx ON public.messages USING btree (created_at);
CREATE INDEX messages_status_created ON public.messages USING btree (status, created_at DESC);
CREATE INDEX messages_topic_status ON public.messages USING btree (topic, status, created_at DESC);
CREATE INDEX notifications_actor_idx ON public.notifications USING btree (actor_id);
CREATE INDEX notifications_comment_idx ON public.notifications USING btree (comment_id);
CREATE INDEX notifications_film_idx ON public.notifications USING btree (film_id);
CREATE INDEX notifications_list_idx ON public.notifications USING btree (list_id);
CREATE INDEX notifications_person_idx ON public.notifications USING btree (person_id);
CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX profiles_handle_key ON public.profiles USING btree (handle);
CREATE INDEX profiles_suspended_by_idx ON public.profiles USING btree (suspended_by);
CREATE INDEX submissions_film_id_idx ON public.submissions USING btree (film_id);
CREATE INDEX submissions_reviewed_by_idx ON public.submissions USING btree (reviewed_by);
CREATE INDEX submissions_status_idx ON public.submissions USING btree (status, created_at DESC);
CREATE INDEX submissions_user_id_idx ON public.submissions USING btree (user_id);
CREATE INDEX subscribers_created_idx ON public.subscribers USING btree (created_at);
CREATE INDEX watched_film_idx ON public.watched USING btree (film_id);
CREATE INDEX watchlist_film_id_idx ON public.watchlist USING btree (film_id);

create or replace view pheelm_email.discoverable_catalog as
 SELECT 'film'::text AS kind,
    f.id AS entity_id,
    f.title,
    '/films/'::text || f.slug AS path
   FROM public.films f
  WHERE f.status = 'published'::text
UNION ALL
 SELECT DISTINCT 'director'::text AS kind,
    p.id AS entity_id,
    p.name AS title,
    '/directors/'::text || p.slug AS path
   FROM public.people p
     JOIN public.credits c ON c.person_id = p.id AND c.role = 'director'::text
     JOIN public.films f ON f.id = c.film_id AND f.status = 'published'::text
  WHERE p.in_directory IS DISTINCT FROM false
UNION ALL
 SELECT 'collection'::text AS kind,
    l.id AS entity_id,
    l.title,
    '/watchlists/'::text || l.slug AS path
   FROM public.lists l
     JOIN public.profiles p ON p.id = l.user_id
  WHERE l.is_public AND NOT l.hidden AND NOT COALESCE(p.is_private, false) AND p.handle IS NOT NULL AND (l.staff_pick OR (( SELECT count(*) AS count
           FROM public.list_films lf
             JOIN public.films f ON f.id = lf.film_id AND f.status = 'published'::text
          WHERE lf.list_id = l.id)) >= 5);

create or replace view public.admin_film_quality with (security_invoker=true) as
 SELECT f.id,
    f.slug,
    f.title,
    f.year,
    f.status,
    issues.issues,
    cardinality(issues.issues) AS issue_count
   FROM public.films f
     LEFT JOIN public.film_editorials e ON e.film_id = f.id
     CROSS JOIN LATERAL ( SELECT array_remove(ARRAY[
                CASE
                    WHEN NULLIF(btrim(COALESCE(f.poster_url, ''::text)), ''::text) IS NULL THEN 'poster'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN NULLIF(btrim(COALESCE(f.synopsis, ''::text)), ''::text) IS NULL THEN 'synopsis'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN NOT (EXISTS ( SELECT 1
                       FROM public.credits c
                      WHERE c.film_id = f.id AND c.role = 'director'::text)) THEN 'director'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN cardinality(f.countries) = 0 OR f.countries IS NULL THEN 'country'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN cardinality(f.languages) = 0 OR f.languages IS NULL THEN 'language'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN f.runtime IS NULL THEN 'runtime'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN f.tmdb_id IS NULL THEN 'tmdb'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN e.status IS DISTINCT FROM 'published'::text THEN 'editorial'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN (EXISTS ( SELECT 1
                       FROM public.films other
                      WHERE other.id <> f.id AND other.year = f.year AND lower(regexp_replace(other.title, '[^a-zA-Z0-9]'::text, ''::text, 'g'::text)) = lower(regexp_replace(f.title, '[^a-zA-Z0-9]'::text, ''::text, 'g'::text)))) THEN 'duplicate'::text
                    ELSE NULL::text
                END], NULL::text) AS issues) issues
  WHERE ( SELECT public.is_admin() AS is_admin);

create or replace view public.admin_people_quality with (security_invoker=true) as
 SELECT p.id,
    p.name,
    p.slug,
    p.country,
    p.bio,
    p.photo_url,
    p.tmdb_id,
    count(c.film_id) FILTER (WHERE c.role = 'director'::text)::integer AS directed,
    count(c.film_id)::integer AS credits
   FROM public.people p
     LEFT JOIN public.credits c ON c.person_id = p.id
  WHERE ( SELECT public.is_admin() AS is_admin)
  GROUP BY p.id;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER pheelm_email_account AFTER INSERT OR DELETE OR UPDATE OF email_confirmed_at, email ON auth.users FOR EACH ROW EXECUTE FUNCTION pheelm_email.account_event();

CREATE TRIGGER block_cleanup AFTER INSERT ON public.blocks FOR EACH ROW EXECUTE FUNCTION public.on_block();

CREATE TRIGGER remove_blocked_member_follows AFTER INSERT ON public.blocks FOR EACH ROW EXECUTE FUNCTION private.remove_blocked_member_follows();

CREATE TRIGGER bump_catalog_version AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.collection_films FOR EACH STATEMENT EXECUTE FUNCTION pheelm_private.bump_catalog_version();

CREATE TRIGGER bump_catalog_version AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.collections FOR EACH STATEMENT EXECUTE FUNCTION pheelm_private.bump_catalog_version();

CREATE TRIGGER block_suspended_writes BEFORE INSERT OR UPDATE ON public.comment_likes FOR EACH ROW EXECUTE FUNCTION public.block_suspended_writes();

CREATE TRIGGER comment_report_notify AFTER INSERT ON public.comment_reports FOR EACH ROW EXECUTE FUNCTION public.notify_admins_comment_report();

CREATE TRIGGER limit_comment_reports BEFORE INSERT ON public.comment_reports FOR EACH ROW EXECUTE FUNCTION pheelm_private.limit_inserts('20', '120', '1 hour', 'user_id');

CREATE TRIGGER bump_catalog_version AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.credits FOR EACH STATEMENT EXECUTE FUNCTION pheelm_private.bump_catalog_version();

CREATE TRIGGER director_credit_notify AFTER INSERT ON public.credits FOR EACH ROW EXECUTE FUNCTION public.on_director_credit();

CREATE TRIGGER reset_digest_cursor BEFORE UPDATE OF digest_frequency ON public.email_preferences FOR EACH ROW EXECUTE FUNCTION pheelm_email.reset_digest_cursor();

CREATE TRIGGER bump_catalog_version AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.films FOR EACH STATEMENT EXECUTE FUNCTION pheelm_private.bump_catalog_version();

CREATE TRIGGER film_published_notify AFTER INSERT OR UPDATE OF status ON public.films FOR EACH ROW EXECUTE FUNCTION public.on_film_published();

CREATE TRIGGER stamp_film_publication BEFORE INSERT OR UPDATE OF status ON public.films FOR EACH ROW EXECUTE FUNCTION public.stamp_film_publication();

CREATE TRIGGER block_suspended_writes BEFORE INSERT OR UPDATE ON public.list_comments FOR EACH ROW EXECUTE FUNCTION public.block_suspended_writes();

CREATE TRIGGER blocked_comment_guard BEFORE INSERT ON public.list_comments FOR EACH ROW EXECUTE FUNCTION public.guard_blocked_comment();

CREATE TRIGGER guard_comment BEFORE INSERT OR UPDATE ON public.list_comments FOR EACH ROW EXECUTE FUNCTION public.guard_comment();

CREATE TRIGGER notify_comment AFTER INSERT ON public.list_comments FOR EACH ROW EXECUTE FUNCTION public.notify_comment();

CREATE TRIGGER refuse_banned_words BEFORE INSERT OR UPDATE ON public.list_comments FOR EACH ROW EXECUTE FUNCTION public.refuse_banned_words();

CREATE TRIGGER block_suspended_writes BEFORE INSERT OR UPDATE ON public.list_films FOR EACH ROW EXECUTE FUNCTION public.block_suspended_writes();

CREATE TRIGGER list_film_added_notify AFTER INSERT ON public.list_films FOR EACH ROW EXECUTE FUNCTION public.on_list_film_added();

CREATE TRIGGER blocked_member_guard BEFORE INSERT ON public.list_members FOR EACH ROW EXECUTE FUNCTION public.guard_blocked_member();

CREATE TRIGGER limit_list_reports BEFORE INSERT ON public.list_reports FOR EACH ROW EXECUTE FUNCTION pheelm_private.limit_inserts('10', '60', '1 hour', 'user_id');

CREATE TRIGGER list_report_notify AFTER INSERT ON public.list_reports FOR EACH ROW EXECUTE FUNCTION public.notify_admins_list_report();

CREATE TRIGGER sync_save_count AFTER INSERT OR DELETE ON public.list_saves FOR EACH ROW EXECUTE FUNCTION public.sync_save_count();

CREATE TRIGGER assign_watchlist_slug BEFORE INSERT OR UPDATE OF slug ON public.lists FOR EACH ROW EXECUTE FUNCTION pheelm_private.assign_watchlist_slug();

CREATE TRIGGER block_suspended_writes BEFORE INSERT OR UPDATE ON public.lists FOR EACH ROW EXECUTE FUNCTION public.block_suspended_writes();

CREATE TRIGGER guard_list_flags BEFORE INSERT OR UPDATE ON public.lists FOR EACH ROW EXECUTE FUNCTION public.guard_list_flags();

CREATE TRIGGER guard_list_owner_fields BEFORE UPDATE ON public.lists FOR EACH ROW EXECUTE FUNCTION public.guard_list_owner_fields();

CREATE TRIGGER limit_lists BEFORE INSERT ON public.lists FOR EACH ROW EXECUTE FUNCTION pheelm_private.limit_inserts('60', '5000', '1 day', 'user_id');

CREATE TRIGGER list_featured_notify AFTER UPDATE OF featured ON public.lists FOR EACH ROW EXECUTE FUNCTION public.notify_featured();

CREATE TRIGGER refuse_banned_words BEFORE INSERT OR UPDATE ON public.lists FOR EACH ROW EXECUTE FUNCTION public.refuse_banned_words();

CREATE TRIGGER limit_messages BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION pheelm_private.limit_inserts('5', '120', '1 hour', 'email');

CREATE TRIGGER message_notify AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_admins_message();

CREATE TRIGGER messages_keep_state BEFORE INSERT OR UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.messages_keep_state();

CREATE TRIGGER pheelm_email_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION pheelm_email.message_event();

CREATE TRIGGER blocked_notification_skip BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.skip_blocked_notification();

CREATE TRIGGER pheelm_email_notification AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION pheelm_email.notification_event();

CREATE TRIGGER respect_notification_preferences BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.respect_notification_preferences();

CREATE TRIGGER bump_catalog_version AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.people FOR EACH STATEMENT EXECUTE FUNCTION pheelm_private.bump_catalog_version();

CREATE TRIGGER guard_profile_moderation BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION pheelm_private.guard_profile_moderation();

CREATE TRIGGER new_member_notify AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.notify_owner_new_member();

CREATE TRIGGER pheelm_email_member_notice AFTER UPDATE OF is_admin, suspended_at ON public.profiles FOR EACH ROW EXECUTE FUNCTION pheelm_email.member_notice();

CREATE TRIGGER refuse_banned_words BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.refuse_banned_words();

CREATE TRIGGER sync_member_profile AFTER INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_member_profile();

CREATE TRIGGER block_suspended_writes BEFORE INSERT OR UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.block_suspended_writes();

CREATE TRIGGER limit_submissions BEFORE INSERT ON public.submissions FOR EACH ROW EXECUTE FUNCTION pheelm_private.limit_inserts('20', '300', '1 day', 'user_id');

CREATE TRIGGER pheelm_email_submission AFTER INSERT OR UPDATE OF status ON public.submissions FOR EACH ROW EXECUTE FUNCTION pheelm_email.submission_event();

CREATE TRIGGER submission_notify AFTER INSERT ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.notify_admins_submission();

CREATE TRIGGER limit_subscribers BEFORE INSERT ON public.subscribers FOR EACH ROW EXECUTE FUNCTION pheelm_private.limit_inserts('0', '300', '1 hour', '');

CREATE TRIGGER pheelm_email_newsletter AFTER INSERT OR DELETE ON public.subscribers FOR EACH ROW EXECUTE FUNCTION pheelm_email.newsletter_event();

alter table pheelm_email.catalog_additions enable row level security;

alter table pheelm_email.events enable row level security;

alter table pheelm_email.outbox enable row level security;

alter table pheelm_email.subscriptions enable row level security;

alter table pheelm_email.suppressions enable row level security;

alter table pheelm_private.collaboration_requests enable row level security;

alter table public.admin_activity enable row level security;

alter table public.blocks enable row level security;

alter table public.catalog_version enable row level security;

alter table public.collection_films enable row level security;

alter table public.collections enable row level security;

alter table public.comment_likes enable row level security;

alter table public.comment_reports enable row level security;

alter table public.credits enable row level security;

alter table public.director_bio_jobs enable row level security;

alter table public.email_preferences enable row level security;

alter table public.film_editorial_versions enable row level security;

alter table public.film_editorials enable row level security;

alter table public.film_queue enable row level security;

alter table public.films enable row level security;

alter table public.follows enable row level security;

alter table public.list_comments enable row level security;

alter table public.list_films enable row level security;

alter table public.list_members enable row level security;

alter table public.list_reports enable row level security;

alter table public.list_save_counts enable row level security;

alter table public.list_saves enable row level security;

alter table public.lists enable row level security;

alter table public.member_follows enable row level security;

alter table public.member_profiles enable row level security;

alter table public.message_replies enable row level security;

alter table public.messages enable row level security;

alter table public.notification_preferences enable row level security;

alter table public.notifications enable row level security;

alter table public.people enable row level security;

alter table public.profiles enable row level security;

alter table public.search_misses enable row level security;

alter table public.submissions enable row level security;

alter table public.subscribers enable row level security;

alter table public.watched enable row level security;

alter table public.watchlist enable row level security;

create policy "Admins read activity" on public.admin_activity as permissive for select to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy "Admins record activity" on public.admin_activity as permissive for insert to authenticated with check ((( SELECT public.is_admin() AS is_admin) AND (actor_id = ( SELECT auth.uid() AS uid))));
create policy "own blocks" on public.blocks as permissive for all to public using ((blocker_id = ( SELECT auth.uid() AS uid))) with check ((blocker_id = ( SELECT auth.uid() AS uid)));
create policy "anyone can read the catalog version" on public.catalog_version as permissive for select to anon, authenticated using (true);
create policy "admin delete" on public.collection_films as permissive for delete to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy "admin insert" on public.collection_films as permissive for insert to authenticated with check (( SELECT public.is_admin() AS is_admin));
create policy "admin update" on public.collection_films as permissive for update to authenticated using (( SELECT public.is_admin() AS is_admin)) with check (( SELECT public.is_admin() AS is_admin));
create policy read on public.collection_films as permissive for select to anon, authenticated using (true);
create policy "admin delete" on public.collections as permissive for delete to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy "admin insert" on public.collections as permissive for insert to authenticated with check (( SELECT public.is_admin() AS is_admin));
create policy "admin update" on public.collections as permissive for update to authenticated using (( SELECT public.is_admin() AS is_admin)) with check (( SELECT public.is_admin() AS is_admin));
create policy read on public.collections as permissive for select to anon, authenticated using (true);
create policy "like" on public.comment_likes as permissive for insert to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.list_comments c
  WHERE (c.id = comment_likes.comment_id)))));
create policy "read likes" on public.comment_likes as permissive for select to anon, authenticated using ((EXISTS ( SELECT 1
   FROM public.list_comments c
  WHERE (c.id = comment_likes.comment_id))));
create policy unlike on public.comment_likes as permissive for delete to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "admins delete comment reports" on public.comment_reports as permissive for delete to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy "admins read comment reports" on public.comment_reports as permissive for select to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy "admins update comment reports" on public.comment_reports as permissive for update to authenticated using (( SELECT public.is_admin() AS is_admin)) with check (( SELECT public.is_admin() AS is_admin));
create policy "report comments" on public.comment_reports as permissive for insert to authenticated with check (((resolved = false) AND (user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.list_comments c
  WHERE (c.id = comment_reports.comment_id)))));
create policy "admin delete" on public.credits as permissive for delete to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy "admin insert" on public.credits as permissive for insert to authenticated with check (( SELECT public.is_admin() AS is_admin));
create policy "admin update" on public.credits as permissive for update to authenticated using (( SELECT public.is_admin() AS is_admin)) with check (( SELECT public.is_admin() AS is_admin));
create policy read on public.credits as permissive for select to anon, authenticated using (true);
create policy "Admin-only biography job review" on public.director_bio_jobs as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM public.profiles viewer
  WHERE ((viewer.id = ( SELECT auth.uid() AS uid)) AND (viewer.is_admin = true)))));
create policy "Insert own email preferences" on public.email_preferences as permissive for insert to authenticated with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "Read own email preferences" on public.email_preferences as permissive for select to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "Update own email preferences" on public.email_preferences as permissive for update to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "Admins read editorial revisions" on public.film_editorial_versions as permissive for select to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy "Admins record editorial revisions" on public.film_editorial_versions as permissive for insert to authenticated with check ((( SELECT public.is_admin() AS is_admin) AND (edited_by = ( SELECT auth.uid() AS uid))));
create policy "Admins create editorials" on public.film_editorials as permissive for insert to authenticated with check (( SELECT public.is_admin() AS is_admin));
create policy "Admins edit editorials" on public.film_editorials as permissive for update to authenticated using (( SELECT public.is_admin() AS is_admin)) with check (( SELECT public.is_admin() AS is_admin));
create policy "Published editorials visible" on public.film_editorials as permissive for select to anon, authenticated using (((status = 'published'::text) OR ( SELECT public.is_admin() AS is_admin)));
create policy "admins manage the film queue" on public.film_queue as permissive for all to authenticated using (( SELECT public.is_admin() AS is_admin)) with check (( SELECT public.is_admin() AS is_admin));
create policy "admin delete" on public.films as permissive for delete to authenticated using (( SELECT public.is_owner() AS is_owner));
create policy "admin insert" on public.films as permissive for insert to authenticated with check (( SELECT public.is_admin() AS is_admin));
create policy "admin update" on public.films as permissive for update to authenticated using (( SELECT public.is_admin() AS is_admin)) with check (( SELECT public.is_admin() AS is_admin));
create policy read on public.films as permissive for select to anon, authenticated using (((status = 'published'::text) OR ( SELECT public.is_admin() AS is_admin)));
create policy "add follows" on public.follows as permissive for insert to authenticated with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "change follows" on public.follows as permissive for update to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "read follows" on public.follows as permissive for select to anon, authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR public.shows_following(user_id)));
create policy "remove follows" on public.follows as permissive for delete to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "delete comments" on public.list_comments as permissive for delete to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin) OR ((list_id IS NOT NULL) AND public.can_edit_list(list_id))));
create policy "edit own comments" on public.list_comments as permissive for update to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) AND (removed_at IS NULL))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "post comments" on public.list_comments as permissive for insert to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.member_profiles m
  WHERE (m.id = ( SELECT auth.uid() AS uid)))) AND (((list_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.lists l
  WHERE ((l.id = list_comments.list_id) AND l.is_public AND (NOT l.hidden) AND l.comments_enabled)))) OR ((film_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.films f
  WHERE ((f.id = list_comments.film_id) AND (f.status = 'published'::text))))))));
create policy "read comments" on public.list_comments as permissive for select to anon, authenticated using ((((list_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.lists l
  WHERE (l.id = list_comments.list_id)))) OR ((film_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.films f
  WHERE (f.id = list_comments.film_id))))));
create policy "delete own list films" on public.list_films as permissive for delete to authenticated using (public.can_edit_list(list_id));
create policy "insert own list films" on public.list_films as permissive for insert to authenticated with check ((public.can_edit_list(list_id) AND (added_by = ( SELECT auth.uid() AS uid))));
create policy "read list films" on public.list_films as permissive for select to anon, authenticated using ((EXISTS ( SELECT 1
   FROM public.lists l
  WHERE (l.id = list_films.list_id))));
create policy "update own list films" on public.list_films as permissive for update to authenticated using (public.can_edit_list(list_id)) with check (public.can_edit_list(list_id));
create policy "read members" on public.list_members as permissive for select to anon, authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin) OR public.is_list_owner(list_id) OR ((status = 'active'::text) AND (EXISTS ( SELECT 1
   FROM public.lists l
  WHERE (l.id = list_members.list_id))))));
create policy "admins delete reports" on public.list_reports as permissive for delete to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy "admins read reports" on public.list_reports as permissive for select to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy "admins update reports" on public.list_reports as permissive for update to authenticated using (( SELECT public.is_admin() AS is_admin)) with check (( SELECT public.is_admin() AS is_admin));
create policy "members report" on public.list_reports as permissive for insert to authenticated with check (((resolved = false) AND (user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.lists l
  WHERE ((l.id = list_reports.list_id) AND l.is_public)))));
create policy "read save counts" on public.list_save_counts as permissive for select to anon, authenticated using (true);
create policy "read saves" on public.list_saves as permissive for select to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));
create policy "remove own saves" on public.list_saves as permissive for delete to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "save public lists" on public.list_saves as permissive for insert to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.lists l
  WHERE ((l.id = list_saves.list_id) AND l.is_public AND (NOT l.hidden))))));
create policy "delete own lists" on public.lists as permissive for delete to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_owner() AS is_owner)));
create policy "insert own lists" on public.lists as permissive for insert to authenticated with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "read lists" on public.lists as permissive for select to anon, authenticated using (((is_public AND (NOT hidden)) OR (user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin) OR public.is_list_collaborator(id)));
create policy "update lists" on public.lists as permissive for update to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin) OR public.is_list_collaborator(id))) with check (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin) OR public.is_list_collaborator(id)));
create policy "follow a public member" on public.member_follows as permissive for insert to authenticated with check (((follower_id = ( SELECT auth.uid() AS uid)) AND (NOT public.is_suspended(( SELECT auth.uid() AS uid))) AND (NOT public.is_suspended(followed_id)) AND (NOT public.is_blocked(follower_id, followed_id)) AND (EXISTS ( SELECT 1
   FROM public.member_profiles m
  WHERE (m.id = member_follows.follower_id))) AND (EXISTS ( SELECT 1
   FROM public.member_profiles m
  WHERE ((m.id = member_follows.followed_id) AND (NOT m.is_private))))));
create policy "read own member follows" on public.member_follows as permissive for select to authenticated using ((((( SELECT auth.uid() AS uid) = follower_id) OR (( SELECT auth.uid() AS uid) = followed_id)) AND (NOT public.is_blocked(follower_id, followed_id))));
create policy "unfollow a member" on public.member_follows as permissive for delete to authenticated using ((follower_id = ( SELECT auth.uid() AS uid)));
create policy "read member profiles" on public.member_profiles as permissive for select to anon, authenticated using (true);
create policy "Admins read replies" on public.message_replies as permissive for select to public using (public.is_admin());
create policy "Admins record replies" on public.message_replies as permissive for insert to public with check ((public.is_admin() AND (via = 'email'::text) AND (author_id = ( SELECT auth.uid() AS uid))));
create policy "Admins delete messages" on public.messages as permissive for delete to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy "Admins read messages" on public.messages as permissive for select to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy "Admins update messages" on public.messages as permissive for update to authenticated using (( SELECT public.is_admin() AS is_admin)) with check (( SELECT public.is_admin() AS is_admin));
create policy "insert own preferences" on public.notification_preferences as permissive for insert to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "read own preferences" on public.notification_preferences as permissive for select to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
create policy "update own preferences" on public.notification_preferences as permissive for update to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "clear own notifications" on public.notifications as permissive for delete to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "mark own notifications" on public.notifications as permissive for update to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "read own notifications" on public.notifications as permissive for select to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "admin delete" on public.people as permissive for delete to authenticated using (( SELECT public.is_owner() AS is_owner));
create policy "admin insert" on public.people as permissive for insert to authenticated with check (( SELECT public.is_admin() AS is_admin));
create policy "admin update" on public.people as permissive for update to authenticated using (( SELECT public.is_admin() AS is_admin)) with check (( SELECT public.is_admin() AS is_admin));
create policy read on public.people as permissive for select to anon, authenticated using (true);
create policy "read own profile" on public.profiles as permissive for select to authenticated using (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));
create policy "update own profile" on public.profiles as permissive for update to public using ((id = ( SELECT auth.uid() AS uid))) with check (((id = ( SELECT auth.uid() AS uid)) AND (is_admin = ( SELECT public.is_admin() AS is_admin)) AND (is_owner = ( SELECT public.is_owner() AS is_owner))));
create policy "Admins read search misses" on public.search_misses as permissive for select to public using (public.is_admin());
create policy "Admins update search misses" on public.search_misses as permissive for update to public using (public.is_admin());
create policy "add submission" on public.submissions as permissive for insert to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text) AND (reviewed_at IS NULL) AND (film_id IS NULL) AND (review_note IS NULL) AND (reviewed_by IS NULL)));
create policy "delete submissions" on public.submissions as permissive for delete to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy "read submissions" on public.submissions as permissive for select to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));
create policy "review submissions" on public.submissions as permissive for update to authenticated using (( SELECT public.is_admin() AS is_admin)) with check (( SELECT public.is_admin() AS is_admin));
create policy "Admins read subscribers" on public.subscribers as permissive for select to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy "Admins remove subscribers" on public.subscribers as permissive for delete to authenticated using (( SELECT public.is_owner() AS is_owner));
create policy "add watched" on public.watched as permissive for insert to public with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "read watched" on public.watched as permissive for select to public using (((user_id = ( SELECT auth.uid() AS uid)) OR public.shows_watched(user_id)));
create policy "remove watched" on public.watched as permissive for delete to public using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "own watchlist" on public.watchlist as permissive for all to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "admins add images" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'images'::text) AND public.is_admin()));
create policy "admins change images" on storage.objects as permissive for update to authenticated using (((bucket_id = 'images'::text) AND public.is_admin())) with check (((bucket_id = 'images'::text) AND public.is_admin()));
create policy "admins remove images" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'images'::text) AND public.is_admin()));
create policy "images are public" on storage.objects as permissive for select to public using ((bucket_id = 'images'::text));
create policy "members delete own avatars" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
create policy "members read own avatar objects" on storage.objects as permissive for select to authenticated using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
create policy "members upload own avatars" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (storage.extension(name) = 'webp'::text) AND (( SELECT count(*) AS count
   FROM storage.objects o
  WHERE ((o.bucket_id = 'avatars'::text) AND ((storage.foldername(o.name))[1] = (( SELECT auth.uid() AS uid))::text))) < 5)));

revoke all on table pheelm_email.catalog_additions from public, anon, authenticated;

revoke all on table pheelm_email.discoverable_catalog from public, anon, authenticated;

revoke all on table pheelm_email.events from public, anon, authenticated;

revoke all on table pheelm_email.outbox from public, anon, authenticated;

revoke all on table pheelm_email.subscriptions from public, anon, authenticated;

revoke all on table pheelm_email.suppressions from public, anon, authenticated;

revoke all on table pheelm_private.collaboration_requests from public, anon, authenticated;

revoke all on table private.banned_words from public, anon, authenticated;

revoke all on table private.moderation_refusals from public, anon, authenticated;
grant delete, insert, select on table private.moderation_refusals to service_role;

revoke all on table public.admin_activity from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.admin_activity to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.admin_activity to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.admin_activity to service_role;

revoke all on table public.admin_film_quality from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.admin_film_quality to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.admin_film_quality to service_role;

revoke all on table public.admin_people_quality from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.admin_people_quality to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.admin_people_quality to service_role;

revoke all on table public.blocks from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.blocks to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.blocks to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.blocks to service_role;

revoke all on table public.catalog_version from public, anon, authenticated;
grant select on table public.catalog_version to anon;
grant select on table public.catalog_version to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.catalog_version to service_role;

revoke all on table public.collection_films from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.collection_films to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.collection_films to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.collection_films to service_role;

revoke all on table public.collections from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.collections to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.collections to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.collections to service_role;

revoke all on table public.comment_likes from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.comment_likes to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.comment_likes to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.comment_likes to service_role;

revoke all on table public.comment_reports from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.comment_reports to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.comment_reports to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.comment_reports to service_role;

revoke all on table public.credits from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.credits to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.credits to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.credits to service_role;

revoke all on table public.director_bio_jobs from public, anon, authenticated;
grant select on table public.director_bio_jobs to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.director_bio_jobs to service_role;

revoke all on table public.email_preferences from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.email_preferences to service_role;

revoke all on table public.film_editorial_versions from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.film_editorial_versions to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.film_editorial_versions to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.film_editorial_versions to service_role;

revoke all on table public.film_editorials from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.film_editorials to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.film_editorials to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.film_editorials to service_role;

revoke all on table public.film_queue from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.film_queue to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.film_queue to service_role;

revoke all on table public.films from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.films to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.films to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.films to service_role;

revoke all on table public.follows from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.follows to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.follows to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.follows to service_role;

revoke all on table public.list_comments from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.list_comments to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.list_comments to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.list_comments to service_role;

revoke all on table public.list_films from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.list_films to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.list_films to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.list_films to service_role;

revoke all on table public.list_members from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.list_members to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.list_members to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.list_members to service_role;

revoke all on table public.list_reports from public, anon, authenticated;
grant delete, maintain, references, select, trigger, update on table public.list_reports to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.list_reports to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.list_reports to service_role;

revoke all on table public.list_save_counts from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.list_save_counts to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.list_save_counts to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.list_save_counts to service_role;

revoke all on table public.list_saves from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.list_saves to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.list_saves to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.list_saves to service_role;

revoke all on table public.lists from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.lists to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.lists to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.lists to service_role;

revoke all on table public.member_follows from public, anon, authenticated;
grant delete, select on table public.member_follows to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.member_follows to service_role;

revoke all on table public.member_profiles from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.member_profiles to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.member_profiles to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.member_profiles to service_role;

revoke all on table public.message_replies from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.message_replies to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.message_replies to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.message_replies to service_role;

revoke all on table public.messages from public, anon, authenticated;
grant delete, maintain, references, select, trigger, update on table public.messages to anon;
grant delete, maintain, references, select, trigger, update on table public.messages to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.messages to service_role;

revoke all on table public.notification_preferences from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.notification_preferences to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.notification_preferences to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.notification_preferences to service_role;

revoke all on table public.notifications from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.notifications to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.notifications to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.notifications to service_role;

revoke all on table public.people from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.people to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.people to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.people to service_role;

revoke all on table public.profiles from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.profiles to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.profiles to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.profiles to service_role;

revoke all on table public.search_misses from public, anon, authenticated;
grant select, update on table public.search_misses to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.search_misses to service_role;

revoke all on table public.submissions from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.submissions to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.submissions to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.submissions to service_role;

revoke all on table public.subscribers from public, anon, authenticated;
grant delete, maintain, references, select, trigger, update on table public.subscribers to anon;
grant delete, maintain, references, select, trigger, update on table public.subscribers to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.subscribers to service_role;

revoke all on table public.watched from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.watched to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.watched to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.watched to service_role;

revoke all on table public.watchlist from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, update on table public.watchlist to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.watchlist to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.watchlist to service_role;

revoke all on function pheelm_email.account_event() from public, anon, authenticated;

revoke all on function pheelm_email.digest_due(text,timestamp with time zone) from public, anon, authenticated;

revoke all on function pheelm_email.digest_items(timestamp with time zone,timestamp with time zone) from public, anon, authenticated;

revoke all on function pheelm_email.digest_message(timestamp with time zone,timestamp with time zone) from public, anon, authenticated;

revoke all on function pheelm_email.enqueue(text,uuid,text,text,text,text,text) from public, anon, authenticated;

revoke all on function pheelm_email.member_notice() from public, anon, authenticated;

revoke all on function pheelm_email.message_event() from public, anon, authenticated;

revoke all on function pheelm_email.newsletter_event() from public, anon, authenticated;

revoke all on function pheelm_email.notification_event() from public, anon, authenticated;

revoke all on function pheelm_email.reset_digest_cursor() from public, anon, authenticated;

revoke all on function pheelm_email.submission_event() from public, anon, authenticated;

revoke all on function pheelm_private.assign_watchlist_slug() from public, anon, authenticated;

revoke all on function pheelm_private.bump_catalog_version() from public, anon, authenticated;

revoke all on function pheelm_private.guard_profile_moderation() from public, anon, authenticated;
grant execute on function pheelm_private.guard_profile_moderation() to public;

revoke all on function pheelm_private.limit_inserts() from public, anon, authenticated;

revoke all on function private.banned_word_message(text) from public, anon, authenticated;
grant execute on function private.banned_word_message(text) to public;

revoke all on function private.first_banned_word(text) from public, anon, authenticated;
grant execute on function private.first_banned_word(text) to public;

revoke all on function private.remove_blocked_member_follows() from public, anon, authenticated;

revoke all on function private.words_for_matching(text) from public, anon, authenticated;
grant execute on function private.words_for_matching(text) to public;

revoke all on function public.admin_banned_words() from public, anon, authenticated;
grant execute on function public.admin_banned_words() to authenticated;
grant execute on function public.admin_banned_words() to service_role;

revoke all on function public.admin_film_facets() from public, anon, authenticated;
grant execute on function public.admin_film_facets() to authenticated;
grant execute on function public.admin_film_facets() to service_role;

revoke all on function public.admin_films_without_director() from public, anon, authenticated;
grant execute on function public.admin_films_without_director() to authenticated;
grant execute on function public.admin_films_without_director() to service_role;

revoke all on function public.admin_members() from public, anon, authenticated;
grant execute on function public.admin_members() to authenticated;
grant execute on function public.admin_members() to service_role;

revoke all on function public.admin_moderation_log(integer,integer) from public, anon, authenticated;
grant execute on function public.admin_moderation_log(integer,integer) to authenticated;
grant execute on function public.admin_moderation_log(integer,integer) to service_role;

revoke all on function public.admin_monthly_counts(integer) from public, anon, authenticated;
grant execute on function public.admin_monthly_counts(integer) to authenticated;
grant execute on function public.admin_monthly_counts(integer) to service_role;

revoke all on function public.admin_newsletter_counts() from public, anon, authenticated;
grant execute on function public.admin_newsletter_counts() to authenticated;
grant execute on function public.admin_newsletter_counts() to service_role;

revoke all on function public.admin_newsletter(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.admin_newsletter(text,text,integer,integer) to authenticated;
grant execute on function public.admin_newsletter(text,text,integer,integer) to service_role;

revoke all on function public.admin_remove_banned_word(text) from public, anon, authenticated;
grant execute on function public.admin_remove_banned_word(text) to authenticated;
grant execute on function public.admin_remove_banned_word(text) to service_role;

revoke all on function public.admin_remove_subscriber(text) from public, anon, authenticated;
grant execute on function public.admin_remove_subscriber(text) to authenticated;
grant execute on function public.admin_remove_subscriber(text) to service_role;

revoke all on function public.admin_save_banned_word(text,text,text) from public, anon, authenticated;
grant execute on function public.admin_save_banned_word(text,text,text) to authenticated;
grant execute on function public.admin_save_banned_word(text,text,text) to service_role;

revoke all on function public.admin_set_suspended(uuid,boolean,text,boolean) from public, anon, authenticated;
grant execute on function public.admin_set_suspended(uuid,boolean,text,boolean) to authenticated;
grant execute on function public.admin_set_suspended(uuid,boolean,text,boolean) to service_role;

revoke all on function public.block_suspended_writes() from public, anon, authenticated;
grant execute on function public.block_suspended_writes() to service_role;

revoke all on function public.can_edit_list(uuid) from public, anon, authenticated;
grant execute on function public.can_edit_list(uuid) to authenticated;
grant execute on function public.can_edit_list(uuid) to anon;
grant execute on function public.can_edit_list(uuid) to service_role;

revoke all on function public.check_text(text,text) from public, anon, authenticated;
grant execute on function public.check_text(text,text) to authenticated;
grant execute on function public.check_text(text,text) to service_role;

revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.delete_my_account() to service_role;

revoke all on function public.email_claim(integer) from public, anon, authenticated;
grant execute on function public.email_claim(integer) to service_role;

revoke all on function public.email_complete(uuid,uuid,text,text,boolean) from public, anon, authenticated;
grant execute on function public.email_complete(uuid,uuid,text,text,boolean) to service_role;

revoke all on function public.email_confirmed_subscribers() from public, anon, authenticated;
grant execute on function public.email_confirmed_subscribers() to authenticated;
grant execute on function public.email_confirmed_subscribers() to service_role;

revoke all on function public.email_delivery_config() from public, anon, authenticated;
grant execute on function public.email_delivery_config() to service_role;

revoke all on function public.email_digest_items(uuid,uuid) from public, anon, authenticated;
grant execute on function public.email_digest_items(uuid,uuid) to service_role;

revoke all on function public.email_job_preferences(uuid) from public, anon, authenticated;
grant execute on function public.email_job_preferences(uuid) to service_role;

revoke all on function public.email_prepare_digests() from public, anon, authenticated;
grant execute on function public.email_prepare_digests() to service_role;

revoke all on function public.email_record_event(text,text,text) from public, anon, authenticated;
grant execute on function public.email_record_event(text,text,text) to service_role;

revoke all on function public.email_reply_to_message(uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.email_reply_to_message(uuid,text,boolean) to authenticated;
grant execute on function public.email_reply_to_message(uuid,text,boolean) to service_role;

revoke all on function public.email_token_action(text,text) from public, anon, authenticated;
grant execute on function public.email_token_action(text,text) to service_role;

revoke all on function public.guard_blocked_comment() from public, anon, authenticated;
grant execute on function public.guard_blocked_comment() to service_role;

revoke all on function public.guard_blocked_member() from public, anon, authenticated;
grant execute on function public.guard_blocked_member() to service_role;

revoke all on function public.guard_comment() from public, anon, authenticated;
grant execute on function public.guard_comment() to service_role;

revoke all on function public.guard_list_flags() from public, anon, authenticated;
grant execute on function public.guard_list_flags() to service_role;

revoke all on function public.guard_list_owner_fields() from public, anon, authenticated;
grant execute on function public.guard_list_owner_fields() to service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

revoke all on function public.invite_collaborator(uuid,text) from public, anon, authenticated;
grant execute on function public.invite_collaborator(uuid,text) to authenticated;
grant execute on function public.invite_collaborator(uuid,text) to service_role;

revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to anon;
grant execute on function public.is_admin() to service_role;
grant execute on function public.is_admin() to public;

revoke all on function public.is_blocked(uuid,uuid) from public, anon, authenticated;
grant execute on function public.is_blocked(uuid,uuid) to service_role;

revoke all on function public.is_list_collaborator(uuid) from public, anon, authenticated;
grant execute on function public.is_list_collaborator(uuid) to authenticated;
grant execute on function public.is_list_collaborator(uuid) to anon;
grant execute on function public.is_list_collaborator(uuid) to service_role;

revoke all on function public.is_list_owner(uuid) from public, anon, authenticated;
grant execute on function public.is_list_owner(uuid) to authenticated;
grant execute on function public.is_list_owner(uuid) to anon;
grant execute on function public.is_list_owner(uuid) to service_role;

revoke all on function public.is_owner() from public, anon, authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_owner() to anon;
grant execute on function public.is_owner() to service_role;
grant execute on function public.is_owner() to public;

revoke all on function public.is_suspended(uuid) from public, anon, authenticated;
grant execute on function public.is_suspended(uuid) to authenticated;
grant execute on function public.is_suspended(uuid) to service_role;

revoke all on function public.log_search_miss(text) from public, anon, authenticated;
grant execute on function public.log_search_miss(text) to authenticated;
grant execute on function public.log_search_miss(text) to anon;
grant execute on function public.log_search_miss(text) to service_role;

revoke all on function public.messages_keep_state() from public, anon, authenticated;
grant execute on function public.messages_keep_state() to authenticated;
grant execute on function public.messages_keep_state() to anon;
grant execute on function public.messages_keep_state() to service_role;
grant execute on function public.messages_keep_state() to public;

revoke all on function public.notify_admins_comment_report() from public, anon, authenticated;
grant execute on function public.notify_admins_comment_report() to service_role;

revoke all on function public.notify_admins_list_report() from public, anon, authenticated;
grant execute on function public.notify_admins_list_report() to service_role;

revoke all on function public.notify_admins_message() from public, anon, authenticated;
grant execute on function public.notify_admins_message() to service_role;

revoke all on function public.notify_admins_submission() from public, anon, authenticated;
grant execute on function public.notify_admins_submission() to service_role;

revoke all on function public.notify_comment() from public, anon, authenticated;
grant execute on function public.notify_comment() to service_role;

revoke all on function public.notify_featured() from public, anon, authenticated;
grant execute on function public.notify_featured() to service_role;

revoke all on function public.notify_new_film(uuid) from public, anon, authenticated;
grant execute on function public.notify_new_film(uuid) to service_role;

revoke all on function public.notify_owner_new_member() from public, anon, authenticated;
grant execute on function public.notify_owner_new_member() to service_role;

revoke all on function public.notify(uuid,text,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.notify(uuid,text,uuid,uuid,uuid) to service_role;

revoke all on function public.on_block() from public, anon, authenticated;
grant execute on function public.on_block() to service_role;

revoke all on function public.on_director_credit() from public, anon, authenticated;
grant execute on function public.on_director_credit() to service_role;

revoke all on function public.on_film_published() from public, anon, authenticated;
grant execute on function public.on_film_published() to service_role;

revoke all on function public.on_list_film_added() from public, anon, authenticated;
grant execute on function public.on_list_film_added() to service_role;

revoke all on function public.refuse_banned_words() from public, anon, authenticated;
grant execute on function public.refuse_banned_words() to service_role;

revoke all on function public.remove_collaborator(uuid,uuid) from public, anon, authenticated;
grant execute on function public.remove_collaborator(uuid,uuid) to authenticated;
grant execute on function public.remove_collaborator(uuid,uuid) to service_role;

revoke all on function public.remove_comment(uuid) from public, anon, authenticated;
grant execute on function public.remove_comment(uuid) to authenticated;
grant execute on function public.remove_comment(uuid) to service_role;

revoke all on function public.remove_film_from_watchlist(uuid) from public, anon, authenticated;
grant execute on function public.remove_film_from_watchlist(uuid) to authenticated;
grant execute on function public.remove_film_from_watchlist(uuid) to service_role;

revoke all on function public.request_collaboration(uuid,text) from public, anon, authenticated;
grant execute on function public.request_collaboration(uuid,text) to authenticated;
grant execute on function public.request_collaboration(uuid,text) to service_role;

revoke all on function public.respect_notification_preferences() from public, anon, authenticated;
grant execute on function public.respect_notification_preferences() to service_role;

revoke all on function public.respond_to_invite(uuid,boolean) from public, anon, authenticated;
grant execute on function public.respond_to_invite(uuid,boolean) to authenticated;
grant execute on function public.respond_to_invite(uuid,boolean) to service_role;

revoke all on function public.respond_to_request(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.respond_to_request(uuid,uuid,boolean) to authenticated;
grant execute on function public.respond_to_request(uuid,uuid,boolean) to service_role;

revoke all on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to service_role;

revoke all on function public.save_film_to_collection(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.save_film_to_collection(uuid,uuid,text) to authenticated;
grant execute on function public.save_film_to_collection(uuid,uuid,text) to service_role;

revoke all on function public.set_admin(uuid,boolean) from public, anon, authenticated;
grant execute on function public.set_admin(uuid,boolean) to authenticated;
grant execute on function public.set_admin(uuid,boolean) to service_role;

revoke all on function public.set_my_newsletter_subscription(boolean) from public, anon, authenticated;
grant execute on function public.set_my_newsletter_subscription(boolean) to authenticated;
grant execute on function public.set_my_newsletter_subscription(boolean) to service_role;

revoke all on function public.shows_following(uuid) from public, anon, authenticated;
grant execute on function public.shows_following(uuid) to authenticated;
grant execute on function public.shows_following(uuid) to anon;
grant execute on function public.shows_following(uuid) to service_role;
grant execute on function public.shows_following(uuid) to public;

revoke all on function public.shows_watched(uuid) from public, anon, authenticated;
grant execute on function public.shows_watched(uuid) to authenticated;
grant execute on function public.shows_watched(uuid) to anon;
grant execute on function public.shows_watched(uuid) to service_role;
grant execute on function public.shows_watched(uuid) to public;

revoke all on function public.skip_blocked_notification() from public, anon, authenticated;
grant execute on function public.skip_blocked_notification() to service_role;

revoke all on function public.stamp_film_publication() from public, anon, authenticated;
grant execute on function public.stamp_film_publication() to service_role;

revoke all on function public.sync_member_profile() from public, anon, authenticated;
grant execute on function public.sync_member_profile() to service_role;

revoke all on function public.sync_save_count() from public, anon, authenticated;
grant execute on function public.sync_save_count() to service_role;

revoke all on function public.worker_secret_ok(text) from public, anon, authenticated;
grant execute on function public.worker_secret_ok(text) to service_role;

revoke all on schema pheelm_email from public, anon, authenticated;

revoke all on schema pheelm_private from public, anon, authenticated;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('avatars', 'avatars', true, 3145728, '{image/webp}'::text[]) on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('images', 'images', true, 10485760, '{image/jpeg,image/png,image/webp}'::text[]) on conflict (id) do nothing;

select cron.schedule('pheelm-email-delivery', '*/5 * * * *', 'select net.http_post(url:=''https://mvhwfmlairwrngdttzjh.supabase.co/functions/v1/pheelm-email?action=process'',headers:=jsonb_build_object(''Content-Type'',''application/json'',''Authorization'',''Bearer ''||(select decrypted_secret from vault.decrypted_secrets where name=''pheelm_email_worker_secret'')),body:=''{}''::jsonb,timeout_milliseconds:=60000);');

