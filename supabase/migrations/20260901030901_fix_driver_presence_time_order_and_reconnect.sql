-- Repair the rare millisecond ordering drift that can leave a stale presence
-- session impossible to close, which makes an active app driver disappear
-- from the dispatch priority queue even while GPS keeps reporting.
update public.driver_presence_sessions
set last_seen_at = started_at
where ended_at is null
  and last_seen_at < started_at;

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
begin
  own_driver := public.centralgo_driver_id_for_user(target_company);
  if own_driver is null then
    raise exception 'Conductor no vinculado a esta central' using errcode='42501';
  end if;

  select * into driver_row
  from public.drivers
  where id=own_driver
  for update;

  if not driver_row.service_enabled then
    update public.driver_presence_sessions
      set last_seen_at=greatest(heartbeat_at, started_at),
          ended_at=greatest(heartbeat_at, started_at)
      where driver_id=own_driver and ended_at is null;
    return null;
  end if;

  -- If the operator temporarily put an app-capable driver in manual/radio
  -- mode, opening the authenticated driver app restores app operation.
  if driver_row.user_id is not null
     and driver_row.operation_mode='traditional' then
    update public.drivers
      set operation_mode='app',
          status=case
            when status in ('offline','paused') then 'available'::public.centralgo_driver_status
            else status
          end,
          service_control_updated_at=heartbeat_at,
          updated_at=heartbeat_at
      where id=own_driver
      returning * into driver_row;
  end if;

  -- A stale session must never be closed before it started. Historical rows
  -- created with a few ms of clock/default drift previously violated
  -- driver_presence_time_order here and made every subsequent ping fail.
  update public.driver_presence_sessions
  set ended_at=greatest(last_seen_at, started_at)
  where driver_id=own_driver and ended_at is null
    and last_seen_at < heartbeat_at-interval '4 minutes';

  select id into session_id
  from public.driver_presence_sessions
  where driver_id=own_driver and ended_at is null
  order by started_at desc
  limit 1
  for update;

  if session_id is null then
    insert into public.driver_presence_sessions(
      company_id, driver_id, user_id, started_at, last_seen_at
    )
    values(target_company, own_driver, auth.uid(), heartbeat_at, heartbeat_at)
    returning id into session_id;
    created_new_session := true;
  else
    update public.driver_presence_sessions
      set last_seen_at=greatest(heartbeat_at, started_at)
      where id=session_id;
  end if;

  if created_new_session
     and driver_row.operation_mode='app'
     and driver_row.status='offline'
     and not exists (
       select 1
       from public.trips t
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

revoke all on function public.centralgo_driver_presence_ping(uuid) from public, anon;
grant execute on function public.centralgo_driver_presence_ping(uuid) to authenticated, service_role;
