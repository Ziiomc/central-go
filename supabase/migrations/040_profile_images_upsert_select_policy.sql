-- Upsert requires SELECT in addition to INSERT/UPDATE; keep listing scoped.
drop policy if exists profile_images_select_own on storage.objects;
create policy profile_images_select_own on storage.objects for select to authenticated using(
 bucket_id='profile-images' and (
  ((storage.foldername(name))[1]='users' and (storage.foldername(name))[2]=(select auth.uid())::text)
  or public.centralgo_is_super_admin()
  or ((storage.foldername(name))[1]='companies' and exists(select 1 from public.companies c where c.id::text=(storage.foldername(name))[2] and public.centralgo_has_company_role(c.id,array['company_admin'::public.centralgo_company_role])))
 )
);
