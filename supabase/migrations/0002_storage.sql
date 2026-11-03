-- EBNEO CMS — figure storage (plan S4)
-- New figure uploads from the admin go here. The 196 existing figures stay in the
-- repo at /img/... (decision §3.3), so no public URL changes. This bucket is
-- public-read (the baked static site references the public object URL directly);
-- only invited editors can write.

begin;

insert into storage.buckets (id, name, public)
values ('figures', 'figures', true)
on conflict (id) do nothing;

-- Public read (also covered by the public bucket path, but explicit for the API).
drop policy if exists figures_public_read on storage.objects;
create policy figures_public_read
  on storage.objects for select
  to public
  using (bucket_id = 'figures');

-- Editor-only write/update/delete.
drop policy if exists figures_editor_insert on storage.objects;
create policy figures_editor_insert
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'figures' and public.is_editor());

drop policy if exists figures_editor_update on storage.objects;
create policy figures_editor_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'figures' and public.is_editor())
  with check (bucket_id = 'figures' and public.is_editor());

drop policy if exists figures_editor_delete on storage.objects;
create policy figures_editor_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'figures' and public.is_editor());

commit;
