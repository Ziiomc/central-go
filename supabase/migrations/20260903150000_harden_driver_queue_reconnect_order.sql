-- Harden the driver FIFO lifecycle.
--
-- Invariants:
-- * an already connected driver keeps dispatch_queue_order while heartbeats or
--   PWA visibility change;
-- * Pause keeps the slot for 15 minutes, then moves to the tail once;
-- * an explicit Disconnect closes presence immediately;
-- * returning from offline to Disponible/Pausa receives a NEW tail position at
--   that moment, so a disconnected driver can never recover an older slot;
-- * a driver's first real app presence also joins at the tail.

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

  -- Repeating the selected state is idempotent. Tapping Pause again must not
  -- restart the 15-minute protection window, and repeated Disconnect must not
  -- keep generating new queue positions.
  if driver_row.status=new_status then
    if new_status='offline' then
      update public.driver_presence_sessions
      set last_seen_at=greatest(now_at,started_at),
          ended_at=greatest(now_at,started_at)
      where driver_id=target_driver and ended_at is null;
    end if;
    return new_status;
  end if;

  -- Disconnect is authoritative and immediately invalidates the current slot.
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

  -- This is the key reconnect rule: an explicit offline state never carries a
  -- historical slot back into the active queue. Rejoining receives the current
  -- tail atomically, after everyone who is already in the queue.
  if driver_row.status='offline' and new_status in ('available','paused') then
    perform pg_advisory_xact_lock(hashtext(target_company::text)::bigint);

    select coalesce(max(d.dispatch_queue_order),0)+1
    into next_queue_order
    from public.drivers d
    where d.company_id=target_company
      and d.id<>target_driver
      and d.archived_at is null;

    -- Defensive cleanup: an explicit offline state must never reuse a stale
    -- presence session when the driver comes back.
    update public.driver_presence_sessions
    set last_seen_at=greatest(now_at,started_at),
        ended_at=greatest(now_at,started_at)
    where driver_id=target_driver and ended_at is null;

    update public.drivers
    set status=new_status,
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
  had_presence_history boolean := false;
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

  -- An explicit disconnect is authoritative. Background heartbeats must not
  -- reconnect the driver until Disponible or Pausa is explicitly selected.
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

  -- Pause protects the slot for 15 minutes. After that, move it once.
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
  end if;

  -- Browser/Android can suspend timers while the PWA is minimized. We may end
  -- a stale presence session, but that event alone never changes queue order.
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
    select exists(
      select 1 from public.driver_presence_sessions ps
      where ps.driver_id=own_driver
    ) into had_presence_history;

    -- A truly first app connection must never inherit the arbitrary queue order
    -- that the driver row had when it was registered.
    if not had_presence_history then
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

revoke all on function public.centralgo_driver_set_manual_status(uuid,public.centralgo_driver_status) from public,anon;
revoke all on function public.centralgo_driver_presence_ping(uuid) from public,anon;
grant execute on function public.centralgo_driver_set_manual_status(uuid,public.centralgo_driver_status) to authenticated,service_role;
grant execute on function public.centralgo_driver_presence_ping(uuid) to authenticated,service_role;
