-- Central GO commercial security hardening and atomic driver operations.
-- Apply after 001_commercial_core.sql.

-- A user may edit only harmless profile fields. Column privileges prevent
-- self-promotion even though the RLS row policy allows updating the own row.
revoke update on table public.profiles from authenticated;
grant update (name, phone, avatar_url) on table public.profiles to authenticated;

-- Audit records must not be forgeable through direct table inserts.
drop policy if exists audit_logs_insert_member on public.audit_logs;
revoke insert, update, delete on table public.audit_logs from authenticated;

-- Returns the authenticated user's active driver record in a company.
create or replace function public.centralgo_driver_id_for_user(target_company uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select d.id
  from public.drivers d
  join public.company_memberships m
    on m.company_id = d.company_id
   and m.user_id = d.user_id
   and m.role = 'driver'
   and m.active
  where d.company_id = target_company
    and d.user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.centralgo_driver_id_for_user(uuid) from public, anon;
grant execute on function public.centralgo_driver_id_for_user(uuid) to authenticated;

-- Drivers can choose only manual availability states directly. Operational
-- states (en_route/in_trip) are controlled by trip transition RPCs.
create or replace function public.centralgo_driver_set_manual_status(
  target_company uuid,
  new_status public.centralgo_driver_status
)
returns public.centralgo_driver_status
language plpgsql
security definer
set search_path = public
as $$
declare
  target_driver uuid;
begin
  if new_status not in ('available', 'paused', 'offline') then
    raise exception 'Estado manual no permitido: %', new_status using errcode = '22023';
  end if;

  target_driver := public.centralgo_driver_id_for_user(target_company);
  if target_driver is null then
    raise exception 'Conductor autenticado no encontrado para esta central' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.trips t
    where t.driver_id = target_driver
      and t.status in ('assigned','en_route','arrived','in_progress')
  ) then
    raise exception 'No se puede cambiar disponibilidad durante una carrera activa' using errcode = '55000';
  end if;

  update public.drivers
  set status = new_status,
      sos_active = case when new_status = 'offline' then false else sos_active end
  where id = target_driver;

  return new_status;
end;
$$;

revoke all on function public.centralgo_driver_set_manual_status(uuid, public.centralgo_driver_status) from public, anon;
grant execute on function public.centralgo_driver_set_manual_status(uuid, public.centralgo_driver_status) to authenticated;

