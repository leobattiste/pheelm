alter table public.profiles drop constraint if exists profiles_bio_50_chars;
alter table public.profiles drop constraint if exists profiles_bio_130_chars;
alter table public.profiles add constraint profiles_bio_150_chars check(char_length(bio)<=150);
alter table public.profiles add column social_platform text,add column social_url text,add column website_url text;
alter table public.profiles add constraint profile_social_platform check(social_platform is null or social_platform in ('instagram','tiktok','youtube','threads','x','facebook','bluesky','linkedin'));
alter table public.profiles add constraint profile_social_url check(social_url is null or (char_length(social_url)<=500 and social_url ~ '^https://[^[:space:]]+$'));
alter table public.profiles add constraint profile_website_url check(website_url is null or (char_length(website_url)<=500 and website_url ~ '^https?://[^[:space:]]+$'));
alter table public.profiles add constraint profile_social_pair check((social_platform is null)=(social_url is null));
alter table public.profiles add constraint profile_social_host check(social_url is null or social_url ~* ('^https://([a-z0-9-]+[.])*' || case social_platform when 'instagram' then 'instagram[.]com' when 'tiktok' then 'tiktok[.]com' when 'youtube' then '(youtube[.]com|youtu[.]be)' when 'threads' then '(threads[.]com|threads[.]net)' when 'x' then '(x[.]com|twitter[.]com)' when 'facebook' then '(facebook[.]com|fb[.]com)' when 'bluesky' then 'bsky[.]app' when 'linkedin' then 'linkedin[.]com' end || '([/?#]|$)'));
alter table public.member_profiles add column social_platform text,add column social_url text,add column website_url text;
create or replace function public.sync_member_profile() returns trigger language plpgsql security definer set search_path='' as $$
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
end $$;
revoke all on function public.sync_member_profile() from public,anon,authenticated;
drop trigger if exists sync_member_photo on public.profiles;
drop trigger if exists sync_member_profile on public.profiles;
create trigger sync_member_profile after insert or update on public.profiles for each row execute function public.sync_member_profile();
