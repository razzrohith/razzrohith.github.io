-- Tighten DealNest deal image uploads.
-- Public reads stay open because approved deal images are public assets.
-- Member uploads must live under a folder named with the uploader auth uid.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deal-images',
  'deal-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated upload deal images" on storage.objects;
drop policy if exists "Users upload own deal images" on storage.objects;
create policy "Users upload own deal images" on storage.objects
  for insert
  with check (
    bucket_id = 'deal-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update own deal images" on storage.objects;
create policy "Users update own deal images" on storage.objects
  for update
  using (
    bucket_id = 'deal-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'deal-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete own deal images" on storage.objects;
create policy "Users delete own deal images" on storage.objects
  for delete
  using (
    bucket_id = 'deal-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Moderators manage deal image objects" on storage.objects;
create policy "Moderators manage deal image objects" on storage.objects
  for all
  using (
    bucket_id = 'deal-images'
    and public.is_moderator_or_admin()
  )
  with check (
    bucket_id = 'deal-images'
    and public.is_moderator_or_admin()
  );

commit;
