-- Admin → Send: the owner writes an announcement, a service notice or a newsletter, chooses who gets
-- it and how (in-app, email or both), sends themselves a test, then sends it. Emails go through the
-- existing outbox and worker, so they get the same retries, suppression and unsubscribe handling.
--
--   announcement  members; in-app can be muted in notification settings, email has its own switch
--                 ("News and announcements from Pheelm") and an unsubscribe link.
--   service       members; for things that affect their account. Ignores optional-email settings,
--                 never bounced or blocked addresses.
--   newsletter    confirmed newsletter subscribers only, email only, with the newsletter unsubscribe.
--
-- Also: activity emails (replies, mentions, new films) were being suppressed whenever the Digest was
-- off, because email_claim checked the Digest setting for every optional email. They now follow
-- their own switch, as Settings says.

-- Outbox: which send a job belongs to, its own subject and button, and what Resend reported.
alter table pheelm_email.outbox
  add column if not exists campaign_id uuid,
  add column if not exists subject text,
  add column if not exists action_label text,
  add column if not exists delivery text;
create index if not exists outbox_campaign on pheelm_email.outbox(campaign_id) where campaign_id is not null;
create index if not exists outbox_provider on pheelm_email.outbox(provider_id) where provider_id is not null;

alter table public.email_preferences add column if not exists announcement_emails boolean not null default true;
grant select(announcement_emails), insert(announcement_emails), update(announcement_emails) on public.email_preferences to authenticated;

create table if not exists pheelm_email.campaigns(
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('announcement', 'service', 'newsletter')),
  subject text not null check (length(subject) between 3 and 120),
  message text not null check (length(message) between 1 and 5000),
  action_path text not null default '/',
  action_label text not null default 'Open Pheelm' check (length(action_label) between 1 and 40),
  audience text not null check (audience in ('members', 'followers', 'watchlisted', 'member', 'subscribers')),
  audience_ref uuid,
  audience_label text,
  channels text[] not null check (channels <@ array['in_app', 'email'] and cardinality(channels) between 1 and 2),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  recipients int not null default 0,
  in_app int not null default 0,
  emails int not null default 0
);
alter table pheelm_email.campaigns enable row level security;
create index if not exists campaigns_created on pheelm_email.campaigns(created_at desc);

-- In-app: announcements can be muted like other notifications; service notices can't.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'invite','request','invite_accepted','invite_declined','request_accepted','request_declined','removed',
  'comment','reply','mention','new_film','collection_film','report','comment_report','submission','message',
  'new_member','featured','announcement','service_notice']));

-- A button link must be a page on Pheelm ("/films"), never another site.
create or replace function pheelm_email.safe_path(p text) returns text language sql immutable set search_path = '' as $$
  select case
    when p is null or btrim(p) = '' then '/'
    when length(p) <= 300 and p like '/%' and p not like '//%' and position(E'\\' in p) = 0 and p !~ '[[:space:]]'
      and p not like '/newsletter-confirm%' and p not like '/email%' then p
  end
$$;

create or replace function pheelm_email.campaign_check(p_kind text, p_audience text, p_ref uuid, p_channels text[]) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_kind not in ('announcement', 'service', 'newsletter') then raise exception 'Choose what kind of message this is'; end if;
  if p_channels is null or cardinality(p_channels) = 0 or not (p_channels <@ array['in_app', 'email']) then raise exception 'Choose in-app, email or both'; end if;
  if p_kind = 'newsletter' then
    if p_audience <> 'subscribers' then raise exception 'A newsletter goes to newsletter subscribers'; end if;
    if p_channels <> array['email'] then raise exception 'A newsletter is sent by email only'; end if;
  elsif p_audience not in ('members', 'followers', 'watchlisted', 'member') then raise exception 'Choose who gets it';
  elsif p_audience <> 'members' and p_ref is null then raise exception 'Choose the director, film or member';
  end if;
end $$;

