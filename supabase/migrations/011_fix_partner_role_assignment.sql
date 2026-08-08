create or replace function public.centralgo_superadmin_create_partner(
  p_email text,
  p_kind public.centralgo_partner_kind,
  p_code text,
  p_commission_percent numeric,
  p_parent_partner_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
  partner_id uuid;
  assigned_global_role public.centralgo_global_role;
begin
  if not public.centralgo_is_super_admin() then raise exception 'Solo Superadmin puede crear partners' using errcode='42501'; end if;
  if p_commission_percent < 0 or p_commission_percent > 100 then raise exception 'Comisión inválida' using errcode='22023'; end if;
  select u.id into target_user from auth.users u where lower(u.email)=lower(trim(p_email)) limit 1;
  if target_user is null then raise exception 'Usuario no encontrado' using errcode='P0002'; end if;
  assigned_global_role := case when p_kind='regional' then 'regional_partner'::public.centralgo_global_role else 'sales_partner'::public.centralgo_global_role end;
  update public.profiles p set global_role=assigned_global_role where p.id=target_user and p.active;
  if not found then raise exception 'Perfil no disponible' using errcode='55000'; end if;
  insert into public.partners(user_id,kind,code,commission_percent,parent_partner_id,active)
  values(target_user,p_kind,upper(trim(p_code)),p_commission_percent,p_parent_partner_id,true)
  on conflict(user_id) do update set kind=excluded.kind,code=excluded.code,commission_percent=excluded.commission_percent,parent_partner_id=excluded.parent_partner_id,active=true
  returning id into partner_id;
  return partner_id;
end;
$$;

revoke all on function public.centralgo_superadmin_create_partner(text,public.centralgo_partner_kind,text,numeric,uuid) from public, anon;
grant execute on function public.centralgo_superadmin_create_partner(text,public.centralgo_partner_kind,text,numeric,uuid) to authenticated;
