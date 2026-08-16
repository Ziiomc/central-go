create or replace function public.centralgo_driver_cancel_trip(p_trip_id uuid, p_reason text)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  target_driver public.drivers%rowtype;
  current_trip public.trips%rowtype;
  result_trip public.trips%rowtype;
  clean_reason text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión' using errcode = '42501';
  end if;

  clean_reason := nullif(trim(coalesce(p_reason, '')), '');
  if clean_reason is null then
    raise exception 'Debes indicar el motivo de cancelación' using errcode = '22023';
  end if;
  clean_reason := left(clean_reason, 180);

  select d.* into target_driver
  from public.drivers d
  where d.user_id = auth.uid()
  order by d.updated_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Conductor autenticado no encontrado' using errcode = '42501';
  end if;

  select * into current_trip
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'Carrera no encontrada' using errcode = 'P0002';
  end if;

  if current_trip.company_id <> target_driver.company_id or current_trip.driver_id is distinct from target_driver.id then
    raise exception 'Solo puedes cancelar tu propia carrera activa' using errcode = '42501';
  end if;

  if current_trip.status not in ('assigned','en_route','arrived','in_progress') then
    raise exception 'La carrera ya no se puede cancelar desde la app del conductor' using errcode = '55000';
  end if;

  update public.drivers
  set status = case when sos_active then 'sos'::public.centralgo_driver_status else 'available'::public.centralgo_driver_status end
  where id = target_driver.id;

  update public.trips
  set status = 'cancelled',
      cancelled_at = now(),
      cancel_reason = clean_reason,
      version = version + 1
  where id = current_trip.id
  returning * into result_trip;

  insert into public.notifications(company_id, title, message, type, related_id)
  values (
    current_trip.company_id,
    'Carrera cancelada por conductor',
    concat(target_driver.unit_number, ' canceló ', current_trip.code, '. Motivo: ', clean_reason),
    'warning',
    current_trip.id
  );

  insert into public.audit_logs(company_id, user_id, user_name, user_role, action, description, metadata)
  values (
    current_trip.company_id,
    auth.uid(),
    target_driver.display_name,
    'driver',
    'CANCELAR_VIAJE_CONDUCTOR',
    concat('Conductor ', target_driver.unit_number, ' canceló ', current_trip.code, '. Motivo: ', clean_reason),
    jsonb_build_object('trip_id', current_trip.id, 'driver_id', target_driver.id, 'reason', clean_reason)
  );

  return result_trip;
end;
$$;

revoke all on function public.centralgo_driver_cancel_trip(uuid, text) from public, anon;
grant execute on function public.centralgo_driver_cancel_trip(uuid, text) to authenticated;
