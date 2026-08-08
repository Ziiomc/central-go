-- Secure provisioning and driver offer rejection.

create or replace function public.centralgo_driver_reject_trip(p_trip_id uuid, p_reason text default 'Rechazado por conductor')
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  current_trip public.trips%rowtype;
  own_driver uuid;
  result_trip public.trips%rowtype;
begin
  select * into current_trip from public.trips where id = p_trip_id for update;
  if not found then raise exception 'Carrera no encontrada' using errcode = 'P0002'; end if;
  own_driver := public.centralgo_driver_id_for_user(current_trip.company_id);
  if own_driver is null or current_trip.driver_id is distinct from own_driver then
    raise exception 'Esta oferta no pertenece al conductor autenticado' using errcode = '42501';
  end if;
  if current_trip.status <> 'assigned' then
    raise exception 'La oferta ya no está pendiente de respuesta' using errcode = '55000';
  end if;

  update public.trips
  set status = 'pending', driver_id = null, driver_unit_number = null, driver_name = null,
      assigned_at = null, version = version + 1,
      notes = concat_ws(' | ', nullif(notes,''), left(coalesce(nullif(trim(p_reason),''),'Rechazado por conductor'), 240))
  where id = current_trip.id returning * into result_trip;
  update public.drivers set status = 'available' where id = own_driver;
  return result_trip;
end;
$$;

