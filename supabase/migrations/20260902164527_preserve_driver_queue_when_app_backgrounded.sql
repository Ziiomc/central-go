create or replace function public.centralgo_driver_presence_ping(target_company uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  own_driver uuid;
  driver_row public.drivers%rowtype;
  session_id uuid;
  heartbeat_at timestamptz := clock_timestamp();
  next_queue_order bigint;
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

  -- Pause protects the current queue slot for 15 minutes. Once that window
  -- expires, place the driver at the end exactly once.
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

  -- Browser/Android may suspend JavaScript timers while the PWA is minimized.
  -- Close a stale presence session for connectivity reporting, but do NOT alter
  -- dispatch_queue_order here: losing a heartbeat is not an explicit disconnect.
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
$function$;
