\set ON_ERROR_STOP on
begin;
insert into public.profiles(id,handle,display_name,bio,social_platform,social_url,website_url) values('00000000-0000-0000-0000-000000000001','test','Test',repeat('b',150),'instagram','https://instagram.com/test','https://example.com');
do $$begin if not exists(select 1 from public.member_profiles where social_url='https://instagram.com/test' and char_length(bio)=150) then raise exception 'Public profile fields not mirrored';end if;end$$;
update public.profiles set is_private=true where handle='test';
do $$begin if exists(select 1 from public.member_profiles where id='00000000-0000-0000-0000-000000000001' and (bio is not null or social_url is not null or website_url is not null or social_platform is not null)) then raise exception 'Private profile information exposed';end if;end$$;
do $$begin begin update public.profiles set bio=repeat('x',151);raise exception 'Bio limit missing';exception when check_violation then null;end;begin update public.profiles set social_url='https://instagram.com.evil.example/test';raise exception 'Social host validation missing';exception when check_violation then null;end;begin update public.profiles set website_url='javascript:alert(1)';raise exception 'Website scheme validation missing';exception when check_violation then null;end;end$$;
update public.profiles set is_private=false;
do $$begin if not exists(select 1 from public.member_profiles where social_url='https://instagram.com/test') then raise exception 'Making a profile public did not restore links';end if;end$$;
rollback;
select 'PASS: 150-character bio, social host/website validation and public/private profile mirroring' as result;
