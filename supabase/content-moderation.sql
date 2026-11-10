-- Run when the OpenAI key is configured and the new server actions are deployed.
-- This prevents bypassing moderation by writing to Supabase directly.
-- Re-runnable. Administrators' service-role writes and migrations are unaffected.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.moderation_approvals (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  field text not null check (field in ('comment', 'bio', 'watchlist_description')),
  text_hash text not null,
  expires_at timestamptz not null default (now() + interval '2 minutes')
);
create index if not exists moderation_approvals_lookup_idx
  on private.moderation_approvals(actor_id, field, text_hash, expires_at);
create index if not exists moderation_approvals_expiry_idx
  on private.moderation_approvals(expires_at);
revoke all on private.moderation_approvals from public, anon, authenticated;
grant select, insert, delete on private.moderation_approvals to service_role;
grant usage, select on sequence private.moderation_approvals_id_seq to service_role;

-- Only the server's service-role key can issue a receipt. This function is exposed
-- via PostgREST RPC for the service role, never anonymous or regular members.
create or replace function public.record_moderation_approval(
  p_actor uuid, p_field text, p_text text
) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if p_actor is null or p_field not in ('comment', 'bio', 'watchlist_description')
     or p_text is null or char_length(p_text) > 10000 or btrim(p_text) = '' then
    raise exception 'Invalid moderation approval request';
  end if;
  -- Prevent unused receipts from building up when a member abandons a draft.
  delete from private.moderation_approvals where expires_at < now();
  insert into private.moderation_approvals(actor_id, field, text_hash)
    values (p_actor, p_field, md5(p_text));
end;
$$;
revoke all on function public.record_moderation_approval(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_moderation_approval(uuid, text, text) to service_role;

-- Even if users directly call the Supabase REST API, public text changes need
-- an unused receipt for that exact user, field and text. Consume atomically.
create or replace function public.require_moderated_content()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  body_text text;
  field_name text;
  approval_id bigint;
  actor uuid;
begin
  actor := auth.uid();
  -- service_role / database maintenance writes have no signed-in member context.
  if actor is null then return new; end if;

  if tg_table_name = 'list_comments' then
    field_name := 'comment';
    if tg_op = 'UPDATE' then
      if new.body is not distinct from old.body then return new; end if;
    end if;
    body_text := btrim(new.body);
  elsif tg_table_name = 'profiles' then
    field_name := 'bio';
    if tg_op = 'UPDATE' then
      if new.bio is not distinct from old.bio then return new; end if;
    end if;
    body_text := btrim(coalesce(new.bio, ''));
  elsif tg_table_name = 'lists' then
    field_name := 'watchlist_description';
    if tg_op = 'UPDATE' then
      if new.description is not distinct from old.description then return new; end if;
    end if;
    body_text := btrim(coalesce(new.description, ''));
  else
    raise exception 'Unknown moderation target';
  end if;

  -- Clearing text is always permitted.
  if body_text = '' then return new; end if;

  select a.id into approval_id
  from private.moderation_approvals a
  where a.actor_id = actor and a.field = field_name and a.text_hash = md5(body_text)
    and a.expires_at > now()
  order by a.id for update skip locked limit 1;

  if approval_id is null then
    raise exception 'This text must be checked before saving.'
      using errcode = '23514';
  end if;
  delete from private.moderation_approvals where id = approval_id;
  return new;
end;
$$;
revoke execute on function public.require_moderated_content() from public, anon, authenticated;

drop trigger if exists require_moderation_comments on public.list_comments;
create trigger require_moderation_comments before insert or update on public.list_comments
  for each row execute function public.require_moderated_content();

drop trigger if exists require_moderation_profiles on public.profiles;
create trigger require_moderation_profiles before insert or update on public.profiles
  for each row execute function public.require_moderated_content();

drop trigger if exists require_moderation_lists on public.lists;
create trigger require_moderation_lists before insert or update on public.lists
  for each row execute function public.require_moderated_content();

-- Old, unused receipts can be removed periodically without affecting records.
-- delete from private.moderation_approvals where expires_at < now();
