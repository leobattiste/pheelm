-- User profile photos. Run after profiles-private.sql.
-- Photos are public assets; private profiles don't publish their photo URL in the member directory.
alter table public.profiles add column if not exists avatar_url text;
alter table public.member_profiles add column if not exists avatar_url text;
alter table public.profiles add constraint profiles_avatar_own_path check (
  avatar_url is null or avatar_url ~ (
    '^https://mvhwfmlairwrngdttzjh[.]supabase[.]co/storage/v1/object/public/avatars/' || id::text || '/[0-9a-f-]+[.]webp$'
  )
);

create or replace function public.sync_member_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.handle is null then
    delete from public.member_profiles where id = new.id;
  else
    insert into public.member_profiles (id, handle, display_name, is_private, country, bio, avatar_url)
    values (new.id, new.handle, new.display_name, new.is_private, new.country, new.bio,
      case when new.is_private then null else new.avatar_url end)
    on conflict (id) do update set handle = excluded.handle, display_name = excluded.display_name,
      is_private = excluded.is_private, country = excluded.country, bio = excluded.bio, avatar_url = excluded.avatar_url;
  end if;
  return new;
end $$;
revoke execute on function public.sync_member_profile() from public, anon, authenticated;
create trigger sync_member_photo after update of avatar_url on public.profiles
  for each row execute function public.sync_member_profile();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 3145728, array['image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "members read own avatar objects" on storage.objects
  for select to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "members upload own avatars" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text and storage.extension(name) = 'webp');
create policy "members delete own avatars" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
