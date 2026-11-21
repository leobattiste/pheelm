-- Track publication independently of draft creation. Existing publication dates are unknown;
-- creation time is the best available historical fallback. No catalog visibility/RLS changes.
alter table public.films add column if not exists published_at timestamptz;
update public.films set published_at=created_at where status='published' and published_at is null;
create or replace function public.stamp_film_publication() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.status='published' then
  if TG_OP='INSERT' then new.published_at=now();
  elsif old.status is distinct from 'published' then new.published_at=now();
  else new.published_at=old.published_at;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.stamp_film_publication() from public,anon,authenticated;
drop trigger if exists stamp_film_publication on public.films;
create trigger stamp_film_publication before insert or update of status on public.films
for each row execute function public.stamp_film_publication();
