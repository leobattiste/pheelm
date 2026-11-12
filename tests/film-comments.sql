-- Checks for supabase/film-comments.sql. Run after tests/film-comments-bootstrap.sql and the migration.
begin;
create function pg_temp.as_user(who text) returns void language sql as $$select set_config('request.jwt.claim.sub', who, true)$$;
set local role authenticated;

-- A member comments on a published film, with and without a spoiler mark.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.list_comments(id, film_id, user_id, body) values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', auth.uid(), '  Loved the ending  ');
insert into public.list_comments(id, film_id, user_id, body, spoiler) values ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', auth.uid(), 'The ghosts were the girls', true);
do $$begin
  if (select body from public.list_comments where id = '30000000-0000-0000-0000-000000000001') <> 'Loved the ending' then raise exception 'Body not trimmed'; end if;
  if not (select spoiler from public.list_comments where id = '30000000-0000-0000-0000-000000000002') then raise exception 'Spoiler mark lost'; end if;
end$$;

-- Not on a draft film, not on both a film and a watchlist, not on neither, not without a profile.
do $$begin begin
  insert into public.list_comments(film_id, user_id, body) values ('10000000-0000-0000-0000-000000000002', auth.uid(), 'x');
  raise exception 'Commented on a draft film'; exception when insufficient_privilege then null; end; end$$;
do $$begin begin
  insert into public.list_comments(film_id, list_id, user_id, body) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', auth.uid(), 'x');
  raise exception 'Comment on two things'; exception when check_violation or insufficient_privilege then null; end; end$$;
do $$begin begin
  insert into public.list_comments(user_id, body) values (auth.uid(), 'x');
  raise exception 'Comment on nothing'; exception when check_violation or insufficient_privilege then null; end; end$$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$begin begin
  insert into public.list_comments(film_id, user_id, body) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'x');
  raise exception 'Commented without a profile'; exception when insufficient_privilege then null; end; end$$;

-- Replies stay on the same film and tell the person replied to; @mentions notify too.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.list_comments(id, film_id, parent_id, user_id, body) values ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', auth.uid(), 'Same, @admin');
do $$begin begin
  insert into public.list_comments(list_id, parent_id, user_id, body) values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', auth.uid(), 'x');
  raise exception 'Replied across pages'; exception when check_violation then null; end; end$$;
reset role;
do $$begin
  if not exists (select 1 from public.notifications where type = 'reply' and user_id = '00000000-0000-0000-0000-00000000000b'
    and film_id = '10000000-0000-0000-0000-000000000001' and comment_id = '30000000-0000-0000-0000-000000000003' and list_id is null) then raise exception 'No reply notification'; end if;
  if not exists (select 1 from public.notifications where type = 'mention' and user_id = '00000000-0000-0000-0000-00000000000a'
    and film_id = '10000000-0000-0000-0000-000000000001') then raise exception 'No mention notification'; end if;
  if exists (select 1 from public.notifications where type = 'comment' and film_id is not null) then raise exception 'Film comments have no owner to notify'; end if;
end$$;
set local role authenticated;

-- Edits can change the text and spoiler mark, never the film.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
update public.list_comments set body = 'Loved the ending a lot', spoiler = true, film_id = '10000000-0000-0000-0000-000000000002' where id = '30000000-0000-0000-0000-000000000001';
do $$declare c record; begin
  select * into c from public.list_comments where id = '30000000-0000-0000-0000-000000000001';
  if c.film_id <> '10000000-0000-0000-0000-000000000001' then raise exception 'Comment moved film'; end if;
  if not c.spoiler or c.edited_at is null then raise exception 'Edit not saved'; end if;
end$$;

-- Others can't delete it; the author and admins can.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
delete from public.list_comments where id = '30000000-0000-0000-0000-000000000002';
do $$begin if not exists (select 1 from public.list_comments where id = '30000000-0000-0000-0000-000000000002') then raise exception 'Someone else deleted it'; end if; end$$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
delete from public.list_comments where id = '30000000-0000-0000-0000-000000000002';
do $$begin if exists (select 1 from public.list_comments where id = '30000000-0000-0000-0000-000000000002') then raise exception 'Admin could not delete'; end if; end$$;

-- Visitors read comments on published films only.
reset role;
update public.films set status = 'draft' where id = '10000000-0000-0000-0000-000000000001';
set local role anon;
select pg_temp.as_user('');
do $$begin if exists (select 1 from public.list_comments where film_id is not null) then raise exception 'Draft film comments visible'; end if; end$$;
do $$begin if not exists (select 1 from public.list_comments where list_id is not null) then raise exception 'Watchlist comments hidden'; end if; end$$;
reset role;
update public.films set status = 'published' where id = '10000000-0000-0000-0000-000000000001';

-- Blocks: no replying to someone who blocked you.
insert into public.blocks values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$begin begin
  insert into public.list_comments(film_id, parent_id, user_id, body) values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', auth.uid(), 'x');
  raise exception 'Replied to a blocker'; exception when raise_exception then if sqlerrm like 'Replied%' then raise; end if; end; end$$;

-- Reports on film comments tell the admins which film.
insert into public.comment_reports(comment_id, user_id, reason) values ('30000000-0000-0000-0000-000000000001', auth.uid(), 'Spoilers');
reset role;
do $$begin if not exists (select 1 from public.notifications where type = 'comment_report' and film_id = '10000000-0000-0000-0000-000000000001') then raise exception 'Report not linked to film'; end if; end$$;
rollback;
select 'film comments ok';
