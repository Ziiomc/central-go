-- Driver queue consistency:
-- 1) a real new app presence session joins at the bottom of the queue;
-- 2) currently connected app drivers are reconciled by their session start time;
-- 3) drivers can read a safe, company-scoped queue snapshot without exposing
--    the full drivers table or fleet GPS data.

-- Reconcile the current APP drivers using only the queue slots they already
-- occupy. This preserves traditional/radio drivers in their existing slots,
-- while APP drivers are ordered oldest connection first.
with active_app as (
  select
    d.id,
    d.company_id,
    d.dispatch_queue_order,
    s.started_at
  from public.drivers d
  join lateral (
    select ps.started_at, ps.last_seen_at
    from public.driver_presence_sessions ps
    where ps.driver_id = d.id
      and ps.ended_at is null
    order by ps.started_at desc, ps.id desc
    limit 1
  ) s on true
  where d.archived_at is null
    and d.operation_mode = 'app'
    and d.service_enabled
    and d.status not in ('offline','paused','sos')
    and s.last_seen_at >= clock_timestamp() - interval '4 minutes 30 seconds'
), ranked_drivers as (
  select
    id,
    company_id,
    row_number() over (
      partition by company_id
      order by started_at asc, id asc
    ) as rn
  from active_app
), ranked_slots as (
  select
    company_id,
    dispatch_queue_order,
    row_number() over (
      partition by company_id
      order by dispatch_queue_order asc, id asc
    ) as rn
  from active_app
)
update public.drivers d
set dispatch_queue_order = slots.dispatch_queue_order,
    dispatch_queue_updated_at = clock_timestamp()
from ranked_drivers drivers_rank
join ranked_slots slots
  on slots.company_id = drivers_rank.company_id
 and slots.rn = drivers_rank.rn
where d.id = drivers_rank.id
  and d.dispatch_queue_order is distinct from slots.dispatch_queue_order;

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
begin
  own_driver := public.centralgo_driver_id_for_user(target_company);
  if own_driver is null then
    raise exception 'Conductor no vinculado a esta central' using errcode='42501';
  end if;

  select * into driver_row
  from public.drivers
  where id = own_driver
  for update;

  if not driver_row.service_enabled then
    update public.driver_presence_sessions
      set last_seen_at = greatest(heartbeat_at, started_at),
          ended_at = greatest(heartbeat_at, started_at)
    where driver_id = own_driver
      and ended_at is null;
    return null;
  end if;

  -- Opening the authenticated driver app restores APP mode when the operator
  -- had temporarily left the account in traditional/radio mode.
  if driver_row.user_id is not null
     and driver_row.operation_mode = 'traditional' then
    update public.drivers
      set operation_mode = 'app',
          status = case
            when status in ('offline','paused') then 'available'::public.centralgo_driver_status
            else status
          end,
          service_control_updated_at = heartbeat_at,
          updated_at = heartbeat_at
    where id = own_driver
    returning * into driver_row;
  end if;

  update public.driver_presence_sessions
  set ended_at = greatest(last_seen_at, started_at)
  where driver_id = own_driver
    and ended_at is null
    and last_seen_at < heartbeat_at - interval '4 minutes';

  select id into session_id
  from public.driver_presence_sessions
  where driver_id = own_driver
    and ended_at is null
  order by started_at desc, id desc
  limit 1
  for update;

  if session_id is null then
    -- Serialize joins per company so two drivers connecting at the same instant
    -- cannot receive the same queue position.
    perform pg_advisory_xact_lock(hashtext(target_company::text)::bigint);

    select coalesce(max(d.dispatch_queue_order), 0) + 1
      into next_queue_order
    from public.drivers d
    where d.company_id = target_company
      and d.id <> own_driver
      and d.archived_at is null;

    insert into public.driver_presence_sessions(
      company_id, driver_id, user_id, started_at, last_seen_at
    )
    values(target_company, own_driver, auth.uid(), heartbeat_at, heartbeat_at)
    returning id into session_id;

    created_new_session := true;

    -- A new real connection always enters after drivers already in the queue.
    update public.drivers
    set dispatch_queue_order = next_queue_order,
        dispatch_queue_updated_at = heartbeat_at,
        updated_at = heartbeat_at
    where id = own_driver
    returning * into driver_row;
  else
    update public.driver_presence_sessions
    set last_seen_at = greatest(heartbeat_at, started_at)
    where id = session_id;
  end if;

  if created_new_session
     and driver_row.operation_mode = 'app'
     and driver_row.status = 'offline'
     and not exists (
       select 1
       from public.trips t
       where t.driver_id = own_driver
         and t.status in ('assigned','en_route','arrived','in_progress')
     ) then
    update public.drivers
    set status = 'available'::public.centralgo_driver_status,
        updated_at = heartbeat_at
    where id = own_driver;
  end if;

  return session_id;
end;
$$;

revoke all on function public.centralgo_driver_presence_ping(uuid) from public, anon;
grant execute on function public.centralgo_driver_presence_ping(uuid) to authenticated, service_role;

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
    coalesce(s.started_at, d.dispatch_queue_updated_at, d.updated_at),
    s.last_seen_at
  from public.drivers d
  left join lateral (
    select ps.started_at, ps.last_seen_at
    from public.driver_presence_sessions ps
    where ps.driver_id = d.id
      and ps.ended_at is null
    order by ps.started_at desc, ps.id desc
    limit 1
  ) s on true
  where d.company_id = target_company
    and d.archived_at is null
    and d.service_enabled
    and (
      (
        d.operation_mode = 'traditional'
        and d.status = 'available'
      )
      or (
        d.operation_mode = 'app'
        and d.status not in ('offline','paused','sos')
        and s.last_seen_at >= clock_timestamp() - interval '4 minutes 30 seconds'
      )
    )
  order by
    d.dispatch_queue_order asc,
    coalesce(s.started_at, d.dispatch_queue_updated_at, d.updated_at) asc,
    d.unit_number asc,
    d.id asc;
end;
$$;

revoke all on function public.centralgo_driver_queue_snapshot(uuid) from public, anon;
grant execute on function public.centralgo_driver_queue_snapshot(uuid) to authenticated, service_role;
