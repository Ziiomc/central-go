-- Serialize queue-tail allocation for manual registrations and vehicle-driven
-- manual re-entry. Assigning a vehicle to an offline traditional driver is an
-- active queue join and must therefore place the mobile at the true tail.

create or replace function public.centralgo_operator_register_manual_driver(
  p_company_id uuid,
  p_vehicle_id uuid default null::uuid,
  p_unit_number text default null::text,
  p_display_name text default null::text,
  p_phone text default null::text,
  p_address text default null::text,
  p_birth_date date default null::date,
  p_license_number text default null::text,
  p_license_expiry date default null::date
)
returns public.drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  new_driver public.drivers%rowtype;
  next_queue_order bigint;
  resolved_unit text;
begin
  if not public.centralgo_has_company_role(
    p_company_id,
    array['company_admin','operator']::public.centralgo_company_role[]
  ) and not public.centralgo_is_super_admin() then
    raise exception 'Sin permiso para registrar conductores en esta central' using errcode='42501';
  end if;

  if nullif(trim(coalesce(p_display_name,'')), '') is null
    or nullif(trim(coalesce(p_phone,'')), '') is null
    or nullif(trim(coalesce(p_license_number,'')), '') is null then
    raise exception 'Nombre, teléfono y licencia son obligatorios' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_company_id::text)::bigint);

  if p_vehicle_id is not null then
    select v.unit_number into resolved_unit
    from public.vehicles v
    where v.id=p_vehicle_id
      and v.company_id=p_company_id
      and v.archived_at is null
      and v.status::text='active'
    for update;

    if nullif(trim(coalesce(resolved_unit,'')), '') is null then
      raise exception 'El móvil seleccionado no pertenece a esta central o está retirado' using errcode='22023';
    end if;

    if exists(select 1 from public.drivers d where d.vehicle_id=p_vehicle_id and d.archived_at is null) then
      raise exception 'Ese móvil ya está asignado a otro conductor' using errcode='23505';
    end if;
  else
    resolved_unit := nullif(trim(coalesce(p_unit_number,'')), '');
    if resolved_unit is null then
      raise exception 'El número de móvil es obligatorio para incorporarlo manualmente' using errcode='22023';
    end if;
  end if;

  select coalesce(max(d.dispatch_queue_order),0)+1
    into next_queue_order
  from public.drivers d
  where d.company_id=p_company_id
    and d.archived_at is null;

  insert into public.drivers(
    company_id,user_id,vehicle_id,unit_number,display_name,phone,
    license_number,license_expiry,status,operation_mode,service_enabled,
    dispatch_queue_order,dispatch_queue_updated_at
  )
  values(
    p_company_id,null,p_vehicle_id,resolved_unit,trim(p_display_name),trim(p_phone),
    trim(p_license_number),p_license_expiry,'offline','traditional',true,
    next_queue_order,now()
  )
  returning * into new_driver;

  update public.drivers
  set address=nullif(trim(coalesce(p_address,'')), ''),
      birth_date=p_birth_date
  where id=new_driver.id;

  select * into new_driver from public.drivers where id=new_driver.id;
  return new_driver;
exception
  when unique_violation then
    raise exception 'Ese número de licencia ya está registrado en esta central' using errcode='23505';
end;
$$;

revoke all on function public.centralgo_operator_register_manual_driver(uuid,uuid,text,text,text,text,date,text,date) from public,anon;
grant execute on function public.centralgo_operator_register_manual_driver(uuid,uuid,text,text,text,text,date,text,date) to authenticated,service_role;

create or replace function public.centralgo_operator_assign_driver_vehicle(
  p_driver_id uuid,
  p_vehicle_id uuid
)
returns public.drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  target_driver public.drivers%rowtype;
  target_vehicle public.vehicles%rowtype;
  result_driver public.drivers%rowtype;
  next_queue_order bigint;
  rejoins_manual_queue boolean;
begin
  select * into target_driver
  from public.drivers d
  where d.id = p_driver_id
    and d.archived_at is null;

  if not found then
    raise exception 'No fue posible encontrar al conductor' using errcode='22023';
  end if;

  if not public.centralgo_has_company_role(
    target_driver.company_id,
    array['company_admin','operator']::public.centralgo_company_role[]
  ) then
    raise exception 'Sin permiso para asignar móviles en esta central' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_driver.company_id::text)::bigint);

  select * into target_driver
  from public.drivers d
  where d.id = p_driver_id
    and d.archived_at is null
  for update;

  if not found then
    raise exception 'No fue posible encontrar al conductor' using errcode='22023';
  end if;

  if target_driver.status::text in ('en_route','in_trip','sos') then
    raise exception 'No puedes cambiar el móvil mientras el conductor está en una carrera activa o con SOS' using errcode='22023';
  end if;

  select * into target_vehicle
  from public.vehicles v
  where v.id = p_vehicle_id
    and v.company_id = target_driver.company_id
    and v.archived_at is null
  for update;

  if not found then
    raise exception 'El móvil seleccionado no pertenece a esta central o está retirado' using errcode='22023';
  end if;

  if target_vehicle.status::text <> 'active' then
    raise exception 'Solo puedes asignar un móvil que esté activo' using errcode='22023';
  end if;

  if exists (
    select 1
    from public.drivers d
    where d.vehicle_id = p_vehicle_id
      and d.id <> p_driver_id
      and d.archived_at is null
  ) then
    raise exception 'Ese móvil ya está asignado a otro conductor' using errcode='23505';
  end if;

  rejoins_manual_queue := target_driver.operation_mode='traditional'
    and target_driver.status='offline';

  if rejoins_manual_queue or coalesce(target_driver.dispatch_queue_order,0)<=0 then
    select coalesce(max(d.dispatch_queue_order),0)+1
      into next_queue_order
    from public.drivers d
    where d.company_id = target_driver.company_id
      and d.id <> target_driver.id
      and d.archived_at is null;
  else
    next_queue_order := target_driver.dispatch_queue_order;
  end if;

  update public.drivers
     set vehicle_id = p_vehicle_id,
         unit_number = target_vehicle.unit_number,
         service_enabled = true,
         dispatch_queue_order = next_queue_order,
         dispatch_queue_updated_at = case
           when rejoins_manual_queue or coalesce(dispatch_queue_order,0)<=0 then clock_timestamp()
           else dispatch_queue_updated_at
         end,
         status = case
           when operation_mode = 'traditional' and status::text = 'offline'
             then 'available'::public.centralgo_driver_status
           else status
         end,
         updated_at = clock_timestamp()
   where id = p_driver_id
   returning * into result_driver;

  return result_driver;
end;
$$;

revoke all on function public.centralgo_operator_assign_driver_vehicle(uuid,uuid) from public,anon;
grant execute on function public.centralgo_operator_assign_driver_vehicle(uuid,uuid) to authenticated,service_role;
