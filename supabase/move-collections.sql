-- Move Pheelm's own collections into @leo's collections, so every collection works the same way
-- (comments, collaboration, editing on the collection page). Run after collaboration.sql.
-- The old collections tables are left as they were, as a backup. Safe to run more than once:
-- a collection already moved (same legacy_slug) is skipped.

alter table public.lists add column if not exists legacy_slug text;
create unique index if not exists lists_legacy_slug_idx on public.lists (legacy_slug) where legacy_slug is not null;

-- Staff picks and owners are normally protected from changes; this move is done by the site.
alter table public.lists disable trigger guard_list_flags;

insert into public.lists (id, user_id, title, description, is_public, staff_pick, legacy_slug, created_at, updated_at)
select gen_random_uuid(), p.id, c.title, c.description, true, true, c.slug,
       -- Newest first in "popular" order, so the featured ones lead, then the old order.
       now() - (row_number() over (order by c.featured desc, c.sort_order, c.title)) * interval '1 minute',
       now()
from public.collections c
cross join (select id from public.profiles where handle = 'leo') p
where not exists (select 1 from public.lists l where l.legacy_slug = c.slug);

insert into public.list_films (list_id, film_id, added_at, added_by)
select l.id, cf.film_id, now() - cf.sort * interval '1 second', l.user_id
from public.collection_films cf
join public.collections c on c.id = cf.collection_id
join public.lists l on l.legacy_slug = c.slug
where not exists (select 1 from public.list_films x where x.list_id = l.id and x.film_id = cf.film_id);

alter table public.lists enable trigger guard_list_flags;
