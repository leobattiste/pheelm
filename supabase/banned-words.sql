-- A list of words that can't be used in comments, bios or watchlist descriptions. Replaces the
-- outside content check (content-moderation.sql). The site checks text before saving and tells
-- the member which word to remove; the database refuses the same words as a backstop, so a direct
-- request to Supabase can't get around it. Safe to run more than once.
--
-- Matching ignores case, common look-alike characters (0→o, 1→i, 3→e, 4→a, 5→s, @→a, $→s),
-- dots, dashes, underscores or asterisks between letters, and stretched letters ("fuuuck"),
-- and catches common endings (s, ed, er, ing…). Whole words only, so "Scunthorpe", "Niger" and
-- "spice" are fine. To add or remove a word:
--   insert into private.banned_words (word) values ('word');
--   delete from private.banned_words where word = 'word';

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.banned_words (
  word text primary key check (word ~ '^[a-z]+$'),
  added_at timestamptz not null default now()
);
revoke all on private.banned_words from public, anon, authenticated;

insert into private.banned_words (word) values
  -- Strong language
  ('fuck'), ('motherfuck'), ('motherfucker'), ('shit'), ('bullshit'), ('bitch'), ('asshole'), ('cunt'), ('twat'), ('whore'), ('slut'),
  -- Slurs
  ('nigger'), ('nigga'), ('sandnigger'), ('coon'), ('jigaboo'), ('spic'), ('wetback'), ('beaner'), ('chink'), ('gook'), ('kike'),
  ('paki'), ('raghead'), ('towelhead'), ('faggot'), ('fag'), ('tranny'), ('retard')
on conflict (word) do nothing;

-- Text as it's compared: lower case, look-alike characters swapped, letters split by punctuation joined.
create or replace function private.words_for_matching(t text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(translate(lower(coalesce(t, '')), '01345@$', 'oieasas'), '([a-z])[-._*]+(?=[a-z])', '\1', 'g')
$$;

-- The first banned word in the text, or null. Stretched letters match ("fuuuck"), and so do
-- common endings, but only whole words.
create or replace function private.first_banned_word(p_text text) returns text
language plpgsql stable set search_path = '' as $$
declare t text := private.words_for_matching(p_text); w text;
begin
  if btrim(t) = '' then return null; end if;
  for w in select b.word from private.banned_words b order by length(b.word) desc, b.word loop
    if t ~ ('\m' || regexp_replace(w, '([a-z])', '\1+', 'g') || '(s|es|ed|er|ers|ing|in|y|ty|z)?\M') then
      return w;
    end if;
  end loop;
  return null;
end $$;

-- For the site, before saving: which banned word the member used, if any. Also keeps the attempt
-- in the admin's Refused text log (90 days).
create or replace function public.check_text(p_field text, p_text text) returns text
language plpgsql security definer set search_path = '' as $$
declare w text;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if p_field not in ('comment', 'bio', 'watchlist_description') or char_length(coalesce(p_text, '')) > 10000 then
    raise exception 'Invalid text check' using errcode = '22023';
  end if;
  w := private.first_banned_word(p_text);
  if w is not null then
    delete from private.moderation_refusals where created_at < now() - interval '90 days';
    insert into private.moderation_refusals (actor_id, field, excerpt, reason)
      values (auth.uid(), p_field, left(btrim(p_text), 300), 'Banned word: ' || w);
  end if;
  return w;
end $$;
revoke all on function public.check_text(text, text) from public, anon;
grant execute on function public.check_text(text, text) to authenticated;

-- The backstop: new or changed text with a banned word isn't saved. Admin tools and
-- maintenance (no signed-in member) aren't checked, and neither is removing a comment.
create or replace function public.refuse_banned_words() returns trigger
language plpgsql security definer set search_path = '' as $$
declare body_text text; w text;
begin
  if auth.uid() is null then return new; end if;
  if tg_table_name = 'list_comments' then
    if tg_op = 'UPDATE' and (new.body is not distinct from old.body or new.removed_at is not null) then return new; end if;
    body_text := new.body;
  elsif tg_table_name = 'profiles' then
    if tg_op = 'UPDATE' and new.bio is not distinct from old.bio then return new; end if;
    body_text := new.bio;
  elsif tg_table_name = 'lists' then
    if tg_op = 'UPDATE' and new.description is not distinct from old.description then return new; end if;
    body_text := new.description;
  else
    return new;
  end if;
  w := private.first_banned_word(body_text);
  if w is not null then
    raise exception '“%” can''t be used on Pheelm. Remove it and try again.', w using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function public.refuse_banned_words() from public, anon, authenticated;

drop trigger if exists refuse_banned_words on public.list_comments;
create trigger refuse_banned_words before insert or update on public.list_comments
  for each row execute function public.refuse_banned_words();
drop trigger if exists refuse_banned_words on public.profiles;
create trigger refuse_banned_words before insert or update on public.profiles
  for each row execute function public.refuse_banned_words();
drop trigger if exists refuse_banned_words on public.lists;
create trigger refuse_banned_words before insert or update on public.lists
  for each row execute function public.refuse_banned_words();

-- The outside check's receipts are no longer needed.
drop trigger if exists require_moderation_comments on public.list_comments;
drop trigger if exists require_moderation_profiles on public.profiles;
drop trigger if exists require_moderation_lists on public.lists;
drop function if exists public.require_moderated_content();
drop function if exists public.record_moderation_approval(uuid, text, text);
drop table if exists private.moderation_approvals;
