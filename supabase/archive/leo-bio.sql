-- Owner privileges are protected by profiles' existing UPDATE row-level policy.
-- Require both the reserved account's stored handle and its owner role.
alter table public.profiles drop constraint if exists profiles_bio_150_chars;
alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles drop constraint if exists profiles_bio_150_chars_except_leo;
alter table public.profiles add constraint profiles_bio_150_chars_except_leo
  check (coalesce(handle = 'leo' and is_owner, false) or char_length(bio) <= 150);
