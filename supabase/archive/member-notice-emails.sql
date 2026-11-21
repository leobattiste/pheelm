-- Emails members when an admin changes their role or suspends or restores them.
-- Account deletion already sends "account-deleted" (supabase/email-system.sql).
-- Needs the four templates deployed with the pheelm-email worker first (role-granted, role-removed,
-- account-suspended, account-restored).
create or replace function pheelm_email.member_notice() returns trigger
language plpgsql security definer set search_path = '' as $$
declare address text;
begin
  select email into address from auth.users where id = new.id and email_confirmed_at is not null;
  if address is null then return new; end if;
  if new.is_admin is distinct from old.is_admin then
    if new.is_admin then
      perform pheelm_email.enqueue('role-granted:'||new.id||':'||extract(epoch from clock_timestamp())::bigint, new.id, address, 'role-granted',
        'The owner made you an admin on Pheelm.', '/admin');
    else
      perform pheelm_email.enqueue('role-removed:'||new.id||':'||extract(epoch from clock_timestamp())::bigint, new.id, address, 'role-removed',
        'The owner removed your admin role on Pheelm.', '/');
    end if;
  end if;
  if new.suspended_at is not null and old.suspended_at is null then
    perform pheelm_email.enqueue('suspended:'||new.id||':'||extract(epoch from new.suspended_at)::bigint, new.id, address, 'account-suspended',
      'Your Pheelm account has been suspended.', '/contact');
  elsif new.suspended_at is null and old.suspended_at is not null then
    perform pheelm_email.enqueue('restored:'||new.id||':'||extract(epoch from clock_timestamp())::bigint, new.id, address, 'account-restored',
      'Your Pheelm account has been restored.', '/login');
  end if;
  return new;
end $$;
revoke all on function pheelm_email.member_notice() from public, anon, authenticated;
drop trigger if exists pheelm_email_member_notice on public.profiles;
create trigger pheelm_email_member_notice after update of is_admin, suspended_at on public.profiles
  for each row execute function pheelm_email.member_notice();
