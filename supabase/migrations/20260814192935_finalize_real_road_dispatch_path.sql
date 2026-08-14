create index if not exists trip_driver_route_metrics_driver_idx
  on public.trip_driver_route_metrics(driver_id);

create or replace function public.centralgo_operator_auto_dispatch_trip(p_trip_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.trips%rowtype;
  queued boolean;
begin
  select * into t from public.trips where id=p_trip_id for update;
  if not found then raise exception 'Carrera no encontrada' using errcode='P0002'; end if;
  if not public.centralgo_has_company_role(t.company_id,array['company_admin','operator']::public.centralgo_company_role[]) then
    raise exception 'Sin permiso para despachar esta central' using errcode='42501';
  end if;
  if t.status <> 'pending' then return t; end if;

  update public.trips
  set dispatch_mode='automatic',
      reserved_driver_id=null,
      reserved_driver_unit_number=null,
      reserved_driver_name=null,
      reservation_reason=null
  where id=t.id
  returning * into t;

  delete from public.trip_driver_route_metrics where trip_id=t.id;
  queued := public.centralgo_enqueue_dispatch_routing(t.id);

  select * into t from public.trips where id=p_trip_id;
  return t;
end;
$$;

revoke all on function public.centralgo_operator_auto_dispatch_trip(uuid) from public, anon;
grant execute on function public.centralgo_operator_auto_dispatch_trip(uuid) to authenticated, service_role;