-- One authenticated call records the current position and its history sample.
create or replace function public.centralgo_driver_report_location(
  target_company uuid,
  p_lat double precision,
  p_lng double precision,
  p_address text default null,
  p_speed_kmh numeric default null,
  p_heading_degrees numeric default null,
  p_accuracy_meters numeric default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  target_driver uuid;
  recorded timestamptz := now();
begin
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Coordenadas inválidas' using errcode = '22023';
  end if;
  if p_speed_kmh is not null and (p_speed_kmh < 0 or p_speed_kmh > 300) then
    raise exception 'Velocidad inválida' using errcode = '22023';
  end if;
  if p_heading_degrees is not null and (p_heading_degrees < 0 or p_heading_degrees >= 360) then
    raise exception 'Rumbo inválido' using errcode = '22023';
  end if;
  if p_accuracy_meters is not null and (p_accuracy_meters < 0 or p_accuracy_meters > 5000) then
    raise exception 'Precisión GPS inválida' using errcode = '22023';
  end if;

  target_driver := public.centralgo_driver_id_for_user(target_company);
  if target_driver is null then
    raise exception 'Conductor autenticado no encontrado para esta central' using errcode = '42501';
  end if;

  insert into public.driver_locations (
    driver_id, company_id, lat, lng, address, speed_kmh, heading_degrees, accuracy_meters, recorded_at
  ) values (
    target_driver, target_company, p_lat, p_lng, nullif(trim(p_address), ''), p_speed_kmh,
    p_heading_degrees, p_accuracy_meters, recorded
  )
  on conflict (driver_id) do update set
    company_id = excluded.company_id,
    lat = excluded.lat,
    lng = excluded.lng,
    address = excluded.address,
    speed_kmh = excluded.speed_kmh,
    heading_degrees = excluded.heading_degrees,
    accuracy_meters = excluded.accuracy_meters,
    recorded_at = excluded.recorded_at;

  insert into public.driver_location_history (
    driver_id, company_id, lat, lng, speed_kmh, heading_degrees, accuracy_meters, recorded_at
  ) values (
    target_driver, target_company, p_lat, p_lng, p_speed_kmh, p_heading_degrees, p_accuracy_meters, recorded
  );

  return recorded;
end;
$$;

revoke all on function public.centralgo_driver_report_location(uuid, double precision, double precision, text, numeric, numeric, numeric) from public, anon;
grant execute on function public.centralgo_driver_report_location(uuid, double precision, double precision, text, numeric, numeric, numeric) to authenticated;

-- Driver trip lifecycle is updated atomically with the driver's operational
-- status. FOR UPDATE prevents two concurrent transitions from racing.
create or replace function public.centralgo_driver_transition_trip(
  p_trip_id uuid,
  p_new_status public.centralgo_trip_status
)
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
  select * into current_trip
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'Carrera no encontrada' using errcode = 'P0002';
  end if;

  own_driver := public.centralgo_driver_id_for_user(current_trip.company_id);
  if own_driver is null or current_trip.driver_id is distinct from own_driver then
    raise exception 'Esta carrera no pertenece al conductor autenticado' using errcode = '42501';
  end if;

  if not (
    (current_trip.status = 'assigned' and p_new_status = 'en_route') or
    (current_trip.status = 'en_route' and p_new_status = 'arrived') or
    (current_trip.status = 'arrived' and p_new_status = 'in_progress') or
    (current_trip.status = 'in_progress' and p_new_status = 'completed')
  ) then
    raise exception 'Transición de carrera inválida: % -> %', current_trip.status, p_new_status using errcode = '22023';
  end if;

  update public.trips
  set status = p_new_status,
      en_route_at = case when p_new_status = 'en_route' then coalesce(en_route_at, now()) else en_route_at end,
      arrived_at = case when p_new_status = 'arrived' then coalesce(arrived_at, now()) else arrived_at end,
      started_at = case when p_new_status = 'in_progress' then coalesce(started_at, now()) else started_at end,
      completed_at = case when p_new_status = 'completed' then coalesce(completed_at, now()) else completed_at end,
      version = version + 1
  where id = p_trip_id
  returning * into result_trip;

  update public.drivers
  set status = case
    when p_new_status in ('en_route','arrived') then 'en_route'::public.centralgo_driver_status
    when p_new_status = 'in_progress' then 'in_trip'::public.centralgo_driver_status
    when p_new_status = 'completed' then 'available'::public.centralgo_driver_status
    else status
  end,
  total_trips_completed = case
    when p_new_status = 'completed' then total_trips_completed + 1
    else total_trips_completed
  end
  where id = own_driver;

  return result_trip;
end;
$$;

revoke all on function public.centralgo_driver_transition_trip(uuid, public.centralgo_trip_status) from public, anon;
grant execute on function public.centralgo_driver_transition_trip(uuid, public.centralgo_trip_status) to authenticated;

-- Trusted audit writer. User identity and role are derived by the database,
-- never accepted from the browser.
create or replace function public.centralgo_write_audit(
  target_company uuid,
  p_action text,
  p_description text,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  actor_role text;
  log_id bigint;
begin
  if not public.centralgo_is_company_member(target_company) then
    raise exception 'Sin acceso a esta central' using errcode = '42501';
  end if;

  select p.name into actor_name from public.profiles p where p.id = auth.uid();
  select coalesce(
    (select m.role::text from public.company_memberships m
      where m.company_id = target_company and m.user_id = auth.uid() and m.active
      order by case m.role when 'company_admin' then 1 when 'operator' then 2 else 3 end
      limit 1),
    (select p.global_role::text from public.profiles p where p.id = auth.uid()),
    'authenticated'
  ) into actor_role;

  insert into public.audit_logs (
    company_id, user_id, user_name, user_role, action, description, metadata
  ) values (
    target_company, auth.uid(), actor_name, actor_role,
    left(trim(p_action), 120), left(trim(p_description), 2000), coalesce(p_metadata, '{}'::jsonb)
  ) returning id into log_id;

  return log_id;
end;
$$;

revoke all on function public.centralgo_write_audit(uuid, text, text, jsonb) from public, anon;
grant execute on function public.centralgo_write_audit(uuid, text, text, jsonb) to authenticated;

-- Explicitly protect privileged columns from ordinary authenticated users.
revoke insert, update, delete on table public.company_memberships from authenticated;
-- Company membership management should be performed later through a validated
-- admin RPC/Edge Function, never with a raw browser table mutation.

grant select on public.profiles, public.companies, public.company_memberships,
  public.vehicles, public.drivers, public.driver_locations, public.driver_location_history,
  public.clients, public.client_addresses, public.trips, public.fare_configs,
  public.sos_events, public.notifications, public.audit_logs, public.driver_settlements
  to authenticated;
