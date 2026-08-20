-- Central GO: reservations + fair radius auto-dispatch.
-- Business rules:
--   * A scheduled pickup is a reservation and keeps its pickup date/time.
--   * Operators are warned once when the reservation enters the 10-minute window.
--   * Automatic reservations start dispatching inside that same 10-minute window.
--   * Automatic dispatch considers only connected app drivers with fresh GPS.
--   * First search <= 1.5 km, respecting queue order; if empty, expand to <= 5 km
--     and respect the queue again. Never jumps to a driver farther than 5 km.

alter table public.trips
  add column if not exists reservation_alerted_at timestamptz;

create index if not exists trips_reservation_alert_window_idx
  on public.trips(company_id, scheduled_for)
  where status='pending' and scheduled_for is not null and reservation_alerted_at is null;

create or replace function public.centralgo_internal_dispatch_trip(p_trip_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.trips%rowtype;
  selected_driver public.drivers%rowtype;
  selected_distance double precision;
  selected_provider text;
  selected_band text;
begin
  select * into t
  from public.trips
  where id=p_trip_id
  for update;

  if not found or t.status<>'pending' or t.dispatch_mode<>'automatic' then
    return t;
  end if;

  -- A reservation is dispatched ten minutes before pickup, not when it is created.
  if t.scheduled_for is not null and t.scheduled_for > now()+interval '10 minutes' then
    return t;
  end if;

  -- Predictive/busy reservations from the older strategy must not bypass the queue.
  if t.reserved_driver_id is not null then
    update public.trips
      set reserved_driver_id=null,
          reserved_driver_unit_number=null,
          reserved_driver_name=null,
          reservation_reason=null
    where id=t.id
    returning * into t;
  end if;

  -- Stage 1: <= 1.5 km. Queue order is the deciding factor inside the radius.
  select d.*, candidate.distance_km, candidate.provider
    into selected_driver, selected_distance, selected_provider
  from public.drivers d
  join lateral (
    select
      coalesce(
        (select m.distance_km::double precision
           from public.trip_driver_route_metrics m
          where m.trip_id=t.id
            and m.driver_id=d.id
            and m.computed_at > now()-interval '90 seconds'
          order by m.computed_at desc
          limit 1),
        public.centralgo_dispatch_map_km(l.lat,l.lng,t.origin_lat,t.origin_lng),
        9999::double precision
      ) as distance_km,
      case when exists(
        select 1
        from public.trip_driver_route_metrics m
        where m.trip_id=t.id
          and m.driver_id=d.id
          and m.computed_at > now()-interval '90 seconds'
      ) then 'ruta vial real' else 'GPS' end as provider
    from public.driver_locations l
    where l.driver_id=d.id
      and l.recorded_at > now()-interval '3 minutes'
  ) candidate on true
  where d.company_id=t.company_id
    and d.status='available'
    and d.user_id is not null
    and not d.sos_active
    and candidate.distance_km <= 1.5
    and not (d.id=any(coalesce(t.offered_driver_ids,'{}'::uuid[])))
    and exists (
      select 1
      from public.driver_presence_sessions ps
      where ps.driver_id=d.id
        and ps.ended_at is null
        and ps.last_seen_at > now()-interval '3 minutes'
    )
    and not exists(
      select 1 from public.trips x
      where x.driver_id=d.id
        and x.id<>t.id
        and x.status in ('assigned','en_route','arrived','in_progress')
    )
    and (
      t.client_id is null or not exists(
        select 1 from public.client_driver_blocks b
        where b.company_id=t.company_id
          and b.client_id=t.client_id
          and b.driver_id=d.id
          and b.active
      )
    )
  order by d.dispatch_queue_order asc, candidate.distance_km asc, d.id
  limit 1
  for update of d skip locked;

  if selected_driver.id is not null then
    selected_band := '1,5 km';
  else
    -- Stage 2: no one qualified in 1.5 km. Expand to 5 km and start queue priority again.
    select d.*, candidate.distance_km, candidate.provider
      into selected_driver, selected_distance, selected_provider
    from public.drivers d
    join lateral (
      select
        coalesce(
          (select m.distance_km::double precision
             from public.trip_driver_route_metrics m
            where m.trip_id=t.id
              and m.driver_id=d.id
              and m.computed_at > now()-interval '90 seconds'
            order by m.computed_at desc
            limit 1),
          public.centralgo_dispatch_map_km(l.lat,l.lng,t.origin_lat,t.origin_lng),
          9999::double precision
        ) as distance_km,
        case when exists(
          select 1
          from public.trip_driver_route_metrics m
          where m.trip_id=t.id
            and m.driver_id=d.id
            and m.computed_at > now()-interval '90 seconds'
        ) then 'ruta vial real' else 'GPS' end as provider
      from public.driver_locations l
      where l.driver_id=d.id
        and l.recorded_at > now()-interval '3 minutes'
    ) candidate on true
    where d.company_id=t.company_id
      and d.status='available'
      and d.user_id is not null
      and not d.sos_active
      and candidate.distance_km > 1.5
      and candidate.distance_km <= 5
      and not (d.id=any(coalesce(t.offered_driver_ids,'{}'::uuid[])))
      and exists (
        select 1
        from public.driver_presence_sessions ps
        where ps.driver_id=d.id
          and ps.ended_at is null
          and ps.last_seen_at > now()-interval '3 minutes'
      )
      and not exists(
        select 1 from public.trips x
        where x.driver_id=d.id
          and x.id<>t.id
          and x.status in ('assigned','en_route','arrived','in_progress')
      )
      and (
        t.client_id is null or not exists(
          select 1 from public.client_driver_blocks b
          where b.company_id=t.company_id
            and b.client_id=t.client_id
            and b.driver_id=d.id
            and b.active
        )
      )
    order by d.dispatch_queue_order asc, candidate.distance_km asc, d.id
    limit 1
    for update of d skip locked;

    if selected_driver.id is not null then
      selected_band := '5 km';
    end if;
  end if;

  if selected_driver.id is null then
    -- Stay pending. The scheduled worker will retry; an operator can always assign manually.
    return t;
  end if;

  return public.centralgo_internal_assign_offer(
    t.id,
    selected_driver.id,
    format(
      'Despacho automático: radio %s, prioridad #%s, %.1f km por %s',
      selected_band,
      selected_driver.dispatch_queue_order,
      selected_distance,
      selected_provider
    )
  );
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
  processed integer:=0;
  old_driver uuid;
begin
  -- Warn central operators exactly once when a reservation is 10 minutes away.
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
    update public.trips
      set reservation_alerted_at=now()
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
        rec.company_id,
        member.user_id,
        'RESERVA EN 10 MINUTOS',
        format(
          '%s · %s · retiro %s. %s',
          rec.client_name,
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

  -- Rotate an unanswered automatic offer without breaking queue fairness.
  for rec in
    select id,driver_id
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
          dispatch_mode='automatic',
          offered_driver_ids=case when old_driver is null then offered_driver_ids else array_append(coalesce(offered_driver_ids,'{}'::uuid[]),old_driver) end,
          driver_id=null,
          driver_unit_number=null,
          driver_name=null,
          assigned_at=null,
          offer_expires_at=null,
          notes=concat_ws(' | ',nullif(notes,''),'Oferta vencida: sin respuesta en 15 s'),
          version=version+1
      where id=rec.id and status='assigned';
    if old_driver is not null then
      update public.drivers set status='available' where id=old_driver;
    end if;
    perform public.centralgo_enqueue_dispatch_routing(rec.id);
    processed:=processed+1;
  end loop;

  -- Immediate automatic trips and reservations inside the 10-minute window.
  for rec in
    select id
    from public.trips
    where status='pending'
      and dispatch_mode='automatic'
      and driver_id is null
      and (scheduled_for is null or scheduled_for<=now()+interval '10 minutes')
    order by coalesce(scheduled_for,created_at) asc
    limit 100
    for update skip locked
  loop
    perform public.centralgo_enqueue_dispatch_routing(rec.id);
    processed:=processed+1;
  end loop;

  return processed;
end;
$$;

-- Manual assignment is allowed once the reservation enters the operator's 10-minute window.
create or replace function public.centralgo_operator_assign_trip(p_trip_id uuid,p_driver_id uuid)
returns public.trips
language plpgsql
security definer
set search_path=public
as $$
declare
  t public.trips%rowtype;
  d public.drivers%rowtype;
  result_trip public.trips%rowtype;
  previous_driver uuid;
begin
  select * into t from public.trips where id=p_trip_id for update;
  if not found then raise exception 'Carrera no encontrada' using errcode='P0002'; end if;
  if not public.centralgo_has_company_role(t.company_id,array['company_admin','operator']::public.centralgo_company_role[]) then
    raise exception 'Sin permiso para despachar esta central' using errcode='42501';
  end if;
  if t.status in('completed','cancelled','in_progress') then
    raise exception 'La carrera ya no puede asignarse' using errcode='55000';
  end if;
  if t.scheduled_for is not null and t.scheduled_for>now()+interval '10 minutes' then
    raise exception 'La reserva aún no entra en la ventana de despacho (10 minutos)' using errcode='55000';
  end if;

  select * into d from public.drivers where id=p_driver_id for update;
  if not found or d.company_id<>t.company_id then raise exception 'Móvil inválido para esta central' using errcode='22023'; end if;
  if d.status<>'available' and t.driver_id is distinct from d.id then raise exception 'El móvil no está disponible' using errcode='55000'; end if;
  if exists(select 1 from public.trips x where x.driver_id=d.id and x.id<>t.id and x.status in('assigned','en_route','arrived','in_progress')) then
    raise exception 'El móvil ya tiene una carrera activa' using errcode='55000';
  end if;

  previous_driver:=t.driver_id;
  if previous_driver is not null and previous_driver<>d.id then
    update public.drivers set status='available' where id=previous_driver;
  end if;

  update public.trips
    set status='pending',
        driver_id=null,
        driver_unit_number=null,
        driver_name=null,
        offer_expires_at=null,
        dispatch_mode='manual',
        reserved_driver_id=null,
        reserved_driver_unit_number=null,
        reserved_driver_name=null,
        reservation_reason=null
    where id=t.id;

  result_trip:=public.centralgo_internal_assign_offer(t.id,d.id,'Asignación manual de operadora');
  return result_trip;
end;
$$;

revoke all on function public.centralgo_internal_dispatch_trip(uuid) from public, anon, authenticated;
grant execute on function public.centralgo_internal_dispatch_trip(uuid) to service_role;
revoke all on function public.centralgo_dispatch_due_work() from public, anon, authenticated;
grant execute on function public.centralgo_dispatch_due_work() to service_role;
revoke all on function public.centralgo_operator_assign_trip(uuid,uuid) from public, anon;
grant execute on function public.centralgo_operator_assign_trip(uuid,uuid) to authenticated, service_role;
