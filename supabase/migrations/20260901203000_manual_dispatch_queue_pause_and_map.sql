-- Central GO queue and dispatch lifecycle consistency.
-- Manual offers stay manual after reject/timeout; automatic offers may retry.
-- Pause keeps the queue slot for 15 minutes, including a presence reconnect.
-- Starting a trip moves the driver to the end of the queue.
-- Idle disconnected APP drivers become offline and can disappear from the map.

create or replace function public.centralgo_driver_reject_trip(
  p_trip_id uuid,
  p_reason text default 'Rechazado por conductor'::text
)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.trips%rowtype;
  own_driver uuid;
  result_trip public.trips%rowtype;
begin
  select * into t from public.trips where id=p_trip_id for update;
  if not found then raise exception 'Carrera no encontrada' using errcode='P0002'; end if;

  own_driver:=public.centralgo_driver_id_for_user(t.company_id);
  if own_driver is null or t.driver_id is distinct from own_driver then
    raise exception 'Esta oferta no pertenece al conductor autenticado' using errcode='42501';
  end if;
  if t.status<>'assigned' then
    raise exception 'La oferta ya no está pendiente de respuesta' using errcode='55000';
  end if;

  insert into public.trip_dispatch_events(company_id,trip_id,driver_id,event_type,reason,created_by)
  values(
    t.company_id,t.id,own_driver,'rejected',
    left(coalesce(nullif(trim(p_reason),''),'Rechazado por conductor'),240),auth.uid()
  );

  update public.trips
  set status='pending',
      -- Keep the dispatch decision made by the operator. A manual trip must
      -- stop here; only an automatic trip is eligible for another offer.
      dispatch_mode=t.dispatch_mode,
      offered_driver_ids=array_append(coalesce(offered_driver_ids,'{}'::uuid[]),own_driver),
      driver_id=null,
      driver_unit_number=null,
      driver_name=null,
      assigned_at=null,
      offer_expires_at=null,
      version=version+1,
      notes=concat_ws(' | ',nullif(notes,''),left(coalesce(nullif(trim(p_reason),''),'Rechazado por conductor'),240))
  where id=t.id
  returning * into result_trip;

  update public.drivers set status='available' where id=own_driver;

  if result_trip.dispatch_mode='automatic' then
    result_trip:=public.centralgo_internal_dispatch_trip(result_trip.id);
  end if;
  return result_trip;
end;
$$;

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
  driver_row public.drivers%rowtype;
  now_at timestamptz := clock_timestamp();
  next_queue_order bigint;
  pause_is_protected boolean := false;
begin
  if new_status not in ('available','paused','offline') then
    raise exception 'Estado manual no permitido: %',new_status using errcode='22023';
  end if;

  target_driver:=public.centralgo_driver_id_for_user(target_company);
  if target_driver is null then
    raise exception 'Conductor autenticado no encontrado para esta central' using errcode='42501';
  end if;

  select * into driver_row
  from public.drivers
  where id=target_driver
  for update;

  if exists (
    select 1 from public.trips t
    where t.driver_id=target_driver
      and t.status in ('assigned','en_route','arrived','in_progress')
  ) then
    raise exception 'No se puede cambiar disponibilidad durante una carrera activa' using errcode='55000';
  end if;

  if new_status='available' and driver_row.status='paused' then
    pause_is_protected := driver_row.service_control_updated_at >= now_at - interval '15 minutes';
    if not pause_is_protected then
      perform pg_advisory_xact_lock(hashtext(target_company::text)::bigint);
      select coalesce(max(d.dispatch_queue_order),0)+1
      into next_queue_order
      from public.drivers d
      where d.company_id=target_company
        and d.id<>target_driver
        and d.archived_at is null;
    end if;
  end if;

  update public.drivers
  set status=new_status,
      sos_active=case when new_status='offline' then false else sos_active end,
      dispatch_queue_order=case
        when new_status='available'
         and driver_row.status='paused'
         and not pause_is_protected
        then next_queue_order
        else dispatch_queue_order
      end,
      dispatch_queue_updated_at=case
        when new_status='available'
         and driver_row.status='paused'
         and not pause_is_protected
        then now_at
        else dispatch_queue_updated_at
      end,
      service_control_updated_at=now_at,
      updated_at=now_at
  where id=target_driver;

  return new_status;