create or replace function public.centralgo_superadmin_create_company(
  p_name text,
  p_code text,
  p_city text,
  p_country_code text default 'CL',
  p_phone text default null,
  p_address text default null,
  p_plan_code text default 'enterprise',
  p_billing_cycle public.centralgo_billing_cycle default 'annual',
  p_trial_days integer default 14,
  p_center_lat double precision default null,
  p_center_lng double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_company_id uuid;
  selected_plan uuid;
begin
  if not public.centralgo_is_super_admin() then raise exception 'Solo Superadmin puede registrar centrales' using errcode='42501'; end if;
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'Nombre de central inválido' using errcode='22023'; end if;
  if length(trim(coalesce(p_code,''))) < 2 then raise exception 'Código de central inválido' using errcode='22023'; end if;
  if p_trial_days < 0 or p_trial_days > 90 then raise exception 'Días de prueba inválidos' using errcode='22023'; end if;
  if p_center_lat is not null and not p_center_lat between -90 and 90 then raise exception 'Latitud inválida' using errcode='22023'; end if;
  if p_center_lng is not null and not p_center_lng between -180 and 180 then raise exception 'Longitud inválida' using errcode='22023'; end if;

  select id into selected_plan from public.subscription_plans where code=lower(trim(p_plan_code)) and active limit 1;
  if selected_plan is null then raise exception 'Plan no encontrado' using errcode='22023'; end if;

  insert into public.companies(name, code, phone, address, city, country_code, center_lat, center_lng)
  values(trim(p_name), upper(trim(p_code)), nullif(trim(coalesce(p_phone,'')),''), nullif(trim(coalesce(p_address,'')),''),
         nullif(trim(coalesce(p_city,'')),''), upper(left(trim(coalesce(p_country_code,'CL')),2)), p_center_lat, p_center_lng)
  returning id into new_company_id;

  insert into public.subscriptions(company_id, plan_id, billing_cycle, status, trial_ends_at, current_period_end)
  values(new_company_id, selected_plan, p_billing_cycle, case when p_trial_days>0 then 'trialing' else 'active' end,
         case when p_trial_days>0 then now() + make_interval(days=>p_trial_days) end,
         case when p_billing_cycle='annual' then now()+interval '1 year' else now()+interval '1 month' end);

  insert into public.fare_configs(company_id) values(new_company_id) on conflict (company_id) do nothing;
  perform public.centralgo_write_audit(new_company_id, 'CREAR_CENTRAL', format('Superadmin registró central %s (%s)', trim(p_name), upper(trim(p_code))));
  return new_company_id;
end;
$$;

create or replace function public.centralgo_assign_company_user(
  p_company_id uuid,
  p_email text,
  p_role public.centralgo_company_role
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
begin
  if not (public.centralgo_is_super_admin() or public.centralgo_has_company_role(p_company_id, array['company_admin']::public.centralgo_company_role[])) then
    raise exception 'Sin permiso para administrar usuarios de esta central' using errcode='42501';
  end if;
  select u.id into target_user from auth.users u where lower(u.email)=lower(trim(p_email)) limit 1;
  if target_user is null then raise exception 'El usuario debe crear su cuenta antes de ser asignado' using errcode='P0002'; end if;
  if not exists(select 1 from public.profiles where id=target_user and active) then raise exception 'Perfil inexistente o inactivo' using errcode='55000'; end if;

  insert into public.company_memberships(company_id,user_id,role,active)
  values(p_company_id,target_user,p_role,true)
  on conflict(company_id,user_id,role) do update set active=true;
  return target_user;
end;
$$;

create or replace function public.centralgo_superadmin_set_global_role(
  p_email text,
  p_role public.centralgo_global_role
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare target_user uuid;
begin
  if not public.centralgo_is_super_admin() then raise exception 'Solo Superadmin puede asignar roles globales' using errcode='42501'; end if;
  select u.id into target_user from auth.users u where lower(u.email)=lower(trim(p_email)) limit 1;
  if target_user is null then raise exception 'Usuario no encontrado' using errcode='P0002'; end if;
  update public.profiles set global_role=p_role where id=target_user and active;
  if not found then raise exception 'Perfil no disponible' using errcode='55000'; end if;
  return target_user;
end;
$$;

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
declare target_user uuid; partner_id uuid; global_role public.centralgo_global_role;
begin
  if not public.centralgo_is_super_admin() then raise exception 'Solo Superadmin puede crear partners' using errcode='42501'; end if;
  if p_commission_percent < 0 or p_commission_percent > 100 then raise exception 'Comisión inválida' using errcode='22023'; end if;
  select u.id into target_user from auth.users u where lower(u.email)=lower(trim(p_email)) limit 1;
  if target_user is null then raise exception 'Usuario no encontrado' using errcode='P0002'; end if;
  global_role := case when p_kind='regional' then 'regional_partner'::public.centralgo_global_role else 'sales_partner'::public.centralgo_global_role end;
  update public.profiles set global_role=global_role where id=target_user and active;
  if not found then raise exception 'Perfil no disponible' using errcode='55000'; end if;
  insert into public.partners(user_id,kind,code,commission_percent,parent_partner_id,active)
  values(target_user,p_kind,upper(trim(p_code)),p_commission_percent,p_parent_partner_id,true)
  on conflict(user_id) do update set kind=excluded.kind,code=excluded.code,commission_percent=excluded.commission_percent,parent_partner_id=excluded.parent_partner_id,active=true
  returning id into partner_id;
  return partner_id;
end;
$$;

revoke all on function public.centralgo_driver_reject_trip(uuid,text) from public, anon;
revoke all on function public.centralgo_superadmin_create_company(text,text,text,text,text,text,text,public.centralgo_billing_cycle,integer,double precision,double precision) from public, anon;
revoke all on function public.centralgo_assign_company_user(uuid,text,public.centralgo_company_role) from public, anon;
revoke all on function public.centralgo_superadmin_set_global_role(text,public.centralgo_global_role) from public, anon;
revoke all on function public.centralgo_superadmin_create_partner(text,public.centralgo_partner_kind,text,numeric,uuid) from public, anon;

grant execute on function public.centralgo_driver_reject_trip(uuid,text) to authenticated;
grant execute on function public.centralgo_superadmin_create_company(text,text,text,text,text,text,text,public.centralgo_billing_cycle,integer,double precision,double precision) to authenticated;
grant execute on function public.centralgo_assign_company_user(uuid,text,public.centralgo_company_role) to authenticated;
grant execute on function public.centralgo_superadmin_set_global_role(text,public.centralgo_global_role) to authenticated;
grant execute on function public.centralgo_superadmin_create_partner(text,public.centralgo_partner_kind,text,numeric,uuid) to authenticated;
