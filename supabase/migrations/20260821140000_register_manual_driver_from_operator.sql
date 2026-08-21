-- Central GO: register no-App drivers directly from the priority queue flow.
-- The operator can create the permanent driver record without creating an app account.
-- The new driver starts in traditional mode and joins the end of today's priority queue.

create policy drivers_operator_insert on public.drivers
for insert to authenticated
with check (
  public.centralgo_has_company_role(
    company_id,
    array['company_admin','operator']::public.centralgo_company_role[]
  )
);

create or replace function public.centralgo_operator_register_manual_driver(
  p_company_id uuid,
  p_vehicle_id uuid default null,
  p_unit_number text default null,
  p_display_name text default null,
  p_phone text default null,
  p_address text default null,
  p_birth_date date default null,
  p_license_number text default null,
  p_license_expiry date default null
)
returns public.drivers
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_driver public.drivers%rowtype;
  next_queue_order bigint;
begin
  if not public.centralgo_has_company_role(
    p_company_id,
    array['company_admin','operator']::public.centralgo_company_role[]
  ) then
    raise exception 'Sin permiso para registrar conductores en esta central' using errcode='42501';
  end if;

  if nullif(trim(coalesce(p_unit_number,'')), '') is null
    or nullif(trim(coalesce(p_display_name,'')), '') is null
    or nullif(trim(coalesce(p_phone,'')), '') is null
    or nullif(trim(coalesce(p_license_number,'')), '') is null then
    raise exception 'Número de móvil, nombre, teléfono y licencia son obligatorios' using errcode='22023';
  end if;

  if p_vehicle_id is not null then
    if not exists (
      select 1 from public.vehicles v
      where v.id=p_vehicle_id and v.company_id=p_company_id and v.archived_at is null
    ) then
      raise exception 'El vehículo seleccionado no pertenece a esta central o está archivado' using errcode='22023';
    end if;

    if exists (
      select 1 from public.drivers d
      where d.company_id=p_company_id
        and d.vehicle_id=p_vehicle_id
        and d.archived_at is null
    ) then
      raise exception 'Ese vehículo ya está asignado a otro conductor' using errcode='23505';
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
    dispatch_queue_order,dispatch_queue_updated_at,address,birth_date
  )
  values(
    p_company_id,null,p_vehicle_id,trim(p_unit_number),trim(p_display_name),trim(p_phone),
    trim(p_license_number),p_license_expiry,'available','traditional',true,
    next_queue_order,now(),nullif(trim(coalesce(p_address,'')), ''),p_birth_date
  )
  returning * into new_driver;

  return new_driver;
exception
  when unique_violation then
    raise exception 'Ese número de móvil o número de licencia ya está registrado en esta central' using errcode='23505';
end;
$$;

revoke all on function public.centralgo_operator_register_manual_driver(uuid,uuid,text,text,text,text,date,text,date) from public, anon;
grant execute on function public.centralgo_operator_register_manual_driver(uuid,uuid,text,text,text,text,date,text,date) to authenticated;