end;
$$;

create or replace function public.centralgo_driver_presence_ping(target_company uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  own_driver uuid;
  driver_row public.drivers%rowtype;
  session_id uuid;
  created_new_session boolean := false;
  heartbeat_at timestamptz := clock_timestamp();
  next_queue_order bigint;
  preserve_pause_slot boolean := false;
begin
  own_driver:=public.centralgo_driver_id_for_user(target_company);
  if own_driver is null then
    raise exception 'Conductor no vinculado a esta central' using errcode='42501';
  end if;

  select * into driver_row
  from public.drivers
  where id=own_driver
  for update;

  if not driver_row.service_enabled then
    update public.driver_presence_sessions
    set last_seen_at=greatest(heartbeat_at,started_at),
        ended_at=greatest(heartbeat_at,started_at)
    where driver_id=own_driver and ended_at is null;
    return null;
  end if;

  if driver_row.user_id is not null and driver_row.operation_mode='traditional' then
    update public.drivers
    set operation_mode='app',
        status=case
          when status='offline' then 'available'::public.centralgo_driver_status
          else status
        end,
        service_control_updated_at=heartbeat_at,
        updated_at=heartbeat_at
    where id=own_driver
    returning * into driver_row;
  end if;

  update public.driver_presence_sessions
  set ended_at=greatest(last_seen_at,started_at)
  where driver_id=own_driver
    and ended_at is null
    and last_seen_at < heartbeat_at - interval '4 minutes';

  select id into session_id
  from public.driver_presence_sessions
  where driver_id=own_driver and ended_at is null
  order by started_at desc,id desc
  limit 1
  for update;

  if session_id is null then
    perform pg_advisory_xact_lock(hashtext(target_company::text)::bigint);

    preserve_pause_slot := driver_row.status='paused'
      and driver_row.service_control_updated_at >= heartbeat_at - interval '15 minutes';

    if not preserve_pause_slot then
      select coalesce(max(d.dispatch_queue_order),0)+1
      into next_queue_order
      from public.drivers d
      where d.company_id=target_company
        and d.id<>own_driver
        and d.archived_at is null;
    end if;

    insert into public.driver_presence_sessions(company_id,driver_id,user_id,started_at,last_seen_at)
    values(target_company,own_driver,auth.uid(),heartbeat_at,heartbeat_at)
    returning id into session_id;

    created_new_session:=true;

    if not preserve_pause_slot then
      update public.drivers
      set dispatch_queue_order=next_queue_order,
          dispatch_queue_updated_at=heartbeat_at,
          updated_at=heartbeat_at
      where id=own_driver
      returning * into driver_row;
    end if;
  else
    update public.driver_presence_sessions
    set last_seen_at=greatest(heartbeat_at,started_at)
    where id=session_id;
  end if;

  if created_new_session
     and driver_row.operation_mode='app'
     and driver_row.status='offline'
     and not exists (
       select 1 from public.trips t
       where t.driver_id=own_driver
         and t.status in ('assigned','en_route','arrived','in_progress')
     ) then
    update public.drivers
    set status='available'::public.centralgo_driver_status,
        updated_at=heartbeat_at
    where id=own_driver;
  end if;

  return session_id;
end;
$$;

create or replace function public.centralgo_driver_presence_end(target_company uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  own_driver uuid;
  ended_at timestamptz := clock_timestamp();
begin
  own_driver:=public.centralgo_driver_id_for_user(target_company);
  if own_driver is null then return; end if;

  update public.driver_presence_sessions
  set last_seen_at=greatest(ended_at,started_at),
      ended_at=greatest(ended_at,started_at)
  where driver_id=own_driver and ended_at is null;

  -- A normal idle disconnect should immediately disappear from the live fleet.
  -- Paused drivers keep their pause state/slot and active-trip drivers keep the
  -- operational status needed by the central.
  update public.drivers d
  set status='offline'::public.centralgo_driver_status,
      updated_at=ended_at
  where d.id=own_driver
    and d.status='available'
    and not exists (
      select 1 from public.trips t
      where t.driver_id=d.id
        and t.status in ('assigned','en_route','arrived','in_progress')
    );
end;
$$;

create or replace function public.centralgo_operator_assign_trip(p_trip_id uuid,p_driver_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.trips%rowtype;
  d public.drivers%rowtype;
  result_trip public.trips%rowtype;
  previous_driver uuid;
  next_queue_order bigint;
begin
  select * into t from public.trips where id=p_trip_id for update;
  if not found then raise exception 'Carrera no encontrada' using errcode='P0002'; end if;
  if not public.centralgo_has_company_role(t.company_id,array['company_admin','operator']::public.centralgo_company_role[]) then raise exception 'Sin permiso para despachar esta central' using errcode='42501'; end if;
  if t.status in ('completed','cancelled','in_progress') then raise exception 'La carrera ya no puede asignarse' using errcode='55000'; end if;
  if t.scheduled_for is not null and t.scheduled_for > now()+interval '10 minutes' then raise exception 'La carrera está agendada para más adelante' using errcode='55000'; end if;
  if t.driver_id=p_driver_id and t.status in ('assigned','en_route','arrived') then return t; end if;

  select * into d from public.drivers where id=p_driver_id for update;
  if not found or d.company_id<>t.company_id then raise exception 'Móvil inválido para esta central' using errcode='22023'; end if;
  if t.client_id is not null and exists(select 1 from public.client_driver_blocks b where b.company_id=t.company_id and b.client_id=t.client_id and b.driver_id=d.id and b.active) then raise exception 'Este cliente tiene registrado que rechaza este móvil' using errcode='55000'; end if;
  if d.status<>'available' and t.driver_id is distinct from d.id then raise exception 'El móvil no está disponible' using errcode='55000'; end if;
  if d.operation_mode<>'traditional' and not exists(select 1 from public.driver_presence_sessions s where s.driver_id=d.id and s.ended_at is null and s.last_seen_at>now()-interval '4 minutes') then raise exception 'El móvil figura disponible, pero su app no está conectada. Pídele al conductor abrir Central GO y vuelve a intentar.' using errcode='55000'; end if;
  if exists(select 1 from public.trips x where x.driver_id=d.id and x.id<>t.id and x.status in ('assigned','en_route','arrived','in_progress')) then raise exception 'El móvil ya tiene una carrera activa' using errcode='55000'; end if;

  previous_driver:=t.driver_id;
  if previous_driver is not null and previous_driver<>d.id then
    update public.drivers set status='available' where id=previous_driver;
  end if;

  if d.operation_mode='traditional' then
    perform pg_advisory_xact_lock(hashtext(t.company_id::text)::bigint);
    select coalesce(max(x.dispatch_queue_order),0)+1
      into next_queue_order
    from public.drivers x
    where x.company_id=t.company_id and x.id<>d.id and x.archived_at is null;

    update public.trips
    set driver_id=d.id,
        driver_unit_number=d.unit_number,
        driver_name=d.display_name,
        status='en_route',
        assigned_at=coalesce(assigned_at,now()),
        en_route_at=coalesce(en_route_at,now()),
        offer_expires_at=null,
        dispatch_mode='manual',
        reserved_driver_id=null,
        reserved_driver_unit_number=null,
        reserved_driver_name=null,
        reservation_reason=null,
        version=version+1
    where id=t.id
    returning * into result_trip;

    update public.drivers
    set status='en_route',
        dispatch_queue_order=next_queue_order,
        dispatch_queue_updated_at=clock_timestamp(),
        updated_at=clock_timestamp()
    where id=d.id;

    perform public.centralgo_write_audit(
      t.company_id,'ASIGNACION_TRADICIONAL_CONFIRMADA',
      format('La operadora confirmó por radio o teléfono la carrera %s para el móvil %s',t.code,d.unit_number),
      jsonb_build_object('tripId',t.id,'driverId',d.id,'operationMode','traditional')
    );
    return result_trip;
  end if;

  update public.trips
  set status='pending',driver_id=null,driver_unit_number=null,driver_name=null,
      offer_expires_at=null,dispatch_mode='manual',reserved_driver_id=null,
      reserved_driver_unit_number=null,reserved_driver_name=null,reservation_reason=null,
      offered_driver_ids=array_remove(coalesce(offered_driver_ids,'{}'::uuid[]),d.id)
  where id=t.id;

  result_trip:=public.centralgo_internal_assign_offer(t.id,d.id,'Asignación manual de operadora');
  return result_trip;
end;
$$;

create or replace function public.centralgo_operator_set_trip_status(
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
  result_trip public.trips%rowtype;
  next_queue_order bigint;
  should_move_to_end boolean := false;
begin
  select * into current_trip from public.trips where id=p_trip_id for update;
  if not found then raise exception 'Carrera no encontrada' using errcode='P0002'; end if;
  if not public.centralgo_has_company_role(current_trip.company_id,array['company_admin','operator']::public.centralgo_company_role[]) then raise exception 'Sin permiso para modificar esta carrera' using errcode='42501'; end if;
  if p_new_status in ('pending','assigned','cancelled') then raise exception 'Usa la operación específica para asignar, desasignar o cancelar' using errcode='22023'; end if;
  if current_trip.driver_id is null then raise exception 'La carrera no tiene móvil asignado' using errcode='55000'; end if;
  if not (
    (current_trip.status in ('assigned','en_route') and p_new_status='en_route') or
    (current_trip.status in ('assigned','en_route','arrived') and p_new_status='arrived') or
    (current_trip.status in ('assigned','en_route','arrived') and p_new_status='in_progress') or
    (current_trip.status='in_progress' and p_new_status='completed')
  ) then
    raise exception 'Transición inválida: % -> %',current_trip.status,p_new_status using errcode='22023';
  end if;

  should_move_to_end := current_trip.status='assigned' and p_new_status in ('en_route','arrived','in_progress');
  if should_move_to_end then
    perform pg_advisory_xact_lock(hashtext(current_trip.company_id::text)::bigint);
    select coalesce(max(d.dispatch_queue_order),0)+1
      into next_queue_order
    from public.drivers d
    where d.company_id=current_trip.company_id
      and d.id<>current_trip.driver_id
      and d.archived_at is null;
  end if;

  update public.trips
  set status=p_new_status,
      en_route_at=case when p_new_status='en_route' then coalesce(en_route_at,now()) else en_route_at end,
      arrived_at=case when p_new_status='arrived' then coalesce(arrived_at,now()) else arrived_at end,
      started_at=case when p_new_status='in_progress' then coalesce(started_at,now()) else started_at end,
      completed_at=case when p_new_status='completed' then coalesce(completed_at,now()) else completed_at end,
      final_fare=case when p_new_status='completed' then coalesce(final_fare,estimated_fare) else final_fare end,
      version=version+1
  where id=current_trip.id
  returning * into result_trip;

  update public.drivers
  set status=case
        when p_new_status in ('en_route','arrived') then 'en_route'::public.centralgo_driver_status
        when p_new_status='in_progress' then 'in_trip'::public.centralgo_driver_status
        when p_new_status='completed' then 'available'::public.centralgo_driver_status
        else status
      end,
      dispatch_queue_order=case when should_move_to_end then next_queue_order else dispatch_queue_order end,
      dispatch_queue_updated_at=case when should_move_to_end then clock_timestamp() else dispatch_queue_updated_at end,
      total_trips_completed=case when p_new_status='completed' then total_trips_completed+1 else total_trips_completed end,
      today_earnings=case when p_new_status='completed' then today_earnings+coalesce(result_trip.final_fare,result_trip.estimated_fare) else today_earnings end,
      updated_at=clock_timestamp()
  where id=current_trip.driver_id;

  return result_trip;
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
  -- Clean up idle APP mobiles whose presence disappeared. Active-trip and pause
  -- states are intentionally preserved.
  update public.drivers d
  set status='offline'::public.centralgo_driver_status,
      updated_at=clock_timestamp()
  where d.archived_at is null
    and d.service_enabled
    and d.operation_mode='app'
    and d.status='available'
    and not exists (
      select 1 from public.driver_presence_sessions s
      where s.driver_id=d.id
        and s.ended_at is null
        and s.last_seen_at >= clock_timestamp()-interval '4 minutes 30 seconds'
    )
    and not exists (
      select 1 from public.trips t
      where t.driver_id=d.id
        and t.status in ('assigned','en_route','arrived','in_progress')
    );

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
        -- Do not convert a manual dispatch into an automatic one on timeout.
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

create or replace function public.centralgo_driver_queue_snapshot(target_company uuid)
returns table(
  driver_id uuid,
  user_id uuid,
  unit_number text,
  status text,
  service_enabled boolean,
  operation_mode text,
  queue_order bigint,
  connected_at timestamptz,
  presence_last_seen_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not (
    public.centralgo_is_super_admin()
    or public.centralgo_has_company_role(target_company,array['company_admin','operator']::public.centralgo_company_role[])
    or public.centralgo_driver_id_for_user(target_company) is not null
  ) then
    raise exception 'Sin permiso para consultar la fila de esta central' using errcode='42501';
  end if;

  return query
  select
    d.id,d.user_id,d.unit_number::text,d.status::text,d.service_enabled,
    d.operation_mode::text,d.dispatch_queue_order,
    coalesce(s.started_at,d.dispatch_queue_updated_at,d.updated_at),
    s.last_seen_at
  from public.drivers d
  left join lateral (
    select ps.started_at,ps.last_seen_at
    from public.driver_presence_sessions ps
    where ps.driver_id=d.id and ps.ended_at is null
    order by ps.started_at desc,ps.id desc
    limit 1
  ) s on true
  where d.company_id=target_company
    and d.archived_at is null
    and d.service_enabled
    and (
      (d.operation_mode='traditional' and d.status='available')
      or (
        d.operation_mode='app'
        and d.status not in ('offline','paused','sos')
        and s.last_seen_at >= clock_timestamp()-interval '4 minutes 30 seconds'
      )
    )
  order by
    d.dispatch_queue_order asc,
    coalesce(s.started_at,d.dispatch_queue_updated_at,d.updated_at) asc,
    d.unit_number asc,
    d.id asc;
end;
$$;

revoke all on function public.centralgo_driver_reject_trip(uuid,text) from public,anon;
revoke all on function public.centralgo_driver_set_manual_status(uuid,public.centralgo_driver_status) from public,anon;
revoke all on function public.centralgo_driver_presence_ping(uuid) from public,anon;
revoke all on function public.centralgo_driver_presence_end(uuid) from public,anon;
revoke all on function public.centralgo_operator_assign_trip(uuid,uuid) from public,anon;
revoke all on function public.centralgo_operator_set_trip_status(uuid,public.centralgo_trip_status) from public,anon;
revoke all on function public.centralgo_dispatch_due_work() from public,anon,authenticated;
revoke all on function public.centralgo_driver_queue_snapshot(uuid) from public,anon;

grant execute on function public.centralgo_driver_reject_trip(uuid,text) to authenticated,service_role;
grant execute on function public.centralgo_driver_set_manual_status(uuid,public.centralgo_driver_status) to authenticated,service_role;
grant execute on function public.centralgo_driver_presence_ping(uuid) to authenticated,service_role;
grant execute on function public.centralgo_driver_presence_end(uuid) to authenticated,service_role;
grant execute on function public.centralgo_operator_assign_trip(uuid,uuid) to authenticated,service_role;
grant execute on function public.centralgo_operator_set_trip_status(uuid,public.centralgo_trip_status) to authenticated,service_role;
grant execute on function public.centralgo_dispatch_due_work() to service_role;
grant execute on function public.centralgo_driver_queue_snapshot(uuid) to authenticated,service_role;