-- Who a send reaches, and by which channel. Members: confirmed email, not suspended or banned.
create or replace function pheelm_email.campaign_audience(p_kind text, p_audience text, p_ref uuid)
returns table(user_id uuid, email text, in_app_ok boolean, email_ok boolean)
language sql stable security definer set search_path = '' as $$
  with members as (
    select p.id, lower(u.email) as address
    from public.profiles p join auth.users u on u.id = p.id
    where p_kind in ('announcement', 'service')
      and u.email_confirmed_at is not null and p.suspended_at is null and (u.banned_until is null or u.banned_until < now())
      and case p_audience
        when 'members' then true
        when 'followers' then exists (select 1 from public.follows f where f.user_id = p.id and f.person_id = p_ref)
        when 'watchlisted' then exists (select 1 from public.watchlist w where w.user_id = p.id and w.film_id = p_ref)
        when 'member' then p.id = p_ref
        else false end
  ), subscribers as (
    select (select u.id from auth.users u where lower(u.email) = s.email limit 1) as id, s.email as address
    from pheelm_email.subscriptions s
    where p_kind = 'newsletter' and p_audience = 'subscribers'
      and s.confirmed_at is not null and s.unsubscribed_at is null
      and exists (select 1 from public.subscribers b where lower(b.email) = s.email)
  )
  select m.id, m.address,
    p_kind = 'service' or not exists (select 1 from public.notification_preferences np where np.user_id = m.id and 'announcement' = any(np.disabled_types)),
    not exists (select 1 from pheelm_email.suppressions x where x.email = m.address)
      and (p_kind = 'service' or coalesce((select ep.announcement_emails from public.email_preferences ep where ep.user_id = m.id), true))
  from members m
  union all
  select s.id, s.address, false, not exists (select 1 from pheelm_email.suppressions x where x.email = s.address)
  from subscribers s
$$;
revoke all on function pheelm_email.campaign_audience(text, text, uuid) from public, anon, authenticated;

create or replace function public.admin_campaign_preview(p_kind text, p_audience text, p_ref uuid default null, p_channels text[] default array['in_app', 'email'])
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  perform pheelm_email.campaign_check(p_kind, p_audience, p_ref, p_channels);
  select jsonb_build_object(
    'audience', count(*),
    'recipients', count(*) filter (where ('in_app' = any(p_channels) and a.in_app_ok and a.user_id is not null) or ('email' = any(p_channels) and a.email_ok)),
    'in_app', count(*) filter (where 'in_app' = any(p_channels) and a.in_app_ok and a.user_id is not null),
    'emails', count(*) filter (where 'email' = any(p_channels) and a.email_ok)
  ) into result from pheelm_email.campaign_audience(p_kind, p_audience, p_ref) a;
  return result;
end $$;

-- The lists the Send page picks from: directors with followers, films in watchlists, and members.
create or replace function public.admin_campaign_targets() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return jsonb_build_object(
    'directors', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'label', x.name, 'count', x.n) order by x.n desc, x.name) from (
      select p.id, p.name, count(*) as n from public.follows f join public.people p on p.id = f.person_id group by p.id, p.name order by n desc, p.name limit 300) x), '[]'),
    'films', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'label', x.title, 'count', x.n) order by x.n desc, x.title) from (
      select fl.id, fl.title, count(*) as n from public.watchlist w join public.films fl on fl.id = w.film_id group by fl.id, fl.title order by n desc, fl.title limit 300) x), '[]'),
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'label', x.label) order by lower(x.label)) from (
      select p.id, coalesce(nullif(btrim(p.display_name), ''), p.handle, 'Member') || coalesce(' (@' || p.handle || ')', '') as label
      from public.profiles p join auth.users u on u.id = p.id
      where u.email_confirmed_at is not null and p.suspended_at is null limit 2000) x), '[]'));
end $$;

-- Shared by test and send: tidy the words and check them.
create or replace function pheelm_email.campaign_words(p_subject text, p_message text, p_action_path text, p_action_label text,
  out subject text, out message text, out path text, out label text)
language plpgsql immutable set search_path = '' as $$
begin
  subject := btrim(coalesce(p_subject, ''));
  message := btrim(coalesce(p_message, ''));
  path := pheelm_email.safe_path(p_action_path);
  label := coalesce(nullif(btrim(p_action_label), ''), 'Open Pheelm');
  if length(subject) not between 3 and 120 then raise exception 'Write a subject of 3–120 characters'; end if;
  if length(message) not between 1 and 5000 then raise exception 'Write a message of up to 5000 characters'; end if;
  if path is null then raise exception 'The button link must be a page on Pheelm, like /films'; end if;
  if length(label) > 40 then raise exception 'Keep the button label to 40 characters'; end if;
end $$;

