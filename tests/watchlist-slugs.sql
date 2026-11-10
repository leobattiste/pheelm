begin;
do $$declare n int;first_slug text;target uuid;next_slug text;begin
 if exists(select 1 from public.lists where slug is null) then raise exception 'Backfill missed a list';end if;
 if(select count(distinct slug) from public.lists)<>(select count(*) from public.lists) then raise exception 'Backfill generated duplicate slugs';end if;
 if(select slug from public.lists where title='École de cinéma')<>'ecole-de-cinema' then raise exception 'Accent normalization failed';end if;
 insert into public.lists(title,slug)values('Duplicate test','untrusted-custom-name')returning id,slug into target,first_slug;
 if first_slug<>'duplicate-test' then raise exception 'Client controlled slug';end if;
 insert into public.lists(title)values('Duplicate test')returning slug into next_slug;
 if next_slug<>'duplicate-test-2' then raise exception 'Duplicate allocation failed';end if;
 update public.lists set title='Renamed',slug='hijacked-name' where id=target returning slug into next_slug;
 if next_slug<>first_slug then raise exception 'Renaming broke existing URL';end if;
 if has_function_privilege('anon','pheelm_private.assign_watchlist_slug()','execute') or has_function_privilege('authenticated','pheelm_private.assign_watchlist_slug()','execute') then raise exception 'Internal trigger exposed';end if;
end $$;
set local role anon;
do $$begin if exists(select 1 from public.lists where not is_public or hidden)then raise exception 'Private watchlist visible anonymously';end if;end$$;
reset role;
rollback;
