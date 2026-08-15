-- Central GO · controles exclusivos del administrador global propietario.
-- Conserva el historial financiero al "eliminar" un perfil: se archiva y se bloquea su acceso.

alter table public.partners
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

create or replace function public.centralgo_owner_is_primary_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.id = auth.uid()
      and lower(u.email) = lower('ziiomc3@gmail.com')
      and p.active
      and p.global_role = 'super_admin'
  );
$$;

revoke all on function public.centralgo_owner_is_primary_superadmin() from public, anon;
grant execute on function public.centralgo_owner_is_primary_superadmin() to authenticated;

create or replace function public.centralgo_superadmin_set_partner_status(p_partner_id uuid, p_active boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
begin
  if auth.uid() is null or not public.centralgo_owner_is_primary_superadmin() then
    raise exception 'Solo el administrador global propietario puede activar o suspender partners' using errcode='42501';
  end if;

  select user_id into target_user
  from public.partners
  where id = p_partner_id and archived_at is null;

  if target_user is null then
    raise exception 'Partner no encontrado' using errcode='P0002';
  end if;

  if target_user = auth.uid() then
    raise exception 'No puedes suspender tu propio perfil Superadmin' using errcode='42501';
  end if;

  update public.partners
  set active = p_active, updated_at = now()
  where id = p_partner_id;

  update public.profiles
  set active = p_active, updated_at = now()
  where id = target_user;

  insert into public.audit_logs(user_id,user_name,user_role,action,description,metadata)
  select auth.uid(), p.name, 'super_admin',
         case when p_active then 'PARTNER_ACTIVATED' else 'PARTNER_SUSPENDED' end,
         case when p_active then 'Partner activado por administrador global' else 'Partner suspendido por administrador global' end,
         jsonb_build_object('partnerId',p_partner_id,'targetUserId',target_user)
  from public.profiles p where p.id=auth.uid();

  return p_active;
end;
$$;

revoke all on function public.centralgo_superadmin_set_partner_status(uuid,boolean) from public, anon;
grant execute on function public.centralgo_superadmin_set_partner_status(uuid,boolean) to authenticated;

create or replace function public.centralgo_owner_change_partner_kind(
  p_partner_id uuid,
  p_kind public.centralgo_partner_kind,
  p_parent_partner_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.partners%rowtype;
  target_name text;
  target_email text;
  replacement public.partners%rowtype;
  child_count integer := 0;
  next_global_role public.centralgo_global_role;
begin
  if auth.uid() is null or not public.centralgo_owner_is_primary_superadmin() then
    raise exception 'Solo el administrador global propietario puede cambiar niveles de partner' using errcode='42501';
  end if;

  select * into target from public.partners where id=p_partner_id and archived_at is null;
  if not found then raise exception 'Partner no encontrado' using errcode='P0002'; end if;
  if target.user_id=auth.uid() then raise exception 'No puedes cambiar tu propio rol Superadmin' using errcode='42501'; end if;

  select pr.name, au.email into target_name, target_email
  from public.profiles pr left join auth.users au on au.id=pr.id
  where pr.id=target.user_id;

  if target.kind=p_kind then
    return jsonb_build_object('partnerId',target.id,'kind',target.kind::text,'unchanged',true);
  end if;

  if p_kind='regional' then
    update public.partners
      set kind='regional', parent_partner_id=null, updated_at=now()
      where id=target.id;
    next_global_role := 'regional_partner';
  else
    select count(*)::int into child_count
    from public.partners
    where parent_partner_id=target.id and archived_at is null;

    if p_parent_partner_id is not null then
      select * into replacement
      from public.partners
      where id=p_parent_partner_id and kind='regional' and active and archived_at is null and id<>target.id;
      if not found then raise exception 'El regional de reemplazo no es válido' using errcode='22023'; end if;
    end if;

    if child_count>0 and p_parent_partner_id is null then
      raise exception 'Este regional tiene % partner(s) comerciales. Selecciona otro regional para reasignarlos antes de degradar.', child_count using errcode='22023';
    end if;

    if child_count>0 then
      update public.partners set parent_partner_id=p_parent_partner_id, updated_at=now()
      where parent_partner_id=target.id and archived_at is null;
    end if;

    update public.partners
      set kind='sales', parent_partner_id=p_parent_partner_id, updated_at=now()
      where id=target.id;
    next_global_role := 'sales_partner';
  end if;

  update public.profiles
    set global_role=next_global_role, active=true, updated_at=now()
    where id=target.user_id;

  insert into public.audit_logs(user_id,user_name,user_role,action,description,metadata)
  select auth.uid(), p.name, 'super_admin', 'PARTNER_LEVEL_CHANGED',
         format('Nivel de %s cambiado a %s',coalesce(target_name,'Partner'),p_kind::text),
         jsonb_build_object('partnerId',target.id,'targetUserId',target.user_id,'email',target_email,'from',target.kind::text,'to',p_kind::text,'replacementRegionalId',p_parent_partner_id,'reassignedChildren',child_count)
  from public.profiles p where p.id=auth.uid();

  return jsonb_build_object('partnerId',target.id,'kind',p_kind::text,'reassignedChildren',child_count);
end;
$$;

revoke all on function public.centralgo_owner_change_partner_kind(uuid,public.centralgo_partner_kind,uuid) from public, anon;
grant execute on function public.centralgo_owner_change_partner_kind(uuid,public.centralgo_partner_kind,uuid) to authenticated;

create or replace function public.centralgo_owner_archive_partner_profile(p_partner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.partners%rowtype;
  target_name text;
  target_email text;
  child_count integer := 0;
begin
  if auth.uid() is null or not public.centralgo_owner_is_primary_superadmin() then
    raise exception 'Solo el administrador global propietario puede eliminar perfiles de partner' using errcode='42501';
  end if;

  select * into target from public.partners where id=p_partner_id and archived_at is null;
  if not found then raise exception 'Partner no encontrado' using errcode='P0002'; end if;
  if target.user_id=auth.uid() then raise exception 'No puedes eliminar tu propio perfil Superadmin' using errcode='42501'; end if;

  select count(*)::int into child_count from public.partners where parent_partner_id=target.id and archived_at is null;
  if child_count>0 then
    raise exception 'No se puede eliminar este regional mientras tenga % partner(s) comerciales asociados. Reasígnalos o cámbialo de nivel primero.', child_count using errcode='23503';
  end if;

  select pr.name, au.email into target_name, target_email
  from public.profiles pr left join auth.users au on au.id=pr.id where pr.id=target.user_id;

  update public.partners
    set active=false, archived_at=now(), archived_by=auth.uid(), updated_at=now()
    where id=target.id;

  update public.profiles
    set active=false, global_role=null, updated_at=now()
    where id=target.user_id;

  update public.referrals set active=false where partner_id=target.id and active;

  insert into public.audit_logs(user_id,user_name,user_role,action,description,metadata)
  select auth.uid(), p.name, 'super_admin', 'PARTNER_PROFILE_ARCHIVED',
         format('Perfil de partner %s eliminado del acceso operativo',coalesce(target_name,'Partner')),
         jsonb_build_object('partnerId',target.id,'targetUserId',target.user_id,'email',target_email,'kind',target.kind::text)
  from public.profiles p where p.id=auth.uid();

  return jsonb_build_object('partnerId',target.id,'userId',target.user_id,'archived',true);
end;
$$;

revoke all on function public.centralgo_owner_archive_partner_profile(uuid) from public, anon;
grant execute on function public.centralgo_owner_archive_partner_profile(uuid) to authenticated;

create or replace function public.centralgo_visible_partners()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_partner uuid;
  viewer_kind public.centralgo_partner_kind;
  is_super boolean := public.centralgo_is_super_admin();
begin
  if not is_super then
    select id, kind into viewer_partner, viewer_kind
    from public.partners
    where user_id=auth.uid() and active and archived_at is null
    limit 1;
    if viewer_partner is null or viewer_kind <> 'regional' then
      raise exception 'Sin permiso para visualizar el directorio de partners' using errcode='42501';
    end if;
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'userId', p.user_id,
      'name', pr.name,
      'email', au.email,
      'phone', pr.phone,
      'kind', p.kind::text,
      'code', p.code,
      'commissionPercent', p.commission_percent,
      'active', p.active,
      'createdAt', p.created_at,
      'parentPartnerId', p.parent_partner_id,
      'parentName', parent_pr.name,
      'territories', coalesce(territories.items,'[]'::jsonb),
      'centralCount', coalesce(sales.central_count,0),
      'activeCentralCount', coalesce(sales.active_count,0),
      'monthlySales', coalesce(sales.monthly_sales,0),
      'pendingCommission', coalesce(comm.pending_amount,0),
      'availableCommission', coalesce(comm.available_amount,0),
      'paidCommission', coalesce(comm.paid_amount,0)
    ) order by case when p.kind='regional' then 0 else 1 end, p.created_at), '[]'::jsonb)
    from public.partners p
    join public.profiles pr on pr.id=p.user_id
    left join auth.users au on au.id=p.user_id
    left join public.partners parent on parent.id=p.parent_partner_id and parent.archived_at is null
    left join public.profiles parent_pr on parent_pr.id=parent.user_id
    left join lateral (
      select jsonb_agg(jsonb_build_object('countryCode',pt.country_code,'region',pt.region,'city',pt.city,'exclusive',pt.exclusive) order by pt.created_at) as items
      from public.partner_territories pt where pt.partner_id=p.id
    ) territories on true
    left join lateral (
      select count(*)::int as central_count,
             count(*) filter (where s.status='active')::int as active_count,
             coalesce(sum(case when s.status in ('trialing','active') then case when s.billing_cycle='annual' then sp.annual_price_clp::numeric/12 else sp.monthly_price_clp::numeric end else 0 end),0) as monthly_sales
      from public.referrals r
      left join public.subscriptions s on s.company_id=r.company_id
      left join public.subscription_plans sp on sp.id=s.plan_id
      where r.partner_id=p.id and r.active
    ) sales on true
    left join lateral (
      select coalesce(sum(amount) filter (where status in ('pending','confirmed')),0) as pending_amount,
             coalesce(sum(amount) filter (where status='available'),0) as available_amount,
             coalesce(sum(amount) filter (where status='paid'),0) as paid_amount
      from public.commission_ledger cl where cl.partner_id=p.id
    ) comm on true
    where p.archived_at is null and (is_super or p.id=viewer_partner or p.parent_partner_id=viewer_partner)
  );
end;
$$;

revoke all on function public.centralgo_visible_partners() from public, anon;
grant execute on function public.centralgo_visible_partners() to authenticated;