create or replace function pheelm_email.campaign_template(p_kind text) returns text language sql immutable set search_path = '' as $$
  select case p_kind when 'newsletter' then 'campaign-newsletter' when 'service' then 'campaign-service' else 'campaign-announcement' end
$$;

-- Sends the message only to the admin who asked, exactly as recipients will see it. At most 10 an hour.
create or replace function public.admin_campaign_test(p_kind text, p_subject text, p_message text, p_action_path text default null, p_action_label text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare w record; address text;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if p_kind not in ('announcement', 'service', 'newsletter') then raise exception 'Choose what kind of message this is'; end if;
  select * into w from pheelm_email.campaign_words(p_subject, p_message, p_action_path, p_action_label);
  select lower(email) into address from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if address is null then raise exception 'Your account has no confirmed email to send a test to'; end if;
  if exists (select 1 from pheelm_email.suppressions where email = address) then raise exception 'Emails to your address bounced before, so a test can''t be sent'; end if;
  if (select count(*) from pheelm_email.outbox where user_id = auth.uid() and category = 'test' and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'That''s 10 tests this hour. Try again later.';
  end if;
  insert into pheelm_email.outbox(event_key, user_id, recipient, template, message, action_path, category, subject, action_label)
  values ('campaign-test:' || gen_random_uuid(), auth.uid(), address, pheelm_email.campaign_template(p_kind), w.message, w.path, 'test', w.subject, w.label);
  return address;
end $$;

-- Sends it. Owner only. `p_expected` is the count the owner confirmed; if the audience changed since,
-- nothing is sent and they're asked to check again.
create or replace function public.admin_campaign_send(p_kind text, p_subject text, p_message text, p_action_path text, p_action_label text,
  p_audience text, p_ref uuid, p_channels text[], p_expected int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare w record; cid uuid; reach int; n_in int := 0; n_mail int := 0; ref_label text;
begin
  if not public.is_owner() then raise exception 'Only the owner can send messages' using errcode = '42501'; end if;
  perform pheelm_email.campaign_check(p_kind, p_audience, p_ref, p_channels);
  select * into w from pheelm_email.campaign_words(p_subject, p_message, p_action_path, p_action_label);
  -- One send at a time, and the same subject not twice in 10 minutes (a double tap).
  perform pg_advisory_xact_lock(hashtext('pheelm_email.campaign_send'));
  if exists (select 1 from pheelm_email.campaigns c where c.subject = w.subject and c.created_at > now() - interval '10 minutes') then
    raise exception 'This subject was just sent. Wait 10 minutes to send it again.';
  end if;
  select count(*) into reach from pheelm_email.campaign_audience(p_kind, p_audience, p_ref) a
    where ('in_app' = any(p_channels) and a.in_app_ok and a.user_id is not null) or ('email' = any(p_channels) and a.email_ok);
  if reach = 0 then raise exception 'No one would get this. Choose another audience or channel.'; end if;
  if p_expected is distinct from reach then
    raise exception 'The audience changed to % since you checked. Look at the count and send again.', reach;
  end if;
  ref_label := case p_audience
    when 'followers' then (select name from public.people where id = p_ref)
    when 'watchlisted' then (select title from public.films where id = p_ref)
    when 'member' then (select coalesce(nullif(btrim(display_name), ''), handle) from public.profiles where id = p_ref)
  end;
  insert into pheelm_email.campaigns(kind, subject, message, action_path, action_label, audience, audience_ref, audience_label, channels, created_by, recipients)
  values (p_kind, w.subject, w.message, w.path, w.label, p_audience, p_ref, ref_label, p_channels, auth.uid(), reach)
  returning id into cid;

  if 'in_app' = any(p_channels) then
    insert into public.notifications(user_id, type, detail, ref_id)
    select a.user_id, case when p_kind = 'service' then 'service_notice' else 'announcement' end, left(w.subject, 200), cid
    from pheelm_email.campaign_audience(p_kind, p_audience, p_ref) a where a.in_app_ok and a.user_id is not null;
    get diagnostics n_in = row_count;
  end if;

  if 'email' = any(p_channels) then
    insert into pheelm_email.outbox(event_key, user_id, recipient, template, message, action_path, category, campaign_id, subject, action_label)
    select distinct on (a.email) 'campaign:' || cid || ':' || a.email, a.user_id, a.email, pheelm_email.campaign_template(p_kind), w.message, w.path,
      case p_kind when 'newsletter' then 'marketing' when 'service' then 'transactional' else 'announcement' end, cid, w.subject, w.label
    from pheelm_email.campaign_audience(p_kind, p_audience, p_ref) a
    where a.email_ok and length(a.email) <= 254 and a.email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    order by a.email
    on conflict (event_key) do nothing;
    get diagnostics n_mail = row_count;
  end if;

  update pheelm_email.campaigns set in_app = n_in, emails = n_mail where id = cid;
  return jsonb_build_object('id', cid, 'in_app', n_in, 'emails', n_mail);
end $$;

-- What was sent, and how it went: emails waiting, sent, delivered, bounced, failed; in-app read.
create or replace function public.admin_campaigns(p_limit int default 30)
returns table(id uuid, kind text, subject text, audience text, audience_label text, channels text[], created_at timestamptz, sender text,
  in_app int, in_app_read int, emails int, queued int, sent int, delivered int, bounced int, failed int, skipped int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return query
  select c.id, c.kind, c.subject, c.audience, c.audience_label, c.channels, c.created_at,
    (select coalesce(nullif(btrim(p.display_name), ''), p.handle) from public.profiles p where p.id = c.created_by),
    c.in_app,
    (select count(*)::int from public.notifications n where n.ref_id = c.id and n.type in ('announcement', 'service_notice') and n.read_at is not null),
    c.emails,
    coalesce(o.queued, 0), coalesce(o.sent, 0), coalesce(o.delivered, 0), coalesce(o.bounced, 0), coalesce(o.failed, 0), coalesce(o.skipped, 0)
  from pheelm_email.campaigns c
  left join lateral (
    select count(*) filter (where x.state in ('pending', 'processing'))::int as queued,
      count(*) filter (where x.state = 'sent')::int as sent,
      count(*) filter (where x.delivery = 'email.delivered')::int as delivered,
      count(*) filter (where x.delivery in ('email.bounced', 'email.complained'))::int as bounced,
      count(*) filter (where x.state = 'failed' or x.delivery in ('email.failed', 'email.suppressed'))::int as failed,
      count(*) filter (where x.state = 'suppressed')::int as skipped
    from pheelm_email.outbox x where x.campaign_id = c.id
  ) o on true
  order by c.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
end $$;

-- A member opening an announcement from their notifications reads the whole message.
create or replace function public.my_announcement(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('kind', c.kind, 'subject', c.subject, 'message', c.message, 'action_path', c.action_path,
    'action_label', c.action_label, 'created_at', c.created_at)
  from pheelm_email.campaigns c
  where c.id = p_id and exists (select 1 from public.notifications n where n.ref_id = c.id and n.user_id = auth.uid() and n.type in ('announcement', 'service_notice'))
$$;

revoke all on function public.admin_campaign_preview(text, text, uuid, text[]) from public, anon;
revoke all on function public.admin_campaign_targets() from public, anon;
revoke all on function public.admin_campaign_test(text, text, text, text, text) from public, anon;
revoke all on function public.admin_campaign_send(text, text, text, text, text, text, uuid, text[], int) from public, anon;
revoke all on function public.admin_campaigns(int) from public, anon;
revoke all on function public.my_announcement(uuid) from public, anon;
grant execute on function public.admin_campaign_preview(text, text, uuid, text[]), public.admin_campaign_targets(),
  public.admin_campaign_test(text, text, text, text, text), public.admin_campaign_send(text, text, text, text, text, text, uuid, text[], int),
  public.admin_campaigns(int), public.my_announcement(uuid) to authenticated;
revoke all on function pheelm_email.safe_path(text), pheelm_email.campaign_check(text, text, uuid, text[]),
  pheelm_email.campaign_words(text, text, text, text), pheelm_email.campaign_template(text) from public, anon, authenticated;

-- Worker: the newsletter unsubscribe token for a recipient, only while they're still subscribed.
create or replace function public.email_newsletter_token(address text) returns text
language sql stable security definer set search_path = '' as $$
  select s.token from pheelm_email.subscriptions s where s.email = lower(address) and s.confirmed_at is not null and s.unsubscribed_at is null
$$;
revoke all on function public.email_newsletter_token(text) from public, anon, authenticated;
grant execute on function public.email_newsletter_token(text) to service_role;

-- Claim: as before, plus announcement and newsletter opt-outs taken after queueing, and activity
-- emails following their own switch instead of the Digest's.
create or replace function public.email_claim(batch_size int default 20) returns setof pheelm_email.outbox
language plpgsql security definer set search_path = '' as $$
begin
  update pheelm_email.outbox set state = 'failed', last_error = 'Delivery expired; manual review required.' where state in ('pending', 'processing') and created_at < now() - interval '12 hours';
  update pheelm_email.outbox o set state = 'suppressed', message = '', last_error = 'Suppressed or preference disabled' where o.state in ('pending', 'processing') and
  (exists (select 1 from pheelm_email.suppressions s where s.email = lower(o.recipient)) or
  (o.category = 'collaboration' and exists (select 1 from public.email_preferences p where p.user_id = o.user_id and not p.collaboration_emails)) or
  (o.category = 'optional' and o.template = 'activity-digest' and not exists (select 1 from public.email_preferences p where p.user_id = o.user_id and p.digest_frequency <> 'off')) or
  (o.category = 'optional' and o.template <> 'activity-digest' and exists (select 1 from public.email_preferences p where p.user_id = o.user_id and p.activity_emails is false)) or
  (o.category = 'announcement' and exists (select 1 from public.email_preferences p where p.user_id = o.user_id and not p.announcement_emails)) or
  (o.category = 'marketing' and not exists (select 1 from pheelm_email.subscriptions s where s.email = lower(o.recipient) and s.confirmed_at is not null and s.unsubscribed_at is null)) or
  (o.category = 'confirmation' and not exists (select 1 from pheelm_email.subscriptions s where s.email = lower(o.recipient) and s.confirmed_at is null and s.unsubscribed_at is null and o.action_path = '/newsletter-confirm?token=' || s.token)));
  return query with due as (
    select id from pheelm_email.outbox where (state = 'pending' or (state = 'processing' and available_at < now())) and available_at <= now() and attempts < 6 order by created_at for update skip locked limit greatest(1, least(batch_size, 20))
  ) update pheelm_email.outbox o set state = 'processing', attempts = o.attempts + 1, available_at = now() + interval '15 minutes', lease = gen_random_uuid() from due where o.id = due.id returning o.*;
end $$;

-- Webhooks: as before, plus what happened to each email, so the Send page can show it.
-- A bounce or complaint is never overwritten by a later event.
create or replace function public.email_record_event(event_id text, event_type text, email_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare address text;
begin
  insert into pheelm_email.events(id, type) values (event_id, event_type) on conflict do nothing; if not found then return; end if;
  if event_type in ('email.delivered', 'email.bounced', 'email.complained', 'email.failed', 'email.suppressed') and coalesce(email_id, '') <> '' then
    update pheelm_email.outbox set delivery = case when delivery in ('email.bounced', 'email.complained') then delivery else event_type end where provider_id = email_id;
  end if;
  if event_type in ('email.bounced', 'email.complained', 'email.suppressed') then
    select recipient into address from pheelm_email.outbox where provider_id = email_id;
    if address is not null then
      insert into pheelm_email.suppressions(email, reason) values (lower(address), event_type) on conflict (email) do update set reason = excluded.reason;
      update pheelm_email.outbox set state = 'suppressed', message = '' where lower(recipient) = lower(address) and state in ('pending', 'processing');
    end if;
  end if;
end $$;

-- Unsubscribe links: as before; a member's link also turns off announcement emails.
create or replace function public.email_token_action(token_value text, action text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare address text;
begin
  if length(token_value) <> 64 then return false; end if;
  if action = 'confirm' then
    update pheelm_email.subscriptions s set confirmed_at = now() where token = token_value and unsubscribed_at is null and requested_at > now() - interval '7 days' and exists (select 1 from public.subscribers p where lower(p.email) = s.email) returning email into address; return found;
  elsif action = 'unsubscribe' then
    update pheelm_email.subscriptions set unsubscribed_at = now(), confirmed_at = null where token = token_value returning email into address;
    if address is not null then delete from public.subscribers where lower(email) = address; return true; end if;
    update public.email_preferences set collaboration_emails = false, activity_emails = false, announcement_emails = false, digest_frequency = 'off', updated_at = now() where unsubscribe_token = token_value; return found;
  end if; return false;
end $$;
