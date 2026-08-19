-- Driver self-service assignment to vehicles already registered by the central.
-- Prevents invitation-created placeholder mobile numbers from remaining in production.

update public.drivers d
set vehicle_id = v.id,
    updated_at = now()
from public.vehicles v
where d.vehicle_id is null
  and d.archived_at is null
  and v.archived_at is null
  and v.status = 'active'
  and v.company_id = d.company_id
  and v.unit_number = d.unit_number
  and not exists (
    select 1 from public.drivers other
    where other.vehicle_id = v.id
      and other.archived_at is null
      and other.id <> d.id
  );

create unique index if not exists drivers_one_active_vehicle_idx
  on public.drivers(vehicle_id)
  where vehicle_id is not null and archived_at is null;

create or replace function public.centralgo_driver_vehicle_options()
returns table(
  driver_id uuid,
  company_id uuid,
  current_vehicle_id uuid,
  vehicle_id uuid,
  unit_number text,
  license_plate text,
  brand text,
  model text,
  year integer,
  color text,
  vehicle_status text,
  assigned boolean,
  assigned_to_me boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  own_driver public.drivers%rowtype;
begin
  if uid is null then raise exception 'Debes iniciar sesión' using errcode='42501'; end if;

  select d.* into own_driver
  from public.drivers d
  join public.company_memberships m
    on m.company_id=d.company_id and m.user_id=uid and m.role='driver' and m.active
  where d.user_id=uid and d.archived_at is null
  order by d.created_at desc
  limit 1;

  if not found then raise exception 'No encontramos tu registro activo de conductor' using errcode='P0002'; end if;

  return query
  select own_driver.id, own_driver.company_id, own_driver.vehicle_id,
         v.id, v.unit_number, v.license_plate, v.brand, v.model, v.year, v.color, v.status::text,
         exists(
           select 1 from public.drivers used
           where used.company_id=own_driver.company_id
             and used.archived_at is null
             and used.id<>own_driver.id
             and (used.vehicle_id=v.id or used.unit_number=v.unit_number)
         ),
         (own_driver.vehicle_id=v.id)
  from public.vehicles v
  where v.company_id=own_driver.company_id
    and v.archived_at is null
    and v.status='active'
  order by v.unit_number, v.brand, v.model;
end;
$$;

create or replace function public.centralgo_driver_select_vehicle(p_vehicle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  own_driver public.drivers%rowtype;
  chosen public.vehicles%rowtype;
begin
  if uid is null then raise exception 'Debes iniciar sesión' using errcode='42501'; end if;

  select d.* into own_driver
  from public.drivers d
  join public.company_memberships m
    on m.company_id=d.company_id and m.user_id=uid and m.role='driver' and m.active
  where d.user_id=uid and d.archived_at is null
  order by d.created_at desc
  limit 1
  for update of d;

  if not found then raise exception 'No encontramos tu registro activo de conductor' using errcode='P0002'; end if;

  select * into chosen
  from public.vehicles
  where id=p_vehicle_id
    and company_id=own_driver.company_id
    and archived_at is null
    and status='active'
  for update;

  if not found then raise exception 'Este vehículo no está disponible en tu central' using errcode='P0002'; end if;

  if exists(
    select 1 from public.drivers other
    where other.company_id=own_driver.company_id
      and other.archived_at is null
      and other.id<>own_driver.id
      and (other.vehicle_id=chosen.id or other.unit_number=chosen.unit_number)
  ) then
    raise exception 'Este vehículo ya está asignado a otro conductor' using errcode='23505';
  end if;

  update public.drivers
  set vehicle_id=chosen.id,
      unit_number=chosen.unit_number,
      updated_at=now()
  where id=own_driver.id;

  perform public.centralgo_write_audit(
    own_driver.company_id,
    'CONDUCTOR_SELECCIONA_VEHICULO',
    format('Conductor seleccionó móvil %s · %s', chosen.unit_number, chosen.license_plate),
    jsonb_build_object('driverId',own_driver.id,'vehicleId',chosen.id,'unitNumber',chosen.unit_number,'licensePlate',chosen.license_plate)
  );

  return jsonb_build_object('ok',true,'driverId',own_driver.id,'vehicleId',chosen.id,'unitNumber',chosen.unit_number,'licensePlate',chosen.license_plate);
end;
$$;

revoke all on function public.centralgo_driver_vehicle_options() from public;
revoke all on function public.centralgo_driver_select_vehicle(uuid) from public;
grant execute on function public.centralgo_driver_vehicle_options() to authenticated;
grant execute on function public.centralgo_driver_select_vehicle(uuid) to authenticated;
