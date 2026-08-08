-- Central GO atomic operator/driver operations.

create or replace function public.centralgo_operator_assign_trip(p_trip_id uuid, p_driver_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  current_trip public.trips%rowtype;
  target_driver public.drivers%rowtype;
  previous_driver uuid;
  result_trip public.trips%rowtype;
begin
  select * into current_trip from public.trips where id = p_trip_id for update;
  if not found then raise exception 'Carrera no encontrada' using errcode = 'P0002'; end if;
  if not public.centralgo_has_company_role(current_trip.company_id, array['company_admin','operator']::public.centralgo_company_role[]) then
    raise exception 'Sin permiso para despachar esta central' using errcode = '42501';
  end if;
  if current_trip.status in ('completed','cancelled','in_progress') then
    raise exception 'La carrera ya no puede asignarse' using errcode = '55000';
  end if;

  select * into target_driver from public.drivers where id = p_driver_id for update;
  if not found or target_driver.company_id <> current_trip.company_id then
    raise exception 'Móvil inválido para esta central' using errcode = '22023';
  end if;
  if target_driver.status <> 'available' and current_trip.driver_id is distinct from target_driver.id then
    raise exception 'El móvil no está disponible' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.trips t
    where t.driver_id = target_driver.id and t.id <> current_trip.id
      and t.status in ('assigned','en_route','arrived','in_progress')
  ) then
    raise exception 'El móvil ya tiene una carrera activa' using errcode = '55000';
  end if;

  previous_driver := current_trip.driver_id;
  if previous_driver is not null and previous_driver <> target_driver.id then
    update public.drivers set status = 'available' where id = previous_driver;
  end if;

  update public.trips
  set driver_id = target_driver.id,
      driver_unit_number = target_driver.unit_number,
      driver_name = target_driver.display_name,
      status = 'assigned',
      assigned_at = now(),
      en_route_at = null,
      arrived_at = null,
      started_at = null,
      version = version + 1
  where id = current_trip.id
  returning * into result_trip;

  update public.drivers set status = 'en_route' where id = target_driver.id;
  return result_trip;
end;
$$;

create or replace function public.centralgo_operator_unassign_trip(p_trip_id uuid, p_reason text default null)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  current_trip public.trips%rowtype;
  result_trip public.trips%rowtype;
begin
  select * into current_trip from public.trips where id = p_trip_id for update;
  if not found then raise exception 'Carrera no encontrada' using errcode = 'P0002'; end if;
  if not public.centralgo_has_company_role(current_trip.company_id, array['company_admin','operator']::public.centralgo_company_role[]) then
    raise exception 'Sin permiso para modificar esta carrera' using errcode = '42501';
  end if;
  if current_trip.status in ('completed','cancelled','in_progress') then
    raise exception 'La carrera ya no puede volver a pendientes' using errcode = '55000';
  end if;

  if current_trip.driver_id is not null then
    update public.drivers set status = 'available' where id = current_trip.driver_id;
  end if;

  update public.trips
  set status = 'pending', driver_id = null, driver_unit_number = null, driver_name = null,
      assigned_at = null, en_route_at = null, arrived_at = null,
      notes = case when nullif(trim(coalesce(p_reason,'')), '') is null then notes
                   else concat_ws(' | ', nullif(notes,''), trim(p_reason)) end,
      version = version + 1
  where id = current_trip.id
  returning * into result_trip;
  return result_trip;
end;
$$;

create or replace function public.centralgo_operator_cancel_trip(p_trip_id uuid, p_reason text)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  current_trip public.trips%rowtype;
  result_trip public.trips%rowtype;
begin
  select * into current_trip from public.trips where id = p_trip_id for update;
  if not found then raise exception 'Carrera no encontrada' using errcode = 'P0002'; end if;
  if not public.centralgo_has_company_role(current_trip.company_id, array['company_admin','operator']::public.centralgo_company_role[]) then
    raise exception 'Sin permiso para cancelar esta carrera' using errcode = '42501';
  end if;
  if current_trip.status in ('completed','cancelled') then
    raise exception 'La carrera ya está cerrada' using errcode = '55000';
  end if;
  if nullif(trim(coalesce(p_reason,'')), '') is null then
    raise exception 'Debes indicar el motivo de cancelación' using errcode = '22023';
  end if;

  if current_trip.driver_id is not null then
    update public.drivers set status = 'available' where id = current_trip.driver_id;
  end if;

  update public.trips
  set status = 'cancelled', cancelled_at = now(), cancel_reason = trim(p_reason), version = version + 1
  where id = current_trip.id
  returning * into result_trip;
  return result_trip;
end;
$$;

create or replace function public.centralgo_operator_set_trip_status(p_trip_id uuid, p_new_status public.centralgo_trip_status)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  current_trip public.trips%rowtype;
  result_trip public.trips%rowtype;
