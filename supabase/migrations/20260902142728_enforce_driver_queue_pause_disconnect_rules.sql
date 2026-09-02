-- Queue lifecycle rules for the driver app:
-- * a short accidental connection gap keeps the current slot for 15 minutes;
-- * Pause keeps the slot for at most 15 minutes;
-- * an explicit disconnect moves the driver to the end immediately;
-- * the driver-facing snapshot includes paused drivers so their position stays visible.

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
  pause_expired boolean := false;
  pause_was_already_moved boolean := false;
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

  -- Repeating the selected state is idempotent. In particular, tapping Pause
  -- again must not restart its 15-minute protection window.
  if driver_row.status=new_status then
    if new_status='offline' then
      update public.driver_presence_sessions
      set last_seen_at=greatest(now_at,started_at),
          ended_at=greatest(now_at,started_at)
      where driver_id=target_driver and ended_at is null;
    end if;
    return new_status;
  end if;

  if new_status='offline' then
    perform pg_advisory_xact_lock(hashtext(target_company::text)::bigint);

    select coalesce(max(d.dispatch_queue_order),0)+1
    into next_queue_order
    from public.drivers d
    where d.company_id=target_company
      and d.id<>target_driver
      and d.archived_at is null;

    update public.driver_presence_sessions
    set last_seen_at=greatest(now_at,started_at),
        ended_at=greatest(now_at,started_at)
    where driver_id=target_driver and ended_at is null;

    update public.drivers
    set status='offline'::public.centralgo_driver_status,
        sos_active=false,
        dispatch_queue_order=next_queue_order,
        dispatch_queue_updated_at=now_at,
        service_control_updated_at=now_at,
        updated_at=now_at
    where id=target_driver;

    return new_status;
  end if;

  if new_status='available' and driver_row.status='paused' then
    pause_expired:=driver_row.service_control_updated_at < now_at-interval '15 minutes';
    pause_was_already_moved:=driver_row.dispatch_queue_updated_at >= driver_row.service_control_updated_at;

    if pause_expired and not pause_was_already_moved then
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
      dispatch_queue_order=case
        when pause_expired and not pause_was_already_moved then next_queue_order
        else dispatch_queue_order
      end,
      dispatch_queue_updated_at=case
        when pause_expired and not pause_was_already_moved then now_at
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
  heartbeat_at timestamptz := clock_timestamp();
  next_queue_order bigint;
  preserve_pause_slot boolean := false;
  expired_pause_moved boolean := false;
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

  -- An explicit disconnect is authoritative. A background heartbeat must not
  -- reconnect the driver until they choose Disponible or Pausa again.
  if driver_row.status='offline' then
    update public.driver_presence_sessions
    set last_seen_at=greatest(heartbeat_at,started_at),
        ended_at=greatest(heartbeat_at,started_at)
    where driver_id=own_driver and ended_at is null;
    return null;
  end if;

  if driver_row.user_id is not null and driver_row.operation_mode='traditional' then
    update public.drivers
    set operation_mode='app',
        service_control_updated_at=heartbeat_at,
        updated_at=heartbeat_at
    where id=own_driver
    returning * into driver_row;
  end if;

  -- Once Pause exceeds 15 minutes, place the driver at the end exactly once,
  -- even if the app remains open and keeps sending heartbeats.
  if driver_row.status='paused'
     and driver_row.service_control_updated_at < heartbeat_at-interval '15 minutes'
     and driver_row.dispatch_queue_updated_at < driver_row.service_control_updated_at then
    perform pg_advisory_xact_lock(hashtext(target_company::text)::bigint);

    select coalesce(max(d.dispatch_queue_order),0)+1
    into next_queue_order
    from public.drivers d
    where d.company_id=target_company
      and d.id<>own_driver
      and d.archived_at is null;

    update public.drivers
    set dispatch_queue_order=next_queue_order,
        dispatch_queue_updated_at=heartbeat_at,
        updated_at=heartbeat_at
    where id=own_driver
    returning * into driver_row;

    expired_pause_moved:=true;
  end if;

  -- A driver can disappear from the live/dispatchable fleet after four
  -- minutes, but the same presence session is retained for 15 minutes. A
  -- brief signal or app interruption therefore does not unfairly lose place.
  update public.driver_presence_sessions
  set ended_at=greatest(last_seen_at,started_at)
  where driver_id=own_driver
    and ended_at is null
    and last_seen_at < heartbeat_at-interval '15 minutes';

  select id into session_id
  from public.driver_presence_sessions
  where driver_id=own_driver and ended_at is null
  order by started_at desc,id desc
  limit 1
  for update;

  if session_id is null then
    perform pg_advisory_xact_lock(hashtext(target_company::text)::bigint);

    preserve_pause_slot:=driver_row.status='paused'
      and driver_row.service_control_updated_at >= heartbeat_at-interval '15 minutes';

    if not preserve_pause_slot and not expired_pause_moved then
      select coalesce(max(d.dispatch_queue_order),0)+1
      into next_queue_order
      from public.drivers d
      where d.company_id=target_company
        and d.id<>own_driver
        and d.archived_at is null;

      update public.drivers
      set dispatch_queue_order=next_queue_order,
          dispatch_queue_updated_at=heartbeat_at,
          updated_at=heartbeat_at
      where id=own_driver
      returning * into driver_row;
    end if;

    insert into public.driver_presence_sessions(company_id,driver_id,user_id,started_at,last_seen_at)
    values(target_company,own_driver,auth.uid(),heartbeat_at,heartbeat_at)
    returning id into session_id;
  else
    update public.driver_presence_sessions
    set last_seen_at=greatest(heartbeat_at,started_at)
    where id=session_id;
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
  disconnected_at timestamptz := clock_timestamp();
  next_queue_order bigint;
  has_active_trip boolean;
