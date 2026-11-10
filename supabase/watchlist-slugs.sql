-- Canonical names are immutable: renaming a watchlist never breaks a shared link.
alter table public.lists add column slug text;
create unique index lists_slug_unique on public.lists(slug);
create schema if not exists pheelm_private;
revoke all on schema pheelm_private from public,anon,authenticated;

-- Internal trigger only. Definer access is needed to avoid slug collisions with private lists.
-- It returns no other row data and is not exposed through the Data API.
create function pheelm_private.assign_watchlist_slug() returns trigger
language plpgsql security definer set search_path='' as $$
declare base text; candidate text; suffix integer:=1;
begin
 if tg_op='UPDATE' and old.slug is not null then new.slug:=old.slug;return new;end if;
 base:=trim(both '-' from left(regexp_replace(lower(normalize(coalesce(new.title,''),NFKD)),'[^a-z0-9]+','-','g'),90));
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
create trigger assign_watchlist_slug before insert or update of slug on public.lists
for each row execute function pheelm_private.assign_watchlist_slug();

-- Deterministic allocation for existing records; no content, visibility or IDs are changed.
do $$declare item record;begin
 for item in select id from public.lists order by created_at,id loop
  update public.lists set slug=null where id=item.id;
 end loop;
end $$;
alter table public.lists alter column slug set not null;
alter table public.lists add constraint lists_slug_format check(length(slug)<=120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Future digest links use the same canonical paths, with visibility checked again at send time.
do $$begin
 if to_regclass('pheelm_email.discoverable_catalog') is not null then
  execute $view$create or replace view pheelm_email.discoverable_catalog as
   select 'film'::text kind,f.id entity_id,f.title title,'/films/'||f.slug path from public.films f where f.status='published'
   union all
   select distinct 'director',p.id,p.name,'/directors/'||p.slug from public.people p join public.credits c on c.person_id=p.id and c.role='director' join public.films f on f.id=c.film_id and f.status='published' where p.in_directory is distinct from false
   union all
   select 'collection',l.id,l.title,'/watchlists/'||l.slug from public.lists l join public.profiles p on p.id=l.user_id where l.is_public and not l.hidden and not coalesce(p.is_private,false) and p.handle is not null and (l.staff_pick or (select count(*) from public.list_films lf join public.films f on f.id=lf.film_id and f.status='published' where lf.list_id=l.id)>=5)$view$;
 end if;
end $$;
