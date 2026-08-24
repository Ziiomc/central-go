-- Reuse archived fleet identities instead of failing on the historical unique key.
-- The function remains SECURITY INVOKER so the existing vehicle RLS policies apply.

create or replace function public.centralgo_admin_save_vehicle(
  p_company_id uuid,
  p_unit_number text,
  p_license_plate text,
  p_brand text,
  p_model text,
  p_year integer,
  p_color text,
  p_capacity integer,
  p_pet_friendly boolean,
  p_wheelchair_accessible boolean,
  p_air_conditioning boolean,
  p_technical_inspection_expiry date,
  p_status public.centralgo_vehicle_status
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  normalized_unit text := regexp_replace(trim(coalesce(p_unit_number, '')), '^m[oó]vil\s*', '', 'i');
  normalized_plate text := upper(trim(coalesce(p_license_plate, '')));
  archived_ids uuid[];
  saved public.vehicles%rowtype;
  first_lock bigint;
  second_lock bigint;
  failed_constraint text;
begin
  if not public.centralgo_has_company_role(
    p_company_id,
    array['company_admin']::public.centralgo_company_role[]
  ) then
    raise exception 'Tu cuenta no tiene permiso para registrar vehículos en esta central.'
      using errcode = '42501';
  end if;

  if normalized_unit = '' then
    raise exception 'Ingresa el número del móvil.' using errcode = '23514';
  end if;
  if normalized_plate = '' then
    raise exception 'Ingresa la patente del vehículo.' using errcode = '23514';
  end if;

  first_lock := hashtextextended(p_company_id::text || ':unit:' || lower(normalized_unit), 0);
  second_lock := hashtextextended(p_company_id::text || ':plate:' || normalized_plate, 0);
  perform pg_advisory_xact_lock(least(first_lock, second_lock));
  if first_lock <> second_lock then
    perform pg_advisory_xact_lock(greatest(first_lock, second_lock));
  end if;

  if exists (
    select 1
    from public.vehicles v
    where v.company_id = p_company_id
      and lower(trim(v.unit_number)) = lower(normalized_unit)
      and v.archived_at is null
  ) then
    raise exception 'El móvil % ya está activo en esta central.', normalized_unit;
  end if;

  if exists (
    select 1
    from public.vehicles v
    where v.company_id = p_company_id
      and upper(trim(v.license_plate)) = normalized_plate
      and v.archived_at is null
  ) then
    raise exception 'La patente % ya está activa en esta central.', normalized_plate;
  end if;

  select coalesce(array_agg(distinct v.id), array[]::uuid[])
  into archived_ids
  from public.vehicles v
  where v.company_id = p_company_id
    and v.archived_at is not null
    and (
      lower(trim(v.unit_number)) = lower(normalized_unit)
      or upper(trim(v.license_plate)) = normalized_plate
    );

  if cardinality(archived_ids) > 1 then
    raise exception 'El número móvil y la patente pertenecen a vehículos archivados distintos. Edítalos desde el historial de flota.';
  end if;

  if cardinality(archived_ids) = 1 then
    update public.vehicles
    set company_id = p_company_id,
        unit_number = normalized_unit,
        license_plate = normalized_plate,
        brand = trim(p_brand),
        model = trim(p_model),
        year = p_year,
        color = nullif(trim(p_color), ''),
        capacity = p_capacity,
        pet_friendly = p_pet_friendly,
        wheelchair_accessible = p_wheelchair_accessible,
        air_conditioning = p_air_conditioning,
        technical_inspection_expiry = p_technical_inspection_expiry,
        status = p_status,
        archived_at = null
    where id = archived_ids[1]
      and company_id = p_company_id
    returning * into saved;
  else
    insert into public.vehicles (
      company_id, unit_number, license_plate, brand, model, year, color, capacity,
      pet_friendly, wheelchair_accessible, air_conditioning,
      technical_inspection_expiry, status
    ) values (
      p_company_id, normalized_unit, normalized_plate, trim(p_brand), trim(p_model),
      p_year, nullif(trim(p_color), ''), p_capacity, p_pet_friendly,
      p_wheelchair_accessible, p_air_conditioning, p_technical_inspection_expiry,
      p_status
    )
    returning * into saved;
  end if;

  return to_jsonb(saved);
exception
  when unique_violation then
    get stacked diagnostics failed_constraint = constraint_name;
    if failed_constraint like '%unit_number%' then
      raise exception 'El móvil % ya está registrado en esta central.', normalized_unit;
    elsif failed_constraint like '%license_plate%' then
      raise exception 'La patente % ya está registrada en esta central.', normalized_plate;
    end if;
    raise;
end;
$$;

revoke all on function public.centralgo_admin_save_vehicle(
  uuid, text, text, text, text, integer, text, integer,
  boolean, boolean, boolean, date, public.centralgo_vehicle_status
) from public, anon;
grant execute on function public.centralgo_admin_save_vehicle(
  uuid, text, text, text, text, integer, text, integer,
  boolean, boolean, boolean, date, public.centralgo_vehicle_status
) to authenticated;

create or replace function public.centralgo_enforce_vehicle_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entitlement record;
  current_count integer;
begin
  if new.archived_at is not null then
    return new;
  end if;

  select * into entitlement from public.centralgo_plan_entitlements(new.company_id);
  if not found or entitlement.max_vehicles is null then
    return new;
  end if;

  select count(*)::int into current_count
  from public.vehicles v
  where v.company_id = new.company_id
    and v.archived_at is null
    and v.id <> new.id;

  if current_count >= entitlement.max_vehicles then
    raise exception 'El plan % admite un máximo de % móviles. Actualiza el plan para registrar más vehículos.', entitlement.plan_code, entitlement.max_vehicles
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.centralgo_enforce_vehicle_limit() from public, anon, authenticated;

drop trigger if exists centralgo_vehicle_plan_limit on public.vehicles;
create trigger centralgo_vehicle_plan_limit
before insert or update of company_id, archived_at on public.vehicles
for each row execute function public.centralgo_enforce_vehicle_limit();
