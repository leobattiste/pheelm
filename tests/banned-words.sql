-- Checks for supabase/banned-words.sql. Run after tests/banned-words-bootstrap.sql and the migration.
begin;
-- Caught, with tricks: case, look-alikes, punctuation between letters, stretched letters, endings.
do $$declare t text; got text; begin
  foreach t in array array['what the fuck', 'FUCK this', 'f.u.c.k', 'fuuuuck', 'a b1tch', 'what a c.u.n.t', 'bitches', 'fucking great', 'motherfucker', 'you n1gger', 'faggot', '@sshole', 'porch monkey', 'porchmonkeys', 'porch-monkey', 'jungle  bunny', 'battyman', 'batty boy', 'wankers', 'spaz', 'yids'] loop
    got := private.first_banned_word(t);
    if got is null then raise exception 'Missed: %', t; end if;
  end loop;
  if private.first_banned_word('what the fuck') <> 'fuck' then raise exception 'Wrong word reported'; end if;
end$$;
-- Ordinary words and film talk stay allowed.
do $$declare t text; begin
  foreach t in array array['A film from Niger', 'Nigeria and Senegal', 'Scunthorpe', 'add some spice', 'a raccoon', 'cocoon', 'a class act', 'Shiitake', 'passage', 'assassin',
                           'cockpit', 'Dick Gregory', 'Pitch Black', 'Spice World', 'what a shit ending', 'total bullshit', 'Shitamachi', 'Cooney', 'Yiddish theatre', 'Santiago', 'a monkey on the porch', 'Bugs Bunny', 'batty old man', 'retardant', '', null] loop
    if private.first_banned_word(t) is not null then raise exception 'False positive: % (%)', t, private.first_banned_word(t); end if;
  end loop;
end$$;
-- The site's check names the word and logs the attempt; it needs a signed-in member.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
set local role authenticated;
do $$begin
  if public.check_text('comment', 'Loved it') is not null then raise exception 'Clean text refused'; end if;
  if public.check_text('comment', 'what a b1tch of an ending') <> 'Swearing isn''t allowed on Pheelm. Try “b-word” instead.' then raise exception 'Check missed the word'; end if;
  if public.check_text('bio', 'b1tches') <> 'Swearing isn''t allowed on Pheelm. Try “b-word” instead.' then raise exception 'Wrong suggestion'; end if;
  if public.check_text('comment', 'porch monkey') <> 'Racial slurs aren''t allowed on Pheelm. Remove it and try again.' then raise exception 'Phrase missed'; end if;
  if public.check_text('comment', 'that n1gga') <> 'Racial slurs aren''t allowed on Pheelm. Try “n-word” instead.' then raise exception 'Wrong n-word message'; end if;
  -- The suggested alternatives themselves are allowed.
  if public.check_text('comment', 'the f-word, b-word, n-word, f-slur, r-word, c-word, jerk') is not null then raise exception 'An alternative is banned'; end if;
end$$;
-- The backstop refuses banned words in comments, bios and descriptions, with the word in the message.
do $$begin begin insert into public.list_comments(user_id, body) values (auth.uid(), 'what an assh0le'); raise exception 'Comment saved';
  exception when check_violation then if sqlerrm <> 'Swearing isn''t allowed on Pheelm. Try “jerk” instead.' then raise; end if; end; end$$;
do $$begin begin update public.profiles set bio = 'bitch please' where id = auth.uid(); raise exception 'Bio saved';
  exception when check_violation then null; end; end$$;
do $$begin begin insert into public.lists(user_id, title, description) values (auth.uid(), 'x', 'f-u-c-k'); raise exception 'Description saved';
  exception when check_violation then null; end; end$$;
-- Clean text saves without any receipt now.
insert into public.list_comments(user_id, body) values (auth.uid(), 'Loved it');
update public.profiles set bio = 'Watching everything from Dakar to Lagos.' where id = auth.uid();
reset role;
do $$begin if (select count(*) from private.moderation_refusals where reason = 'Banned word: bitch') <> 2 then raise exception 'Refusal not logged'; end if; end$$;
-- Removing a comment with replies (its text becomes 'removed') and admin or maintenance writes aren't checked.
select set_config('request.jwt.claim.sub', '', true);
insert into public.list_comments(user_id, body) values ('00000000-0000-0000-0000-00000000000b', 'fuck (written by maintenance)');
-- Signed out: no checking through the site's function.
do $$begin begin perform public.check_text('comment', 'x'); raise exception 'Anonymous check allowed'; exception when insufficient_privilege then null; end; end$$;
rollback;
select 'banned words ok';
