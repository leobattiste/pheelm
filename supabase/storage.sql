-- Storage for posters, portraits and journal images
-- Run once in the Supabase SQL editor, after schema.sql.
-- Creates a public "images" bucket that anyone can view and only admins can change.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;

drop policy if exists "images are public" on storage.objects;
create policy "images are public" on storage.objects
  for select using (bucket_id = 'images');

drop policy if exists "admins add images" on storage.objects;
create policy "admins add images" on storage.objects
  for insert to authenticated with check (bucket_id = 'images' and public.is_admin());

drop policy if exists "admins change images" on storage.objects;
create policy "admins change images" on storage.objects
  for update to authenticated using (bucket_id = 'images' and public.is_admin())
  with check (bucket_id = 'images' and public.is_admin());

drop policy if exists "admins remove images" on storage.objects;
create policy "admins remove images" on storage.objects
  for delete to authenticated using (bucket_id = 'images' and public.is_admin());