begin
  select * into current_trip from public.trips where id = p_trip_id for update;
  if not found then raise exception 'Carrera no encontrada' using errcode = 'P0002'; end if;
  if not public.centralgo_has_company_role(current_trip.company_id, array['company_admin','operator']::public.centralgo_company_role[]) then
    raise exception 'Sin permiso para modificar esta carrera' using errcode = '42501';
  end if;
  if p_new_status in ('pending','assigned','cancelled') then
    raise exception 'Usa la operación específica para asignar, desasignar o cancelar' using errcode = '22023';
  end if;
  if current_trip.driver_id is null then
    raise exception 'La carrera no tiene móvil asignado' using errcode = '55000';
  end if;
  if not (
    (current_trip.status in ('assigned','en_route') and p_new_status = 'en_route') or
    (current_trip.status in ('assigned','en_route','arrived') and p_new_status = 'arrived') or
    (current_trip.status in ('assigned','en_route','arrived') and p_new_status = 'in_progress') or
    (current_trip.status = 'in_progress' and p_new_status = 'completed')
  ) then
    raise exception 'Transición inválida: % -> %', current_trip.status, p_new_status using errcode = '22023';
  end if;

  update public.trips
  set status = p_new_status,
      en_route_at = case when p_new_status = 'en_route' then coalesce(en_route_at, now()) else en_route_at end,
      arrived_at = case when p_new_status = 'arrived' then coalesce(arrived_at, now()) else arrived_at end,
      started_at = case when p_new_status = 'in_progress' then coalesce(started_at, now()) else started_at end,
      completed_at = case when p_new_status = 'completed' then coalesce(completed_at, now()) else completed_at end,
      final_fare = case when p_new_status = 'completed' then coalesce(final_fare, estimated_fare) else final_fare end,
      version = version + 1
  where id = current_trip.id
  returning * into result_trip;

  update public.drivers
  set status = case
      when p_new_status in ('en_route','arrived') then 'en_route'::public.centralgo_driver_status
      when p_new_status = 'in_progress' then 'in_trip'::public.centralgo_driver_status
      when p_new_status = 'completed' then 'available'::public.centralgo_driver_status
      else status end,
      total_trips_completed = case when p_new_status = 'completed' then total_trips_completed + 1 else total_trips_completed end,
      today_earnings = case when p_new_status = 'completed' then today_earnings + coalesce(result_trip.final_fare, result_trip.estimated_fare) else today_earnings end
  where id = current_trip.driver_id;

  return result_trip;
end;
$$;

create or replace function public.centralgo_driver_trigger_sos(p_lat double precision default null, p_lng double precision default null, p_address text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_driver public.drivers%rowtype;
  event_id uuid;
begin
  select d.* into target_driver from public.drivers d
  where d.user_id = auth.uid() order by d.updated_at desc limit 1 for update;
  if not found then raise exception 'Conductor autenticado no encontrado' using errcode = '42501'; end if;

  update public.drivers set status = 'sos', sos_active = true, sos_timestamp = now() where id = target_driver.id;
  insert into public.sos_events(company_id, driver_id, lat, lng, address)
  values(target_driver.company_id, target_driver.id, p_lat, p_lng, nullif(trim(coalesce(p_address,'')), ''))
  returning id into event_id;
  return event_id;
end;
$$;

create or replace function public.centralgo_operator_resolve_sos(p_event_id uuid, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.sos_events%rowtype;
begin
  select * into event_row from public.sos_events where id = p_event_id for update;
  if not found then raise exception 'Alerta SOS no encontrada' using errcode = 'P0002'; end if;
  if not public.centralgo_has_company_role(event_row.company_id, array['company_admin','operator']::public.centralgo_company_role[]) then
    raise exception 'Sin permiso para resolver esta alerta' using errcode = '42501';
  end if;
  if event_row.resolved_at is not null then return; end if;

  update public.sos_events set resolved_at = now(), resolved_by = auth.uid(), resolution_notes = nullif(trim(coalesce(p_notes,'')), '') where id = p_event_id;
  update public.drivers set sos_active = false, sos_timestamp = null, status = 'available' where id = event_row.driver_id;
end;
$$;

create or replace function public.centralgo_admin_settle_driver(p_driver_id uuid, p_amount numeric default null, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  driver_row public.drivers%rowtype;
  settlement_id uuid;
  settle_amount numeric;
begin
  select * into driver_row from public.drivers where id = p_driver_id for update;
  if not found then raise exception 'Conductor no encontrado' using errcode = 'P0002'; end if;
  if not public.centralgo_has_company_role(driver_row.company_id, array['company_admin']::public.centralgo_company_role[]) then
    raise exception 'Solo el administrador puede registrar rendiciones' using errcode = '42501';
  end if;
  settle_amount := coalesce(p_amount, driver_row.commission_balance);
  insert into public.driver_settlements(company_id, driver_id, amount, notes, settled_by)
  values(driver_row.company_id, driver_row.id, settle_amount, nullif(trim(coalesce(p_notes,'')), ''), auth.uid())
  returning id into settlement_id;
  update public.drivers set commission_balance = 0 where id = driver_row.id;
  return settlement_id;
end;
$$;

revoke all on function public.centralgo_operator_assign_trip(uuid, uuid) from public, anon;
revoke all on function public.centralgo_operator_unassign_trip(uuid, text) from public, anon;
revoke all on function public.centralgo_operator_cancel_trip(uuid, text) from public, anon;
revoke all on function public.centralgo_operator_set_trip_status(uuid, public.centralgo_trip_status) from public, anon;
revoke all on function public.centralgo_driver_trigger_sos(double precision, double precision, text) from public, anon;
revoke all on function public.centralgo_operator_resolve_sos(uuid, text) from public, anon;
revoke all on function public.centralgo_admin_settle_driver(uuid, numeric, text) from public, anon;

grant execute on function public.centralgo_operator_assign_trip(uuid, uuid) to authenticated;
grant execute on function public.centralgo_operator_unassign_trip(uuid, text) to authenticated;
grant execute on function public.centralgo_operator_cancel_trip(uuid, text) to authenticated;
grant execute on function public.centralgo_operator_set_trip_status(uuid, public.centralgo_trip_status) to authenticated;
grant execute on function public.centralgo_driver_trigger_sos(double precision, double precision, text) to authenticated;
grant execute on function public.centralgo_operator_resolve_sos(uuid, text) to authenticated;
grant execute on function public.centralgo_admin_settle_driver(uuid, numeric, text) to authenticated;
