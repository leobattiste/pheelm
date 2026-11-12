-- The admin inbox: messages sorted into boxes by topic, each with a status, internal notes,
-- partnership details and stage, a deadline for privacy requests, and a history of replies.
-- Also the newsletter list for the owner. Safe to run more than once.

-- Messages ---------------------------------------------------------------------------------------
alter table public.messages
  add column if not exists status text not null default 'new',
  add column if not exists stage text,
  add column if not exists partnership_type text,
  add column if not exists website text,
  add column if not exists notes text,
  add column if not exists due_at timestamptz,
  add column if not exists replied_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- Messages already marked as done stay done; partnership requests start at "new"; privacy
-- requests get 30 days from when they arrived.
update public.messages set status = 'done', closed_at = coalesce(closed_at, created_at) where handled and status = 'new';
update public.messages set stage = 'new' where topic = 'partnership' and stage is null;
update public.messages set due_at = created_at + interval '30 days' where topic = 'privacy' and due_at is null;

alter table public.messages drop constraint if exists messages_status_check;
alter table public.messages add constraint messages_status_check check (status in ('new', 'open', 'done', 'spam'));
alter table public.messages drop constraint if exists messages_stage_check;
alter table public.messages add constraint messages_stage_check check (stage is null or stage in ('new', 'talking', 'accepted', 'declined'));
alter table public.messages drop constraint if exists messages_detail_lengths;
alter table public.messages add constraint messages_detail_lengths check (
  coalesce(length(notes), 0) <= 10000 and coalesce(length(partnership_type), 0) <= 100 and coalesce(length(website), 0) <= 500
);

create index if not exists messages_status_created on public.messages (status, created_at desc);
create index if not exists messages_topic_status on public.messages (topic, status, created_at desc);

-- Whoever sends a message can't choose its status, notes or deadline; admins' changes keep
-- "handled" in step for anything still reading it, and stamp when a message was closed.
create or replace function public.messages_keep_state() returns trigger
language plpgsql set search_path = '' as $$
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
  -- Older code marks messages with "handled" only; follow it.
  if new.handled is distinct from old.handled and new.status is not distinct from old.status then
    new.status := case when new.handled then 'done' else 'open' end;
  end if;
  new.handled := new.status in ('done', 'spam');
  if new.status in ('done', 'spam') and old.status not in ('done', 'spam') then new.closed_at := now(); end if;
  if new.status not in ('done', 'spam') then new.closed_at := null; end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists messages_keep_state on public.messages;
create trigger messages_keep_state before insert or update on public.messages
  for each row execute function public.messages_keep_state();

-- Replies ----------------------------------------------------------------------------------------
create table if not exists public.message_replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null default auth.uid(),
  body text not null check (length(btrim(body)) between 1 and 5000),
  via text not null default 'pheelm' check (via in ('pheelm', 'email')),
  created_at timestamptz not null default now()
);
create index if not exists message_replies_message on public.message_replies (message_id, created_at);
alter table public.message_replies enable row level security;
drop policy if exists "Admins read replies" on public.message_replies;
create policy "Admins read replies" on public.message_replies for select using (public.is_admin());
-- Admins can note a reply they sent from their own email.
drop policy if exists "Admins record replies" on public.message_replies;
create policy "Admins record replies" on public.message_replies for insert
  with check (public.is_admin() and via = 'email' and author_id = (select auth.uid()));

-- Sends a reply by email, keeps it in the message's history, and marks the message as read
-- (or done, when asked).
drop function if exists public.email_reply_to_message(uuid, text);
drop function if exists public.email_reply_to_message(uuid, text, boolean);
create function public.email_reply_to_message(message_id uuid, reply text, close boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
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
end $$;
revoke all on function public.email_reply_to_message(uuid, text, boolean) from public, anon;
grant execute on function public.email_reply_to_message(uuid, text, boolean) to authenticated;

-- Newsletter -------------------------------------------------------------------------------------
-- How many people are at each step. Any admin can see the numbers.
create or replace function public.admin_newsletter_counts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
end $$;
revoke all on function public.admin_newsletter_counts() from public, anon;
grant execute on function public.admin_newsletter_counts() to authenticated;

-- The list itself, with addresses: owner only.
create or replace function public.admin_newsletter(search text default null, only_state text default null, page_size int default 50, page_offset int default 0)
returns table (email text, source text, created_at timestamptz, state text, confirmed_at timestamptz, unsubscribed_at timestamptz, total bigint)
language plpgsql stable security definer set search_path = '' as $$
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
end $$;
revoke all on function public.admin_newsletter(text, text, int, int) from public, anon;
grant execute on function public.admin_newsletter(text, text, int, int) to authenticated;

-- Takes someone off the list: unsubscribes them and removes their sign-up. Owner only.
create or replace function public.admin_remove_subscriber(address text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception 'Owner access required' using errcode = '42501'; end if;
  update pheelm_email.subscriptions set unsubscribed_at = now() where email = lower(address) and unsubscribed_at is null;
  delete from public.subscribers where lower(email) = lower(address);
end $$;
revoke all on function public.admin_remove_subscriber(text) from public, anon;
grant execute on function public.admin_remove_subscriber(text) to authenticated;
