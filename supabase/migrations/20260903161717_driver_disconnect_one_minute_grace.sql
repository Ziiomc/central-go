-- Give app drivers a 60-second recovery window after an explicit Disconnect.
-- Disconnect still removes the driver from active dispatch immediately, but the
-- previous FIFO slot is reserved for one minute so an accidental tap can be
-- corrected without unfairly sending the driver to the end of the queue.
-- Pause keeps its independent 15-minute protection rule.

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
  reconnect_within_grace boolean := false;
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

  -- Repeating the same selected state is idempotent. In particular, tapping
  -- Disconnect repeatedly must not extend the one-minute recovery window.
  if driver_row.status=new_status then
    if new_status='offline' then
      update public.driver_presence_sessions
      set last_seen_at=greatest(now_at,started_at),
          ended_at=greatest(now_at,started_at)
      where driver_id=target_driver and ended_at is null;
    end if;
    return new_status;
  end if;

  -- Explicit Disconnect takes the driver out of dispatch now, but does not
  -- alter dispatch_queue_order. service_control_updated_at anchors the 60 s
  -- recovery window. If they do not return in time, the next reconnect moves
  -- them to the current tail.
  if new_status='offline' then
    update public.driver_presence_sessions
    set last_seen_at=greatest(now_at,started_at),
        ended_at=greatest(now_at,started_at)
    where driver_id=target_driver and ended_at is null;

    update public.drivers
    set status='offline'::public.centralgo_driver_status,
        sos_active=false,
        service_control_updated_at=now_at,
        updated_at=now_at
    where id=target_driver;

    return new_status;
  end if;

  if driver_row.status='offline' and new_status in ('available','paused') then
    reconnect_within_grace:=driver_row.service_control_updated_at >= now_at-interval '1 minute';

    if not reconnect_within_grace then
      perform pg_advisory_xact_lock(hashtext(target_company::text)::bigint);

      select coalesce(max(d.dispatch_queue_order),0)+1
      into next_queue_order
      from public.drivers d
      where d.company_id=target_company
        and d.id<>target_driver
        and d.archived_at is null;
    end if;

    update public.driver_presence_sessions
    set last_seen_at=greatest(now_at,started_at),
        ended_at=greatest(now_at,started_at)
    where driver_id=target_driver and ended_at is null;

    update public.drivers
    set status=new_status,
        dispatch_queue_order=case
          when reconnect_within_grace then dispatch_queue_order
          else next_queue_order
        end,
        dispatch_queue_updated_at=case
          when reconnect_within_grace then dispatch_queue_updated_at
          else now_at
        end,
        service_control_updated_at=now_at,
        updated_at=now_at
    where id=target_driver;

    insert into public.driver_presence_sessions(
      company_id,driver_id,user_id,started_at,last_seen_at
    )
    values(target_company,target_driver,auth.uid(),now_at,now_at);

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

revoke all on function public.centralgo_driver_set_manual_status(uuid,public.centralgo_driver_status) from public,anon;
grant execute on function public.centralgo_driver_set_manual_status(uuid,public.centralgo_driver_status) to authenticated,service_role;
