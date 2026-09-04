-- Prevent two operator/manual joins from allocating the same queue tail.
-- Queue mutations are serialized per company before the driver row is locked,
-- matching the lock order used by the other dispatch-priority RPCs.

create or replace function public.centralgo_operator_set_driver_daily_service(
  p_driver_id uuid,
  p_enabled boolean,
  p_mode text default null
)
returns public.drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.drivers%rowtype;
  requested_mode text;
  next_mode text;
  manual_toggle boolean;
  joining_manual boolean;
  next_queue_order bigint;
begin
  select * into d
  from public.drivers
  where id = p_driver_id;

  if not found then
    raise exception 'Conductor no encontrado' using errcode='P0002';
  end if;

  if not public.centralgo_has_company_role(
    d.company_id,
    array['company_admin','operator']::public.centralgo_company_role[]
  ) and not public.centralgo_is_super_admin() then
    raise exception 'Sin permiso para controlar el turno de este móvil' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(d.company_id::text)::bigint);

  select * into d
  from public.drivers
  where id = p_driver_id
  for update;

  if exists(
    select 1 from public.trips t
    where t.driver_id=d.id
      and t.status in ('assigned','en_route','arrived','in_progress')
  ) then
    raise exception 'No puedes cambiar el turno mientras el móvil tiene una carrera activa' using errcode='55000';
  end if;

  requested_mode := coalesce(p_mode, d.operation_mode, 'app');
  if requested_mode not in ('app','traditional') then
    raise exception 'Modo de operación no permitido' using errcode='22023';
  end if;

  manual_toggle := p_mode = 'traditional';

  next_mode := case
    when manual_toggle and not p_enabled then 'app'
    else requested_mode
  end;

  joining_manual := p_enabled
    and requested_mode='traditional'
    and (
      d.operation_mode is distinct from 'traditional'
      or not coalesce(d.service_enabled,false)
      or d.status<>'available'
    );

  if joining_manual then
    select coalesce(max(other.dispatch_queue_order),0)+1
      into next_queue_order
    from public.drivers other
    where other.company_id=d.company_id
      and other.id<>d.id
      and other.archived_at is null;
  else
    next_queue_order := d.dispatch_queue_order;
  end if;

  if requested_mode='traditional' then
    update public.driver_presence_sessions
      set last_seen_at=now(), ended_at=now()
    where driver_id=d.id and ended_at is null;
  end if;

  update public.drivers
  set operation_mode = next_mode,
      service_enabled = case when manual_toggle then true else p_enabled end,
      status = case
        when manual_toggle and not p_enabled then 'offline'::public.centralgo_driver_status
        when not p_enabled then 'offline'::public.centralgo_driver_status
        when next_mode='traditional' then 'available'::public.centralgo_driver_status
        when d.status='offline' then 'offline'::public.centralgo_driver_status
        else d.status
      end,
      dispatch_queue_order = next_queue_order,
      dispatch_queue_updated_at = case when joining_manual then now() else d.dispatch_queue_updated_at end,
      service_control_updated_at = now(),
      updated_at = now()
  where id=d.id
  returning * into d;

  return d;
end;
$$;

revoke all on function public.centralgo_operator_set_driver_daily_service(uuid,boolean,text) from public,anon;
grant execute on function public.centralgo_operator_set_driver_daily_service(uuid,boolean,text) to authenticated,service_role;
