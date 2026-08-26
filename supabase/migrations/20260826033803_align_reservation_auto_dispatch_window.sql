-- Keep scheduled automatic dispatch consistent with the operator's 10-minute reservation window.
-- The live cron already runs every 5 seconds; this migration only aligns the eligibility window.

create or replace function public.centralgo_internal_assign_offer(
  p_trip_id uuid,
  p_driver_id uuid,
  p_reason text default 'Despacho automático'
)
returns public.trips
language plpgsql
security definer
set search_path=public
as $function$
declare
  t public.trips%rowtype;
  d public.drivers%rowtype;
  v public.vehicles%rowtype;
  result_trip public.trips%rowtype;
begin
  select * into t from public.trips where id=p_trip_id for update;
  if not found or t.status<>'pending' then return t; end if;
  if t.scheduled_for is not null and t.scheduled_for>now()+interval '10 minutes' then return t; end if;

  select * into d from public.drivers where id=p_driver_id for update;
  if not found or d.company_id<>t.company_id or d.status<>'available' or d.sos_active then return t; end if;
  if d.id=any(coalesce(t.offered_driver_ids,'{}'::uuid[])) then return t; end if;
  if t.client_id is not null and exists(
    select 1 from public.client_driver_blocks b
    where b.company_id=t.company_id and b.client_id=t.client_id and b.driver_id=d.id and b.active
  ) then return t; end if;
  if exists(
    select 1 from public.trips x
    where x.driver_id=d.id and x.id<>t.id and x.status in ('assigned','en_route','arrived','in_progress')
  ) then return t; end if;

  if d.vehicle_id is not null then select * into v from public.vehicles where id=d.vehicle_id; end if;

  update public.trips set
    driver_id=d.id,
    driver_unit_number=d.unit_number,
    driver_name=d.display_name,
    vehicle_id=d.vehicle_id,
    vehicle_unit_number=coalesce(v.unit_number,d.unit_number),
    vehicle_plate=v.license_plate,
    reserved_driver_id=null,
    reserved_driver_unit_number=null,
    reserved_driver_name=null,
    reservation_reason=null,
    status='assigned',
    assigned_at=now(),
    offer_expires_at=now()+interval '15 seconds',
    offer_attempt=offer_attempt+1,
    en_route_at=null,
    arrived_at=null,
    started_at=null,
    version=version+1
  where id=t.id
  returning * into result_trip;

  update public.drivers set status='en_route' where id=d.id;

  insert into public.trip_dispatch_events(company_id,trip_id,driver_id,event_type,reason,created_by)
  values(t.company_id,t.id,d.id,'offered',p_reason,auth.uid());

  if d.user_id is not null then
    insert into public.notifications(company_id,recipient_user_id,title,message,type,read,related_id)
    values(
      t.company_id,
      d.user_id,
      'NUEVA CARRERA',
      concat('Retiro: ',t.origin_address,' → ',t.destination_address,'. Tienes 15 segundos para aceptar.'),
      'trip',false,t.id
    );
  end if;

  return result_trip;
end;
$function$;

create or replace function public.centralgo_internal_dispatch_trip(p_trip_id uuid)
returns public.trips
language plpgsql
security definer
set search_path=public
as $function$
declare
  t public.trips%rowtype;
  reserved public.drivers%rowtype;
  free_driver public.drivers%rowtype;
  selected_driver_id uuid;
  selected_distance double precision;
  selected_provider text;
