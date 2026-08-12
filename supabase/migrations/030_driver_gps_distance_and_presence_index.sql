create index if not exists idx_driver_presence_user_started on public.driver_presence_sessions(user_id, started_at desc);

create or replace function public.centralgo_driver_analytics(
  target_company uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  own_driver uuid;
  connected_seconds numeric := 0;
  driving_seconds numeric := 0;
  service_km numeric := 0;
  gps_km numeric := 0;
  trips_completed integer := 0;
  earnings numeric := 0;
  avg_trip_seconds numeric := 0;
begin
  if p_from is null or p_to is null or p_to <= p_from then raise exception 'Rango de analítica inválido' using errcode = '22023'; end if;
  own_driver := public.centralgo_driver_id_for_user(target_company);
  if own_driver is null then raise exception 'Conductor no vinculado a esta central' using errcode = '42501'; end if;

  select coalesce(sum(greatest(0, extract(epoch from (
    least(coalesce(s.ended_at, case when s.last_seen_at > now() - interval '4 minutes' then now() else s.last_seen_at end), p_to) - greatest(s.started_at, p_from)
  )))),0)
  into connected_seconds
  from public.driver_presence_sessions s
  where s.driver_id = own_driver and s.started_at < p_to and coalesce(s.ended_at, s.last_seen_at) > p_from;

  select
    coalesce(sum(greatest(0, extract(epoch from (least(coalesce(t.completed_at, t.cancelled_at, now()), p_to) - greatest(t.started_at, p_from))))),0),
    coalesce(sum(case when t.completed_at >= p_from and t.completed_at < p_to then t.estimated_distance_km else 0 end),0),
    count(*) filter (where t.completed_at >= p_from and t.completed_at < p_to),
    coalesce(sum(case when t.completed_at >= p_from and t.completed_at < p_to then coalesce(t.final_fare, t.estimated_fare, 0) else 0 end),0),
    coalesce(avg(extract(epoch from (t.completed_at - t.started_at))) filter (where t.completed_at >= p_from and t.completed_at < p_to and t.started_at is not null),0)
  into driving_seconds, service_km, trips_completed, earnings, avg_trip_seconds
  from public.trips t
  where t.driver_id = own_driver and t.started_at is not null and t.started_at < p_to and coalesce(t.completed_at, t.cancelled_at, now()) > p_from;

  with points as (
    select h.lat, h.lng, h.recorded_at,
           lag(h.lat) over (order by h.recorded_at) as prev_lat,
           lag(h.lng) over (order by h.recorded_at) as prev_lng,
           lag(h.recorded_at) over (order by h.recorded_at) as prev_at
    from public.driver_location_history h
    where h.driver_id = own_driver and h.recorded_at >= p_from and h.recorded_at < p_to and coalesce(h.accuracy_meters, 50) <= 150
  ), segments as (
    select *,
      2 * 6371.0088 * asin(least(1::double precision, sqrt(
        power(sin(radians(lat - prev_lat) / 2), 2)
        + cos(radians(prev_lat)) * cos(radians(lat)) * power(sin(radians(lng - prev_lng) / 2), 2)
      ))) as km,
      extract(epoch from (recorded_at - prev_at)) as dt_seconds
    from points where prev_lat is not null and prev_lng is not null and prev_at is not null
  )
  select coalesce(sum(km) filter (where dt_seconds between 1 and 600 and km >= 0 and (km / greatest(dt_seconds, 1) * 3600) <= 180),0)
  into gps_km from segments;

  return jsonb_build_object(
    'driver_id', own_driver, 'from', p_from, 'to', p_to,
    'connected_seconds', round(connected_seconds), 'driving_seconds', round(driving_seconds),
    'gps_km', round(gps_km, 1), 'service_km', round(service_km, 1),
    'trips_completed', trips_completed, 'earnings', round(earnings),
    'avg_trip_seconds', round(avg_trip_seconds),
    'distance_source', case when gps_km > 0 then 'gps_history' else 'no_gps_movement' end
  );
end;
$function$;

revoke execute on function public.centralgo_driver_analytics(uuid,timestamptz,timestamptz) from anon, public;
grant execute on function public.centralgo_driver_analytics(uuid,timestamptz,timestamptz) to authenticated;
