\set ON_ERROR_STOP on
begin;
insert into public.profiles(id) values
 ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003'),('00000000-0000-0000-0000-000000000004');
insert into public.member_profiles(id,is_private) values
 ('00000000-0000-0000-0000-000000000001',false),('00000000-0000-0000-0000-000000000002',false),
 ('00000000-0000-0000-0000-000000000003',false),('00000000-0000-0000-0000-000000000004',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
insert into public.member_follows(follower_id,followed_id) values('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
do $$begin
 if (select count(*) from public.member_follows)<>1 then raise exception 'Cannot read own following';end if;
 begin insert into public.member_follows(follower_id,followed_id) values('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002');raise exception 'Forged follow allowed';exception when insufficient_privilege then null;end;
 begin insert into public.member_follows(follower_id,followed_id) values('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004');raise exception 'Private member follow allowed';exception when insufficient_privilege then null;end;
 begin insert into public.member_follows(follower_id,followed_id) values('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');raise exception 'Self follow allowed';exception when check_violation then null;end;
 begin update public.member_follows set followed_id='00000000-0000-0000-0000-000000000003';raise exception 'Reassignment allowed';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
do $$begin if (select count(*) from public.member_follows)<>1 then raise exception 'Cannot read own followers';end if;end$$;
delete from public.member_follows;
do $$begin if (select count(*) from public.member_follows)<>1 then raise exception 'Target deleted follower relationship';end if;end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
do $$begin if exists(select 1 from public.member_follows) then raise exception 'Unrelated member sees social graph';end if;end$$;
reset role;
set local role anon;
do $$begin begin perform 1 from public.member_follows;raise exception 'Anon reads follows';exception when insufficient_privilege then null;end;end$$;
reset role;
update public.profiles set suspended_at=now() where id='00000000-0000-0000-0000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
do $$begin begin insert into public.member_follows(follower_id,followed_id) values('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002');raise exception 'Suspended member can follow';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
insert into public.member_follows(follower_id,followed_id) values('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001');
insert into public.blocks(blocker_id,blocked_id) values('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001');
do $$begin if exists(select 1 from public.member_follows) then raise exception 'Block did not remove both follow directions';end if;end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$begin begin insert into public.member_follows(follower_id,followed_id) values('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');raise exception 'Blocked member can follow';exception when insufficient_privilege then null;end;end$$;
reset role;
delete from public.blocks;
set local role authenticated;
insert into public.member_follows(follower_id,followed_id) values('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
delete from public.member_follows where follower_id='00000000-0000-0000-0000-000000000001';
do $$begin if exists(select 1 from public.member_follows) then raise exception 'Unfollow failed';end if;end$$;
rollback;
select 'PASS: member follows ownership, private profiles, social graph visibility, suspension, blocking and unfollow' as result;
