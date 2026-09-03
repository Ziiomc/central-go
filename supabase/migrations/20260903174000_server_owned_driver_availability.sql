-- Driver availability is explicit operational state owned by Postgres.
-- Android/Chrome may suspend timers while Maps, WhatsApp, the lock screen, or
-- another app is in front. Missing browser heartbeats must therefore never
-- disconnect an otherwise available driver or remove them from dispatch.
--
-- Pause expiry remains a server rule: the protected slot lasts 15 minutes and
-- then moves to the tail even if the PWA itself is suspended.

create or replace function public.centralgo_internal_dispatch_trip(p_trip_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
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
       and reserved.archived_at is null
       and reserved.service_enabled
       and reserved.status='available'
       and not reserved.sos_active
       and (t.scheduled_for is null or t.scheduled_for<=now()+interval '10 minutes') then
      return public.centralgo_internal_assign_offer(t.id,reserved.id,'Móvil reservado disponible y liberado para el retiro');
    elsif not found or not coalesce(reserved.service_enabled,false) or reserved.status in ('paused','offline','sos') then
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
      and d.archived_at is null
      and d.service_enabled
      and d.status='available'
      and d.user_id is not null
      and not d.sos_active
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
$$;

create or replace function public.centralgo_dispatch_due_work()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  member record;
  processed integer := 0;
  old_driver uuid;
begin
  with expired as (
    select
      d.id,
      d.company_id,
      row_number() over(
        partition by d.company_id
        order by d.service_control_updated_at asc,d.id asc
      )::bigint as tail_offset
    from public.drivers d
    where d.archived_at is null
      and d.service_enabled
      and d.status='paused'
      and d.service_control_updated_at < clock_timestamp()-interval '15 minutes'
      and d.dispatch_queue_updated_at < d.service_control_updated_at
  ), company_tail as (
    select company_id,coalesce(max(dispatch_queue_order),0)::bigint as max_order
    from public.drivers
    where archived_at is null
    group by company_id
  )
  update public.drivers d
  set dispatch_queue_order=company_tail.max_order+expired.tail_offset,
      dispatch_queue_updated_at=clock_timestamp(),
      updated_at=clock_timestamp()
  from expired
  join company_tail on company_tail.company_id=expired.company_id
  where d.id=expired.id;

  for rec in
    select t.id,t.company_id,t.code,t.client_name,t.origin_address,t.scheduled_for,t.dispatch_mode
    from public.trips t
    where t.status='pending'
      and t.scheduled_for is not null
      and t.reservation_alerted_at is null
      and t.scheduled_for <= now()+interval '10 minutes'
      and t.scheduled_for > now()-interval '30 minutes'
    order by t.scheduled_for asc
    limit 100
    for update skip locked
  loop
    update public.trips set reservation_alerted_at=now()
    where id=rec.id and reservation_alerted_at is null;

    for member in
      select cm.user_id
      from public.company_memberships cm
      where cm.company_id=rec.company_id
        and cm.active
        and cm.role in ('company_admin','operator')
    loop
      insert into public.notifications(company_id,recipient_user_id,title,message,type,read,related_id)
      values(
        rec.company_id,member.user_id,'RESERVA EN 10 MINUTOS',
        format(
          '%s · %s · retiro %s. %s',rec.client_name,
          to_char(rec.scheduled_for at time zone 'America/Santiago','HH24:MI'),
          rec.origin_address,
          case when rec.dispatch_mode='automatic'
            then 'Despacho automático activado.'
            else 'Asignación manual pendiente.' end
        ),
        'warning',false,rec.id
      );
    end loop;
    processed:=processed+1;
  end loop;

  for rec in
    select id,driver_id,dispatch_mode
    from public.trips
    where status='assigned'
      and offer_expires_at is not null
      and offer_expires_at<=now()
    order by offer_expires_at asc
    limit 50
    for update skip locked
  loop
    old_driver:=rec.driver_id;
    update public.trips
    set status='pending',
        dispatch_mode=rec.dispatch_mode,
        offered_driver_ids=case when old_driver is null then offered_driver_ids else array_append(coalesce(offered_driver_ids,'{}'::uuid[]),old_driver) end,
        driver_id=null,driver_unit_number=null,driver_name=null,assigned_at=null,offer_expires_at=null,
        notes=concat_ws(' | ',nullif(notes,''),'Oferta vencida: sin respuesta en 15 s'),
        version=version+1
    where id=rec.id and status='assigned';

    if old_driver is not null then
      update public.drivers set status='available' where id=old_driver;
    end if;

    if rec.dispatch_mode='automatic' then
      perform public.centralgo_internal_dispatch_trip(rec.id);
    end if;
    processed:=processed+1;
  end loop;

  for rec in
    select id from public.trips
    where status='pending'
      and dispatch_mode='automatic'
      and driver_id is null
      and (scheduled_for is null or scheduled_for<=now()+interval '10 minutes')
    order by coalesce(scheduled_for,created_at) asc
    limit 100
    for update skip locked
  loop
    perform public.centralgo_internal_dispatch_trip(rec.id);
    processed:=processed+1;
  end loop;

  return processed;
end;
$$;
