-- The published catalogue as one compressed file in Storage, rebuilt when catalog_version moves.
-- Servers read this one small row, then the file, instead of paging every table themselves.
create table if not exists public.catalog_snapshot (
  id int primary key default 1 check (id = 1),
  version bigint not null,
  path text not null check (path ~ '^v[0-9]+-[a-z0-9]+\.json\.gz$'),
  built_at timestamptz not null default now()
);
alter table public.catalog_snapshot enable row level security;
drop policy if exists "read" on public.catalog_snapshot;
create policy "read" on public.catalog_snapshot for select to anon, authenticated using (true);
grant select on public.catalog_snapshot to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog', 'catalog', true, 52428800, array['application/gzip'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
