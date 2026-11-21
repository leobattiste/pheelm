-- Strip combining accents before replacing word separators, independent of database locale.
create or replace function pheelm_private.assign_watchlist_slug() returns trigger
language plpgsql security definer set search_path='' as $$
declare base text; candidate text; suffix integer:=1;
begin
 if tg_op='UPDATE' and old.slug is not null then new.slug:=old.slug;return new;end if;
 base:=trim(both '-' from left(regexp_replace(lower(regexp_replace(normalize(coalesce(new.title,''),NFKD),U&'[\0300-\036f]','','g')),'[^a-z0-9]+','-','g'),90));
 if base='' then base:='watchlist';end if;
 -- Serialize allocation across all names, including a name that already ends in '-2'.
 perform pg_advisory_xact_lock(hashtextextended('pheelm-watchlist-slug-allocation',0));
 candidate:=base;
 while exists(select 1 from public.lists where slug=candidate and id<>new.id) loop
  suffix:=suffix+1;candidate:=base||'-'||suffix;
 end loop;
 new.slug:=candidate;return new;
end $$;
revoke all on function pheelm_private.assign_watchlist_slug() from public,anon,authenticated;
