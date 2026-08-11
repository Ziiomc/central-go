-- Keep driver-side trip completion accounting consistent with operator-side completion.
create or replace function public.centralgo_driver_transition_trip(p_trip_id uuid, p_new_status public.centralgo_trip_status)
returns public.trips
language plpgsql
security definer
set search_path to 'public'
as $function$
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
      final_fare = case when p_new_status = 'completed' then coalesce(final_fare, estimated_fare) else final_fare end,
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
      end,
      today_earnings = case
        when p_new_status = 'completed' then today_earnings + coalesce(result_trip.final_fare, result_trip.estimated_fare)
        else today_earnings
      end
  where id = own_driver;

  return result_trip;
end;
$function$;
