-- The dispatch queue is operational state, not browser presence state.
-- Android may suspend or kill the PWA while the driver opens Maps, WhatsApp,
-- locks the phone, or leaves Central GO in the background. None of those events
-- may remove the driver from the queue or alter the driver's position.
--
-- Presence remains telemetry only. The queue is determined by the explicit
-- server-side driver status plus dispatch_queue_order stored in Postgres.

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
stable
security definer
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
    coalesce(d.dispatch_queue_updated_at,d.updated_at),
    s.last_seen_at
  from public.drivers d
  left join lateral (
    select ps.last_seen_at
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
      )
    )
  order by
    d.dispatch_queue_order asc,
    coalesce(d.dispatch_queue_updated_at,d.updated_at) asc,
    d.unit_number asc,
    d.id asc;
end;
$$;

revoke all on function public.centralgo_driver_queue_snapshot(uuid) from public,anon;
grant execute on function public.centralgo_driver_queue_snapshot(uuid) to authenticated,service_role;
