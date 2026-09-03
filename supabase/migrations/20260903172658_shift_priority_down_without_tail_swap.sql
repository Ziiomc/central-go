-- Moving a driver down must preserve FIFO order for every other active driver.
-- The selected driver goes to the last active slot, while each available driver
-- behind them advances exactly one active slot. This prevents the previous tail
-- driver from jumping back to the front on the next operator action.
-- Paused/offline/SOS/busy rows keep their persisted queue positions untouched.

create or replace function public.centralgo_operator_move_driver_priority(
  p_driver_id uuid,
  p_direction text
)
returns table(driver_id uuid, queue_order bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_driver public.drivers%rowtype;
  neighbor public.drivers%rowtype;
  temp_order bigint;
  changed_at timestamptz := clock_timestamp();
begin
  if p_direction not in ('up','down') then
    raise exception 'Dirección de prioridad inválida' using errcode='22023';
  end if;

  select * into current_driver
  from public.drivers
  where id=p_driver_id;

  if not found then
    raise exception 'Móvil no encontrado' using errcode='P0002';
  end if;

  if not public.centralgo_has_company_role(
    current_driver.company_id,
    array['company_admin','operator']::public.centralgo_company_role[]
  ) then
    raise exception 'Sin permiso para modificar la prioridad de esta central' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(current_driver.company_id::text)::bigint);

  select * into current_driver
  from public.drivers
  where id=p_driver_id
  for update;

  if current_driver.archived_at is not null
     or not coalesce(current_driver.service_enabled,false)
     or current_driver.status<>'available' then
    return query select current_driver.id,current_driver.dispatch_queue_order;
    return;
  end if;

  if p_direction='up' then
    select * into neighbor
    from public.drivers d
    where d.company_id=current_driver.company_id
      and d.id<>current_driver.id
      and d.archived_at is null
      and coalesce(d.service_enabled,false)
      and d.status='available'
      and d.dispatch_queue_order < current_driver.dispatch_queue_order
    order by d.dispatch_queue_order desc,d.id desc
    limit 1
    for update;

    if neighbor.id is null then
      return query select current_driver.id,current_driver.dispatch_queue_order;
      return;
    end if;

    temp_order:=current_driver.dispatch_queue_order;

    update public.drivers
    set dispatch_queue_order=neighbor.dispatch_queue_order,
        dispatch_queue_updated_at=changed_at,
        updated_at=changed_at
    where id=current_driver.id;

    update public.drivers
    set dispatch_queue_order=temp_order,
        dispatch_queue_updated_at=changed_at,
        updated_at=changed_at
    where id=neighbor.id;
  else
    if not exists (
      select 1
      from public.drivers d
      where d.company_id=current_driver.company_id
        and d.id<>current_driver.id
        and d.archived_at is null
        and coalesce(d.service_enabled,false)
        and d.status='available'
        and (d.dispatch_queue_order,d.id) > (current_driver.dispatch_queue_order,current_driver.id)
    ) then
      return query select current_driver.id,current_driver.dispatch_queue_order;
      return;
    end if;

    with active_tail as (
      select
        d.id,
        d.dispatch_queue_order,
        lag(d.dispatch_queue_order) over (
          order by d.dispatch_queue_order asc,d.id asc
        ) as previous_order,
        max(d.dispatch_queue_order) over () as last_order
      from public.drivers d
      where d.company_id=current_driver.company_id
        and d.archived_at is null
        and coalesce(d.service_enabled,false)
        and d.status='available'
        and (d.dispatch_queue_order,d.id) >= (current_driver.dispatch_queue_order,current_driver.id)
    ), mapping as (
      select
        id,
        case
          when id=current_driver.id then last_order
          else previous_order
        end as new_order
      from active_tail
    )
    update public.drivers d
    set dispatch_queue_order=m.new_order,
        dispatch_queue_updated_at=changed_at,
        updated_at=changed_at
    from mapping m
    where d.id=m.id;
  end if;

  return query
  select d.id,d.dispatch_queue_order
  from public.drivers d
  where d.id=current_driver.id;
end;
$$;

revoke all on function public.centralgo_operator_move_driver_priority(uuid,text) from public,anon;
grant execute on function public.centralgo_operator_move_driver_priority(uuid,text) to authenticated,service_role;