begin
  own_driver:=public.centralgo_driver_id_for_user(target_company);
  if own_driver is null then return; end if;

  perform 1 from public.drivers where id=own_driver for update;
  perform pg_advisory_xact_lock(hashtext(target_company::text)::bigint);

  select exists(
    select 1 from public.trips t
    where t.driver_id=own_driver
      and t.status in ('assigned','en_route','arrived','in_progress')
  ) into has_active_trip;

  select coalesce(max(d.dispatch_queue_order),0)+1
  into next_queue_order
  from public.drivers d
  where d.company_id=target_company
    and d.id<>own_driver
    and d.archived_at is null;

  update public.driver_presence_sessions
  set last_seen_at=greatest(disconnected_at,started_at),
      ended_at=greatest(disconnected_at,started_at)
  where driver_id=own_driver and ended_at is null;

  update public.drivers
  set status=case
        when has_active_trip then status
        else 'offline'::public.centralgo_driver_status
      end,
      sos_active=case when has_active_trip then sos_active else false end,
      dispatch_queue_order=next_queue_order,
      dispatch_queue_updated_at=disconnected_at,
      service_control_updated_at=disconnected_at,
      updated_at=disconnected_at
  where id=own_driver;
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
    or public.centralgo_has_company_role(
      target_company,
      array['company_admin','operator']::public.centralgo_company_role[]
    )
    or public.centralgo_driver_id_for_user(target_company) is not null
  ) then
    raise exception 'Sin permiso para consultar la fila de esta central' using errcode='42501';
  end if;

  return query
  select
    d.id,
    d.user_id,
    d.unit_number::text,
    d.status::text,
    d.service_enabled,
    d.operation_mode::text,
    d.dispatch_queue_order,
    coalesce(s.started_at,d.dispatch_queue_updated_at,d.updated_at),
    s.last_seen_at
  from public.drivers d
  left join lateral (
    select ps.started_at,ps.last_seen_at
    from public.driver_presence_sessions ps
    where ps.driver_id=d.id
      and ps.ended_at is null
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
        and d.status not in ('offline','sos')
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

revoke all on function public.centralgo_driver_set_manual_status(uuid,public.centralgo_driver_status) from public,anon;
revoke all on function public.centralgo_driver_presence_ping(uuid) from public,anon;
revoke all on function public.centralgo_driver_presence_end(uuid) from public,anon;
revoke all on function public.centralgo_driver_queue_snapshot(uuid) from public,anon;

grant execute on function public.centralgo_driver_set_manual_status(uuid,public.centralgo_driver_status) to authenticated,service_role;
grant execute on function public.centralgo_driver_presence_ping(uuid) to authenticated,service_role;
grant execute on function public.centralgo_driver_presence_end(uuid) to authenticated,service_role;
grant execute on function public.centralgo_driver_queue_snapshot(uuid) to authenticated,service_role;