begin
  select * into t from public.trips where id=p_trip_id for update;
  if not found or t.status<>'pending' or t.dispatch_mode<>'automatic' then return t; end if;

  if t.reserved_driver_id is not null then
    select * into reserved from public.drivers where id=t.reserved_driver_id;
    if found
       and reserved.status='available'
       and not reserved.sos_active
       and exists (
         select 1 from public.driver_presence_sessions s
         where s.driver_id=reserved.id
           and s.ended_at is null
           and s.last_seen_at > now()-interval '4 minutes'
       )
       and (t.scheduled_for is null or t.scheduled_for<=now()+interval '10 minutes') then
      return public.centralgo_internal_assign_offer(t.id,reserved.id,'Móvil reservado conectado y liberado para el retiro');
    elsif not found or reserved.status in ('paused','offline','sos') then
      update public.trips
      set reserved_driver_id=null,reserved_driver_unit_number=null,reserved_driver_name=null,reservation_reason=null
      where id=t.id returning * into t;
    end if;
  end if;

  if t.scheduled_for is not null and t.scheduled_for>now()+interval '10 minutes' then return t; end if;

  select candidate.driver_id, candidate.map_km, candidate.provider
    into selected_driver_id, selected_distance, selected_provider
  from (
    select d.id as driver_id,
           coalesce(
             (select m.distance_km::double precision
              from public.trip_driver_route_metrics m
              where m.trip_id=t.id and m.driver_id=d.id
                and m.computed_at > now()-interval '45 seconds'
              order by m.computed_at desc limit 1),
             case when l.recorded_at > now()-interval '5 minutes'
                  then public.centralgo_dispatch_map_km(l.lat,l.lng,t.origin_lat,t.origin_lng)
                  else null end,
             9999
           ) as map_km,
           case
             when exists(
               select 1 from public.trip_driver_route_metrics m
               where m.trip_id=t.id and m.driver_id=d.id
                 and m.computed_at > now()-interval '45 seconds'
             ) then 'ruta vial real'
             when l.recorded_at > now()-interval '5 minutes' then 'estimación GPS reciente'
             else 'sin GPS reciente'
           end as provider,
           d.dispatch_queue_order
    from public.drivers d
    left join public.driver_locations l on l.driver_id=d.id
    where d.company_id=t.company_id
      and d.status='available'
      and d.user_id is not null
      and not d.sos_active
      and exists (
        select 1 from public.driver_presence_sessions s
        where s.driver_id=d.id
          and s.ended_at is null
          and s.last_seen_at > now()-interval '4 minutes'
      )
      and not(d.id=any(coalesce(t.offered_driver_ids,'{}'::uuid[])))
      and not exists(
        select 1 from public.trips x
        where x.driver_id=d.id and x.status in ('assigned','en_route','arrived','in_progress')
      )
      and (
        t.client_id is null or not exists(
          select 1 from public.client_driver_blocks b
          where b.company_id=t.company_id and b.client_id=t.client_id and b.driver_id=d.id and b.active
        )
      )
  ) candidate
  order by
    case when candidate.map_km < 3 then 0 when candidate.map_km <= 5 then 1 else 2 end,
    case when candidate.map_km <= 5 then candidate.dispatch_queue_order::double precision else floor(candidate.map_km*2)/2 end,
    case when candidate.map_km <= 5 then candidate.map_km else candidate.dispatch_queue_order::double precision end,
    candidate.map_km
  limit 1;

  if selected_driver_id is not null then
    select * into free_driver from public.drivers where id=selected_driver_id;
    return public.centralgo_internal_assign_offer(
      t.id,
      free_driver.id,
      case
        when selected_distance < 3 then format('Prioridad híbrida: móvil en zona cercana (<3 km por %s), turno %s',selected_provider,free_driver.dispatch_queue_order)
        when selected_distance <= 5 then format('Prioridad híbrida: móvil dentro de 5 km por %s, turno %s',selected_provider,free_driver.dispatch_queue_order)
        when selected_distance >= 9999 then format('Sin GPS reciente: respaldo por equidad de cola, turno %s',free_driver.dispatch_queue_order)
        else format('Sin móviles en 5 km: móvil más cercano por %s (%s km), con equidad de cola',selected_provider,round(selected_distance::numeric,1))
      end
    );
  end if;

  return t;
end;
$function$;

create or replace function public.centralgo_dispatch_due_work()
returns integer
language plpgsql
security definer
set search_path=public
as $function$
declare
  rec record;
  processed integer := 0;
  old_driver uuid;
begin
  for rec in
    select id,driver_id from public.trips
    where status='assigned' and offer_expires_at is not null and offer_expires_at <= now()
    order by offer_expires_at asc limit 50
    for update skip locked
  loop
    old_driver := rec.driver_id;
    update public.trips set
      status='pending',
      dispatch_mode='automatic',
      offered_driver_ids=case when old_driver is null then offered_driver_ids else array_append(coalesce(offered_driver_ids,'{}'::uuid[]),old_driver) end,
      driver_id=null,driver_unit_number=null,driver_name=null,assigned_at=null,offer_expires_at=null,
      notes=concat_ws(' | ',nullif(notes,''),'Oferta vencida: sin respuesta en 15 s'),version=version+1
    where id=rec.id and status='assigned';
    if old_driver is not null then update public.drivers set status='available' where id=old_driver; end if;
    perform public.centralgo_internal_dispatch_trip(rec.id);
    processed := processed+1;
  end loop;

  for rec in
    select id from public.trips
    where status='pending' and dispatch_mode='automatic' and driver_id is null
      and (scheduled_for is null or scheduled_for <= now()+interval '10 minutes')
    order by coalesce(scheduled_for,created_at) asc limit 100
    for update skip locked
  loop
    perform public.centralgo_internal_dispatch_trip(rec.id);
    processed := processed+1;
  end loop;
  return processed;
end;
$function$;

revoke all on function public.centralgo_internal_assign_offer(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.centralgo_internal_assign_offer(uuid,uuid,text) to service_role;
revoke all on function public.centralgo_internal_dispatch_trip(uuid) from public,anon,authenticated;
grant execute on function public.centralgo_internal_dispatch_trip(uuid) to service_role;
revoke all on function public.centralgo_dispatch_due_work() from public,anon,authenticated;
grant execute on function public.centralgo_dispatch_due_work() to service_role;
