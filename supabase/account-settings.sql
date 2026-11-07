-- Settings: deleting your own account. Run after collection-follows.sql. Safe to run more than once.
--
-- Deleting the auth user removes the profile, Watchlist, collections, follows, comments and
-- notifications with it (their foreign keys cascade); suggestions and reports are kept, unlinked.

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
