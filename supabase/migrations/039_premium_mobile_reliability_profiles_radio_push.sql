-- Central GO: identidad visual segura, radio push y administración global exclusiva.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-images','profile-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists profile_images_insert on storage.objects;
create policy profile_images_insert on storage.objects for insert to authenticated with check(
 bucket_id='profile-images' and (
  ((storage.foldername(name))[1]='users' and (storage.foldername(name))[2]=(select auth.uid())::text)
  or ((storage.foldername(name))[1]='companies' and exists(select 1 from public.companies c where c.id::text=(storage.foldername(name))[2] and (public.centralgo_is_super_admin() or public.centralgo_has_company_role(c.id,array['company_admin'::public.centralgo_company_role]))))
 )
);
drop policy if exists profile_images_update on storage.objects;
create policy profile_images_update on storage.objects for update to authenticated using(
 bucket_id='profile-images' and (((storage.foldername(name))[1]='users' and (storage.foldername(name))[2]=(select auth.uid())::text) or public.centralgo_is_super_admin() or exists(select 1 from public.companies c where c.id::text=(storage.foldername(name))[2] and public.centralgo_has_company_role(c.id,array['company_admin'::public.centralgo_company_role])))
) with check(bucket_id='profile-images');
drop policy if exists profile_images_delete on storage.objects;
create policy profile_images_delete on storage.objects for delete to authenticated using(
 bucket_id='profile-images' and (((storage.foldername(name))[1]='users' and (storage.foldername(name))[2]=(select auth.uid())::text) or public.centralgo_is_super_admin() or exists(select 1 from public.companies c where c.id::text=(storage.foldername(name))[2] and public.centralgo_has_company_role(c.id,array['company_admin'::public.centralgo_company_role])))
);

create or replace function public.centralgo_update_own_avatar(p_url text) returns void
language plpgsql security definer set search_path=public as $function$
begin
 if auth.uid() is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
 if p_url is null or length(p_url)>1500 or position('/storage/v1/object/public/profile-images/users/'||(auth.uid())::text||'/' in p_url)=0 then raise exception 'URL de avatar inválida' using errcode='22023'; end if;
 update public.profiles set avatar_url=p_url where id=auth.uid();
 update public.drivers set photo_url=p_url where user_id=auth.uid();
end;$function$;
revoke all on function public.centralgo_update_own_avatar(text) from public,anon;
grant execute on function public.centralgo_update_own_avatar(text) to authenticated;

create or replace function public.centralgo_update_company_logo(p_company_id uuid,p_url text) returns void
language plpgsql security definer set search_path=public as $function$
begin
 if not (public.centralgo_is_super_admin() or public.centralgo_has_company_role(p_company_id,array['company_admin'::public.centralgo_company_role])) then raise exception 'Sin permiso para editar esta central' using errcode='42501'; end if;
 if p_url is null or length(p_url)>1500 or position('/storage/v1/object/public/profile-images/companies/'||p_company_id::text||'/' in p_url)=0 then raise exception 'URL de central inválida' using errcode='22023'; end if;
 update public.companies set logo_url=p_url where id=p_company_id;
end;$function$;
revoke all on function public.centralgo_update_company_logo(uuid,text) from public,anon;
grant execute on function public.centralgo_update_company_logo(uuid,text) to authenticated;

-- La administración de identidades pertenece al panel global, no al panel de cada central.
drop policy if exists memberships_admin_delete on public.company_memberships;
drop policy if exists memberships_admin_insert on public.company_memberships;
drop policy if exists memberships_admin_update on public.company_memberships;
drop policy if exists memberships_read on public.company_memberships;
create policy memberships_global_read on public.company_memberships for select to authenticated using(user_id=(select auth.uid()) or public.centralgo_is_super_admin());
create policy memberships_global_insert on public.company_memberships for insert to authenticated with check(public.centralgo_is_super_admin());
create policy memberships_global_update on public.company_memberships for update to authenticated using(public.centralgo_is_super_admin()) with check(public.centralgo_is_super_admin());
create policy memberships_global_delete on public.company_memberships for delete to authenticated using(public.centralgo_is_super_admin());

create or replace function public.centralgo_company_user_directory(p_company_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $function$
begin
 if not public.centralgo_is_super_admin() then raise exception 'Usuarios y permisos pertenecen al Panel Global' using errcode='42501'; end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('userId',cm.user_id,'name',pr.name,'email',au.email,'phone',pr.phone,'role',cm.role::text,'active',cm.active,'createdAt',cm.created_at) order by cm.created_at asc),'[]'::jsonb) from public.company_memberships cm join public.profiles pr on pr.id=cm.user_id left join auth.users au on au.id=cm.user_id where cm.company_id=p_company_id);
end;$function$;
revoke all on function public.centralgo_company_user_directory(uuid) from public,anon;
grant execute on function public.centralgo_company_user_directory(uuid) to authenticated;

create or replace function public.centralgo_notify_driver_radio_push() returns trigger
language plpgsql security definer set search_path=public,extensions as $function$
declare secret_value text;function_url text:='https://cuazdzsvgwrnpczbvrgx.supabase.co/functions/v1/push-driver-trip';
begin
 if new.recipient_user_id is null or new.title not like 'RADIO CENTRAL%' then return new;end if;
 select value into secret_value from public.centralgo_private_settings where key='push_internal_secret';if secret_value is null then return new;end if;
 perform net.http_post(url:=function_url,headers:=jsonb_build_object('Content-Type','application/json','x-centralgo-push-secret',secret_value),body:=jsonb_build_object('notificationId',new.id),timeout_milliseconds:=5000);
 return new;
exception when others then raise warning 'Central GO radio push failed for notification %: %',new.id,sqlerrm;return new;end;$function$;
revoke all on function public.centralgo_notify_driver_radio_push() from public,anon,authenticated;
drop trigger if exists centralgo_notifications_driver_radio_push on public.notifications;
create trigger centralgo_notifications_driver_radio_push after insert on public.notifications for each row when(new.recipient_user_id is not null and new.title like 'RADIO CENTRAL%') execute function public.centralgo_notify_driver_radio_push();
