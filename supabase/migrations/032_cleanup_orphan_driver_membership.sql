create or replace function public.centralgo_cleanup_orphan_driver_membership(p_company_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.active = true and p.global_role = 'super_admin'
    )
    or public.centralgo_has_company_role(p_company_id, array['company_admin']::public.centralgo_company_role[])
  ) then
    raise exception 'Sin permiso para limpiar accesos de conductor' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.drivers d
    where d.company_id = p_company_id and d.user_id = p_user_id
  ) then
    return false;
  end if;

  delete from public.company_memberships
  where company_id = p_company_id
    and user_id = p_user_id
    and role = 'driver';

  return true;
end;
$$;

revoke all on function public.centralgo_cleanup_orphan_driver_membership(uuid, uuid) from public, anon;
grant execute on function public.centralgo_cleanup_orphan_driver_membership(uuid, uuid) to authenticated;
