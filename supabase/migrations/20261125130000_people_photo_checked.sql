-- When a director's portrait was last looked up on TMDB, so people TMDB has no photo for aren't retried forever.
alter table public.people add column if not exists photo_checked_at timestamptz;
create index if not exists people_photo_todo_idx on public.people (id) where in_directory and photo_checked_at is null and (photo_url is null or photo_url = '');
