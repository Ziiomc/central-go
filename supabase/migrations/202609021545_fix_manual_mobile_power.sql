-- Manual/radio mobiles may participate in the dispatch queue without a linked
-- vehicles row. App-driven mobiles still require a physical vehicle assignment.
create or replace function public.centralgo_sync_driver_mobile_from_vehicle()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  vehicle_mobile text;
begin
  if new.vehicle_id is null then
    if coalesce(new.operation_mode,'app') = 'traditional' then
      new.unit_number := coalesce(new.unit_number,'');
      return new;
    end if;

    new.unit_number := '';
    if new.status::text <> 'offline' then
      new.status := 'offline'::public.centralgo_driver_status;
    end if;
    return new;
  end if;

  select v.unit_number
    into vehicle_mobile
  from public.vehicles v
  where v.id = new.vehicle_id
    and v.company_id = new.company_id
    and v.archived_at is null;

  if nullif(btrim(coalesce(vehicle_mobile,'')),'') is null then
    raise exception 'El móvil seleccionado no pertenece a esta central o está retirado' using errcode='22023';
  end if;

  new.unit_number := vehicle_mobile;
  return new;
end;
$function$;

-- Preserve the unit number entered by the operator when creating a manual/radio
-- driver. Previously p_unit_number was ignored, producing blank queue rows.
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
set search_path to 'public'
as $function$
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

  if p_vehicle_id is not null then
    select v.unit_number into resolved_unit
    from public.vehicles v
    where v.id=p_vehicle_id
      and v.company_id=p_company_id
      and v.archived_at is null
      and v.status::text='active';

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
$function$;
