-- Checks for supabase/admin-community.sql. Run after tests/admin-community-bootstrap.sql and the migration.
begin;
create function pg_temp.as_user(who text) returns void language sql as $$select set_config('request.jwt.claim.sub', who, true)$$;
-- Members can't suspend anyone.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$begin begin perform public.admin_set_suspended('00000000-0000-0000-0000-00000000000c', true);raise exception 'Member suspended someone';exception when insufficient_privilege then null;end;end$$;
-- Admins can suspend members (and hide their public watchlists), not other admins, the owner or themselves.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$begin begin perform public.admin_set_suspended('00000000-0000-0000-0000-00000000000a', true);raise exception 'Owner suspended';exception when insufficient_privilege then null;end;end$$;
do $$begin begin perform public.admin_set_suspended('00000000-0000-0000-0000-00000000000b', true);raise exception 'Self suspended';exception when insufficient_privilege then null;end;end$$;
select public.admin_set_suspended('00000000-0000-0000-0000-00000000000c', true, '  Spam links  ', true);
do $$declare p record;begin select * into p from public.profiles where handle='member';
  if p.suspended_at is null or p.suspended_reason<>'Spam links' or p.suspended_by<>'00000000-0000-0000-0000-00000000000b' then raise exception 'Suspension not recorded';end if;
  if not (select hidden from public.lists where title='Public list') then raise exception 'Public watchlist not hidden';end if;
  if (select hidden from public.lists where title='Private list') then raise exception 'Private watchlist should be untouched';end if;
end$$;
-- A suspended member can't comment, like, change watchlists, add films or submit.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$begin begin insert into public.list_comments(user_id, body) values (auth.uid(), 'hi');raise exception 'Suspended member commented';exception when insufficient_privilege then null;end;end$$;
do $$begin begin insert into public.lists(user_id, title) values (auth.uid(), 'New');raise exception 'Suspended member made a list';exception when insufficient_privilege then null;end;end$$;
do $$begin begin insert into public.submissions(user_id, title) values (auth.uid(), 'Film');raise exception 'Suspended member submitted';exception when insufficient_privilege then null;end;end$$;
-- Others still can.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
insert into public.list_comments(user_id, body) values (auth.uid(), 'hello');
-- Only the owner can suspend an admin; restoring clears everything.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.admin_set_suspended('00000000-0000-0000-0000-00000000000b', true, 'Test');
select public.admin_set_suspended('00000000-0000-0000-0000-00000000000b', false);
select public.admin_set_suspended('00000000-0000-0000-0000-00000000000c', false);
do $$begin if exists(select 1 from public.profiles where suspended_at is not null or suspended_reason is not null) then raise exception 'Restore incomplete';end if;end$$;
-- The member list includes suspension, and email only for the owner.
do $$begin if (select count(*) from public.admin_members() where email is not null)<>4 then raise exception 'Owner should see emails';end if;end$$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$begin if exists(select 1 from public.admin_members() where email is not null) then raise exception 'Admin saw emails';end if;end$$;
-- Refusals: only the server records them; admins read them; old ones are cleared.
do $$begin
  if has_function_privilege('authenticated','public.record_moderation_refusal(uuid,text,text,text)','execute') then raise exception 'Members can write refusals';end if;
  if has_function_privilege('anon','public.admin_moderation_log(integer,integer)','execute') then raise exception 'Log exposed';end if;
end$$;
insert into private.moderation_refusals(actor_id, field, excerpt, reason, created_at) values ('00000000-0000-0000-0000-00000000000c','comment','old','Strong language', now() - interval '100 days');
select public.record_moderation_refusal('00000000-0000-0000-0000-00000000000c', 'comment', repeat('x', 500), 'Harassment');
do $$declare r record;begin
  if (select count(*) from public.admin_moderation_log())<>1 then raise exception 'Old refusal not cleared';end if;
  select * into r from public.admin_moderation_log();
  if length(r.excerpt)<>300 or r.handle<>'member' or r.total<>1 then raise exception 'Log row wrong';end if;
end$$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$begin begin perform * from public.admin_moderation_log();raise exception 'Member read the log';exception when insufficient_privilege then null;end;end$$;
-- The owner can delete any watchlist.
do $$begin if not exists(select 1 from pg_policies where tablename='lists' and policyname='Owner deletes watchlists') then raise exception 'Delete policy missing';end if;end$$;
rollback;
