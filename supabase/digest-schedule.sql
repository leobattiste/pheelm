-- Digest: sent at 4 pm New York time, every day for Daily and on Fridays for Weekly, with what was
-- added since the member's last Digest. The worker runs every five minutes; the first run after 4 pm
-- sends. Each email lists new films with their posters, new directors and new public watchlists.
-- Run after catalog-digest.sql. Safe to run twice.

-- The most recent 4 pm (New York) a member's Digest was due, for their choice.
create or replace function pheelm_email.digest_due(frequency text, at_time timestamptz default now()) returns timestamptz
language sql stable set search_path='' as $$
 with t as (select (at_time at time zone 'America/New_York') as local_now),
 d as (select ((date_trunc('day', local_now) + interval '16 hours') at time zone 'America/New_York') as today4,
  ((date_trunc('day', local_now) - make_interval(days => ((extract(isodow from local_now)::int - 5 + 7) % 7)) + interval '16 hours') at time zone 'America/New_York') as friday4 from t)
 select case when frequency = 'weekly' then case when at_time >= friday4 then friday4 else friday4 - interval '7 days' end
  else case when at_time >= today4 then today4 else today4 - interval '1 day' end end from d;
$$;
revoke all on function pheelm_email.digest_due(text, timestamptz) from public, anon, authenticated;

create or replace function public.email_prepare_digests() returns void language plpgsql security definer set search_path='' as $$
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
end $$;
revoke all on function public.email_prepare_digests() from public, anon, authenticated;
grant execute on function public.email_prepare_digests() to service_role;

-- What a Digest shows: the newest films (with poster and year), directors (with photo) and public
-- watchlists in the window, plus how many of each there were.
create or replace function pheelm_email.digest_items(since_time timestamptz, until_time timestamptz) returns jsonb
language sql stable security definer set search_path='' as $$
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
  'films', (select j from films where j->'items' is not null),
  'directors', (select j from directors where j->'items' is not null),
  'watchlists', (select j from watchlists where j->'items' is not null))) end;
$$;
revoke all on function pheelm_email.digest_items(timestamptz, timestamptz) from public, anon, authenticated;

-- The worker's view of one queued Digest: what to show, and whether it's daily or weekly.
create or replace function public.email_digest_items(job_id uuid, lease_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select pheelm_email.digest_items(o.digest_from, o.digest_until) || jsonb_build_object('frequency', p.digest_frequency)
 from pheelm_email.outbox o join public.email_preferences p on p.user_id=o.user_id and p.digest_frequency<>'off'
 where o.id=job_id and o.lease=lease_id and o.state='processing' and o.template='activity-digest';
$$;
revoke all on function public.email_digest_items(uuid, uuid) from public, anon, authenticated;
grant execute on function public.email_digest_items(uuid, uuid) to service_role;
