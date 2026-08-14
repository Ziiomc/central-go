create table if not exists public.trip_driver_route_metrics (
  trip_id uuid not null references public.trips(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  distance_km numeric(10,3) not null,
  duration_seconds integer,
  provider text not null default 'osrm',
  location_recorded_at timestamptz,
  computed_at timestamptz not null default now(),
  primary key (trip_id, driver_id)
);

create index if not exists trip_driver_route_metrics_company_trip_idx
  on public.trip_driver_route_metrics(company_id, trip_id, computed_at desc);

alter table public.trip_driver_route_metrics enable row level security;
revoke all on table public.trip_driver_route_metrics from anon, authenticated;
grant all on table public.trip_driver_route_metrics to service_role;

alter table public.trips
  add column if not exists routing_provider text,
  add column if not exists routing_computed_at timestamptz,
  add column if not exists routing_is_fallback boolean not null default true;

create or replace function public.centralgo_enqueue_dispatch_routing(p_trip_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  secret_value text;
  request_id bigint;
begin
  if not exists(
    select 1 from public.trips t
    where t.id=p_trip_id and t.status='pending' and t.dispatch_mode='automatic'
  ) then return false; end if;

  select value into secret_value
  from public.centralgo_private_settings
  where key='push_internal_secret';

  if secret_value is null then
    perform public.centralgo_internal_dispatch_trip(p_trip_id);
    return false;
  end if;

  select net.http_post(
    url := 'https://cuazdzsvgwrnpczbvrgx.supabase.co/functions/v1/route-dispatch-matrix',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-centralgo-routing-secret',secret_value
    ),
    body := jsonb_build_object('tripId',p_trip_id),
    timeout_milliseconds := 3500
  ) into request_id;
  return request_id is not null;
exception when others then
  perform public.centralgo_internal_dispatch_trip(p_trip_id);
  return false;
end;
$$;

revoke all on function public.centralgo_enqueue_dispatch_routing(uuid) from public, anon, authenticated;
grant execute on function public.centralgo_enqueue_dispatch_routing(uuid) to service_role;

create or replace function public.centralgo_trip_auto_dispatch_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status='pending' and new.dispatch_mode='automatic' and new.driver_id is null then
    perform public.centralgo_enqueue_dispatch_routing(new.id);
  end if;
  return new;
end;
$$;

create or replace function public.centralgo_internal_dispatch_trip(p_trip_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.trips%rowtype;
  reserved public.drivers%rowtype;
  free_driver public.drivers%rowtype;
  selected_driver_id uuid;
  selected_distance double precision;
  selected_provider text;
begin
  select * into t from public.trips where id=p_trip_id for update;
  if not found or t.status<>'pending' or t.dispatch_mode<>'automatic' then return t; end if;

  if t.reserved_driver_id is not null then
    select * into reserved from public.drivers where id=t.reserved_driver_id;
    if found and reserved.status='available' and not reserved.sos_active
       and (t.scheduled_for is null or t.scheduled_for<=now()+interval '2 minutes') then
      return public.centralgo_internal_assign_offer(t.id,reserved.id,'Móvil reservado liberado para el retiro');
    elsif not found or reserved.status in ('paused','offline','sos') then
      update public.trips
      set reserved_driver_id=null,reserved_driver_unit_number=null,reserved_driver_name=null,reservation_reason=null
      where id=t.id returning * into t;
    end if;
  end if;

  if t.scheduled_for is not null and t.scheduled_for>now()+interval '2 minutes' then return t; end if;

  select candidate.driver_id, candidate.map_km, candidate.provider
    into selected_driver_id, selected_distance, selected_provider
  from (
    select d.id as driver_id,
           coalesce(
             (select m.distance_km::double precision
              from public.trip_driver_route_metrics m
              where m.trip_id=t.id and m.driver_id=d.id
                and m.computed_at > now()-interval '45 seconds'
              order by m.computed_at desc limit 1),
             public.centralgo_dispatch_map_km(l.lat,l.lng,t.origin_lat,t.origin_lng),
             9999
           ) as map_km,
           case when exists(
             select 1 from public.trip_driver_route_metrics m
             where m.trip_id=t.id and m.driver_id=d.id
               and m.computed_at > now()-interval '45 seconds'
           ) then 'ruta vial real' else 'estimación GPS' end as provider,
           d.dispatch_queue_order
    from public.drivers d
    left join public.driver_locations l on l.driver_id=d.id
    where d.company_id=t.company_id
      and d.status='available'
      and not d.sos_active
      and not(d.id=any(coalesce(t.offered_driver_ids,'{}'::uuid[])))
      and not exists(
        select 1 from public.trips x
        where x.driver_id=d.id and x.status in ('assigned','en_route','arrived','in_progress')
      )
      and (
        t.client_id is null or not exists(
          select 1 from public.client_driver_blocks b
          where b.company_id=t.company_id and b.client_id=t.client_id and b.driver_id=d.id and b.active
        )
      )
  ) candidate
  order by
    case when candidate.map_km < 3 then 0 when candidate.map_km <= 5 then 1 else 2 end,
    case when candidate.map_km <= 5 then candidate.dispatch_queue_order::double precision else floor(candidate.map_km*2)/2 end,
    case when candidate.map_km <= 5 then candidate.map_km else candidate.dispatch_queue_order::double precision end,
    candidate.map_km
  limit 1;

  if selected_driver_id is not null then
    select * into free_driver from public.drivers where id=selected_driver_id;
    return public.centralgo_internal_assign_offer(
      t.id,
      free_driver.id,
      case
        when selected_distance < 3 then format('Prioridad híbrida: móvil en zona cercana (<3 km por %s), turno %s',selected_provider,free_driver.dispatch_queue_order)
        when selected_distance <= 5 then format('Prioridad híbrida: móvil dentro de 5 km por %s, turno %s',selected_provider,free_driver.dispatch_queue_order)
        else format('Sin móviles en 5 km: móvil más cercano por %s (%s km), con equidad de cola',selected_provider,round(selected_distance::numeric,1))
      end
    );
  end if;

  return t;
end;
$$;

create or replace function public.centralgo_operator_route_metrics(p_trip_id uuid)
returns table(driver_id uuid, distance_km numeric, duration_seconds integer, provider text, computed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare target_company uuid;
begin
  select company_id into target_company from public.trips where id=p_trip_id;
  if target_company is null then raise exception 'Carrera no encontrada' using errcode='P0002'; end if;
  if not public.centralgo_has_company_role(target_company,array['company_admin','operator']::public.centralgo_company_role[]) then
    raise exception 'Sin permiso para consultar distancias de esta central' using errcode='42501';
  end if;
  return query
  select m.driver_id,m.distance_km,m.duration_seconds,m.provider,m.computed_at
  from public.trip_driver_route_metrics m
  where m.trip_id=p_trip_id and m.computed_at>now()-interval '2 minutes';
end;
$$;

revoke all on function public.centralgo_operator_route_metrics(uuid) from public, anon;
grant execute on function public.centralgo_operator_route_metrics(uuid) to authenticated, service_role;

create or replace function public.centralgo_operator_refresh_route_matrix(p_trip_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare target_company uuid;
begin
  select company_id into target_company from public.trips where id=p_trip_id and status='pending';
  if target_company is null then return false; end if;
  if not public.centralgo_has_company_role(target_company,array['company_admin','operator']::public.centralgo_company_role[]) then
    raise exception 'Sin permiso para recalcular rutas de esta central' using errcode='42501';
  end if;
  return public.centralgo_enqueue_dispatch_routing(p_trip_id);
end;
$$;

revoke all on function public.centralgo_operator_refresh_route_matrix(uuid) from public, anon;
grant execute on function public.centralgo_operator_refresh_route_matrix(uuid) to authenticated, service_role;
