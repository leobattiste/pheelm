-- Private profiles expose only their handle in the public member directory.
create or replace function public.sync_member_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.handle is null then
    delete from public.member_profiles where id = new.id;
  else
    insert into public.member_profiles (id, handle, display_name, is_private, country, bio, avatar_url)
    values (new.id, new.handle,
      case when new.is_private then null else new.display_name end, new.is_private,
      case when new.is_private then null else new.country end,
      case when new.is_private then null else new.bio end,
      case when new.is_private then null else new.avatar_url end)
    on conflict (id) do update set handle = excluded.handle, display_name = excluded.display_name,
      is_private = excluded.is_private, country = excluded.country, bio = excluded.bio, avatar_url = excluded.avatar_url;
  end if;
  return new;
end $$;
revoke execute on function public.sync_member_profile() from public, anon, authenticated;

-- Reconcile existing directory rows, including profiles made private before this fix.
update public.member_profiles m set
  display_name = case when p.is_private then null else p.display_name end,
  country = case when p.is_private then null else p.country end,
  bio = case when p.is_private then null else p.bio end,
  avatar_url = case when p.is_private then null else p.avatar_url end
from public.profiles p where p.id = m.id;
