-- Private buckets and their access rules.
--   photos:  {user_id}/{scan_id}/{view}.jpg   customer uploads/reads own folder;
--            the assigned reviewer and admins read.
--   visuals: {order_id}/{generation_id}.jpg   written by edge functions only;
--            the assigned reviewer and admins read. Customers get signed URLs
--            for approved visuals from the customer-visuals function.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos',  'photos',  false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('visuals', 'visuals', false, 15728640, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Path helpers. They compare text, so a malformed path never raises a cast error.
create or replace function public.can_review_photo_path(p_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.scans s
    where s.id::text = split_part(p_name, '/', 2)
      and s.user_id::text = split_part(p_name, '/', 1)
      and public.can_review_order(s.order_id)
  );
$$;

create or replace function public.can_review_visual_path(p_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.orders o
    where o.id::text = split_part(p_name, '/', 1)
      and public.can_review_order(o.id)
  );
$$;

drop policy if exists "photos: customer uploads own" on storage.objects;
drop policy if exists "photos: customer replaces own" on storage.objects;
drop policy if exists "photos: customer reads own" on storage.objects;
drop policy if exists "photos: customer deletes own" on storage.objects;
drop policy if exists "photos: reviewer reads assigned" on storage.objects;
drop policy if exists "photos: admin deletes" on storage.objects;
drop policy if exists "visuals: reviewer reads assigned" on storage.objects;
drop policy if exists "visuals: admin deletes" on storage.objects;

create policy "photos: customer uploads own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and array_length(string_to_array(name, '/'), 1) = 3
  );

create policy "photos: customer replaces own" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and split_part(name, '/', 1) = (select auth.uid())::text)
  with check (bucket_id = 'photos' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy "photos: customer reads own" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy "photos: customer deletes own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy "photos: reviewer reads assigned" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and public.can_review_photo_path(name));

create policy "photos: admin deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (select public.is_admin()));

create policy "visuals: reviewer reads assigned" on storage.objects
  for select to authenticated
  using (bucket_id = 'visuals' and public.can_review_visual_path(name));

create policy "visuals: admin deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'visuals' and (select public.is_admin()));

-- Photo objects that belong to no scan still holding photos: uploads whose
-- scan row was never written, files left after a purge, retakes under another
-- name. Only objects older than p_min_age_hours, so uploads in progress are
-- left alone. purge-photos removes them through the Storage API.
create or replace function public.orphan_photo_objects(p_min_age_hours int default 72, p_limit int default 500)
returns table (name text)
language sql stable security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'photos'
    and o.created_at < now() - make_interval(hours => p_min_age_hours)
    and not exists (
      select 1 from public.scans s
      where s.id::text = split_part(o.name, '/', 2)
        and s.user_id::text = split_part(o.name, '/', 1)
        and s.photos_deleted_at is null
    )
  order by o.created_at
  limit greatest(1, least(p_limit, 1000));
$$;

revoke execute on function public.orphan_photo_objects(int, int) from public, anon, authenticated;
grant execute on function public.orphan_photo_objects(int, int) to service_role;
