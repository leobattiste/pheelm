-- Profile pages: a private setting, a country and a short bio.
-- Run after hardening.sql. Safe to run more than once.

alter table public.profiles add column if not exists is_private boolean not null default false;
alter table public.member_profiles add column if not exists is_private boolean not null default false;
alter table public.profiles add column if not exists country text;
alter table public.member_profiles add column if not exists country text;
alter table public.profiles drop constraint if exists profiles_country_code;
alter table public.profiles add constraint profiles_country_code check (country ~ '^[A-Z]{2}$');
alter table public.profiles add column if not exists bio text;
alter table public.member_profiles add column if not exists bio text;
alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles add constraint profiles_bio_length check (char_length(bio) <= 300);

create or replace function public.sync_member_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.handle is null then
    delete from public.member_profiles where id = new.id;
  else
    insert into public.member_profiles (id, handle, display_name, is_private, country, bio)
    values (new.id, new.handle, new.display_name, new.is_private, new.country, new.bio)
    on conflict (id) do update set handle = excluded.handle, display_name = excluded.display_name,
      is_private = excluded.is_private, country = excluded.country, bio = excluded.bio;
  end if;
  return new;
end $$;
revoke execute on function public.sync_member_profile() from public, anon, authenticated;
drop trigger if exists sync_member_profile on public.profiles;
create trigger sync_member_profile after insert or update of handle, display_name, is_private, country, bio on public.profiles
  for each row execute function public.sync_member_profile();

update public.member_profiles m set is_private = p.is_private, country = p.country, bio = p.bio from public.profiles p where p.id = m.id;
