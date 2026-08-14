alter table public.drivers
  add column if not exists dispatch_queue_order bigint not null default 0,
  add column if not exists dispatch_queue_updated_at timestamptz not null default now();

with ranked as (
  select id,
         row_number() over (
           partition by company_id
           order by created_at asc, unit_number asc, id asc
         )::bigint as rn
  from public.drivers
)
update public.drivers d
set dispatch_queue_order = ranked.rn,
    dispatch_queue_updated_at = now()
from ranked
where ranked.id = d.id
  and d.dispatch_queue_order <= 0;

create index if not exists drivers_company_dispatch_queue_idx
  on public.drivers(company_id, dispatch_queue_order, status);

create or replace function public.centralgo_dispatch_map_km(
  p_lat1 double precision,
  p_lng1 double precision,
  p_lat2 double precision,
  p_lng2 double precision
)
returns double precision
language sql
immutable
set search_path = public
as $$
  select case
    when p_lat1 is null or p_lng1 is null or p_lat2 is null or p_lng2 is null then null
    else round((public.centralgo_km_distance(p_lat1,p_lng1,p_lat2,p_lng2) * 1.22)::numeric, 3)::double precision
  end;
$$;

revoke all on function public.centralgo_dispatch_map_km(double precision,double precision,double precision,double precision) from public, anon;
grant execute on function public.centralgo_dispatch_map_km(double precision,double precision,double precision,double precision) to authenticated, service_role;

create or replace function public.centralgo_driver_queue_order_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.dispatch_queue_order,0) <= 0 then
    select coalesce(max(d.dispatch_queue_order),0)+1
      into new.dispatch_queue_order
    from public.drivers d
    where d.company_id = new.company_id;
  end if;
  new.dispatch_queue_updated_at := now();
  return new;
end;
$$;

revoke all on function public.centralgo_driver_queue_order_before_insert() from public, anon, authenticated;

drop trigger if exists centralgo_driver_queue_order_before_insert on public.drivers;
create trigger centralgo_driver_queue_order_before_insert
before insert on public.drivers
for each row execute function public.centralgo_driver_queue_order_before_insert();

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
begin
  select * into current_driver
  from public.drivers
  where id = p_driver_id
  for update;

  if not found then
    raise exception 'Móvil no encontrado' using errcode='P0002';
  end if;

  if not public.centralgo_has_company_role(
    current_driver.company_id,
    array['company_admin','operator']::public.centralgo_company_role[]
  ) then
    raise exception 'Sin permiso para modificar la prioridad de esta central' using errcode='42501';
  end if;

  if p_direction not in ('up','down') then
    raise exception 'Dirección de prioridad inválida' using errcode='22023';
  end if;

  if p_direction='up' then
    select * into neighbor
    from public.drivers d
    where d.company_id=current_driver.company_id
      and d.id<>current_driver.id
      and d.status not in ('offline','sos')
      and d.dispatch_queue_order < current_driver.dispatch_queue_order
    order by d.dispatch_queue_order desc
    limit 1
    for update;
  else
    select * into neighbor
    from public.drivers d
    where d.company_id=current_driver.company_id
      and d.id<>current_driver.id
      and d.status not in ('offline','sos')
      and d.dispatch_queue_order > current_driver.dispatch_queue_order
    order by d.dispatch_queue_order asc
    limit 1
    for update;
  end if;

  if neighbor.id is null then
    return query select current_driver.id,current_driver.dispatch_queue_order;
    return;
  end if;

  temp_order := current_driver.dispatch_queue_order;
  update public.drivers
    set dispatch_queue_order=neighbor.dispatch_queue_order,
        dispatch_queue_updated_at=now()
    where id=current_driver.id;
  update public.drivers
    set dispatch_queue_order=temp_order,
        dispatch_queue_updated_at=now()
    where id=neighbor.id;

  return query
  select d.id,d.dispatch_queue_order
  from public.drivers d
  where d.id=current_driver.id;
end;
$$;

revoke all on function public.centralgo_operator_move_driver_priority(uuid,text) from public, anon;
grant execute on function public.centralgo_operator_move_driver_priority(uuid,text) to authenticated, service_role;

create or replace function public.centralgo_internal_assign_offer(
  p_trip_id uuid,
  p_driver_id uuid,
  p_reason text default 'Despacho automático'::text
)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.trips%rowtype;
  d public.drivers%rowtype;
  v public.vehicles%rowtype;
  result_trip public.trips%rowtype;
begin
  select * into t from public.trips where id=p_trip_id for update;
  if not found or t.status<>'pending' then return t; end if;
  if t.scheduled_for is not null and t.scheduled_for>now()+interval '2 minutes' then return t; end if;

  select * into d from public.drivers where id=p_driver_id for update;
  if not found or d.company_id<>t.company_id or d.status<>'available' or d.sos_active then return t; end if;
  if d.id=any(coalesce(t.offered_driver_ids,'{}'::uuid[])) then return t; end if;
  if t.client_id is not null and exists(
    select 1 from public.client_driver_blocks b
    where b.company_id=t.company_id and b.client_id=t.client_id and b.driver_id=d.id and b.active
  ) then return t; end if;
  if exists(
    select 1 from public.trips x
    where x.driver_id=d.id and x.id<>t.id and x.status in ('assigned','en_route','arrived','in_progress')
  ) then return t; end if;

  if d.vehicle_id is not null then select * into v from public.vehicles where id=d.vehicle_id; end if;

  update public.trips set
    driver_id=d.id,
    driver_unit_number=d.unit_number,
    driver_name=d.display_name,
    vehicle_id=d.vehicle_id,
    vehicle_unit_number=coalesce(v.unit_number,d.unit_number),
    vehicle_plate=v.license_plate,
    reserved_driver_id=null,
    reserved_driver_unit_number=null,
    reserved_driver_name=null,
    reservation_reason=null,
    status='assigned',
    assigned_at=now(),
    offer_expires_at=now()+interval '15 seconds',
    offer_attempt=offer_attempt+1,
    en_route_at=null,
    arrived_at=null,
    started_at=null,
    version=version+1
  where id=t.id
  returning * into result_trip;

  update public.drivers
  set status='en_route'
  where id=d.id;

  insert into public.trip_dispatch_events(company_id,trip_id,driver_id,event_type,reason,created_by)
  values(t.company_id,t.id,d.id,'offered',p_reason,auth.uid());

  if d.user_id is not null then
    insert into public.notifications(company_id,recipient_user_id,title,message,type,read,related_id)
    values(
      t.company_id,
      d.user_id,
      'NUEVA CARRERA',
      concat('Retiro: ',t.origin_address,' → ',t.destination_address,'. Tienes 15 segundos para aceptar.'),
      'trip',false,t.id
    );
  end if;

  return result_trip;
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

  if t.scheduled_for is not null and t.scheduled_for>now()+interval '2 minutes' then
    return t;
  end if;

  select candidate.driver_id, candidate.map_km
    into selected_driver_id, selected_distance
  from (
    select d.id as driver_id,
           coalesce(public.centralgo_dispatch_map_km(l.lat,l.lng,t.origin_lat,t.origin_lng),9999) as map_km,
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
        when selected_distance < 3 then format('Prioridad híbrida: móvil en zona cercana (<3 km mapa), turno %s',free_driver.dispatch_queue_order)
        when selected_distance <= 5 then format('Prioridad híbrida: móvil dentro de 5 km mapa, turno %s',free_driver.dispatch_queue_order)
        else format('Sin móviles en 5 km: móvil más cercano por mapa (%s km) con equidad de cola',round(selected_distance::numeric,1))
      end
    );
  end if;

  return t;
end;
$$;

create or replace function public.centralgo_driver_transition_trip(
  p_trip_id uuid,
  p_new_status public.centralgo_trip_status
)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.trips%rowtype;
  own_driver uuid;
  result_trip public.trips%rowtype;
  next_trip record;
  next_queue_order bigint;
begin
  select * into t from public.trips where id=p_trip_id for update;
  if not found then raise exception 'Carrera no encontrada' using errcode='P0002'; end if;

  own_driver:=public.centralgo_driver_id_for_user(t.company_id);
  if own_driver is null or t.driver_id is distinct from own_driver then
    raise exception 'Esta carrera no pertenece al conductor autenticado' using errcode='42501';
  end if;

  if not (
    (t.status='assigned' and p_new_status='en_route') or
    (t.status='en_route' and p_new_status='arrived') or
    (t.status='arrived' and p_new_status='in_progress') or
    (t.status='in_progress' and p_new_status='completed')
  ) then
    raise exception 'Transición de carrera inválida: % -> %',t.status,p_new_status using errcode='22023';
  end if;

  if t.status='assigned' and p_new_status='en_route'
     and t.offer_expires_at is not null and t.offer_expires_at < now() then
    raise exception 'La oferta ya venció y será reasignada' using errcode='55000';
  end if;

  update public.trips set
    status=p_new_status,
    offer_expires_at=case when p_new_status='en_route' then null else offer_expires_at end,
    en_route_at=case when p_new_status='en_route' then coalesce(en_route_at,now()) else en_route_at end,
    arrived_at=case when p_new_status='arrived' then coalesce(arrived_at,now()) else arrived_at end,
    started_at=case when p_new_status='in_progress' then coalesce(started_at,now()) else started_at end,
    completed_at=case when p_new_status='completed' then coalesce(completed_at,now()) else completed_at end,
    final_fare=case when p_new_status='completed' then coalesce(final_fare,estimated_fare) else final_fare end,
    version=version+1
  where id=t.id
  returning * into result_trip;

  if t.status='assigned' and p_new_status='en_route' then
    select coalesce(max(d.dispatch_queue_order),0)+1
      into next_queue_order
    from public.drivers d
    where d.company_id=t.company_id;

    update public.drivers
    set status='en_route',
        dispatch_queue_order=next_queue_order,
        dispatch_queue_updated_at=now()
    where id=own_driver;
  else
    update public.drivers set
      status=case
        when p_new_status in ('en_route','arrived') then 'en_route'::public.centralgo_driver_status
        when p_new_status='in_progress' then 'in_trip'::public.centralgo_driver_status
        when p_new_status='completed' then 'available'::public.centralgo_driver_status
        else status
      end,
      total_trips_completed=case when p_new_status='completed' then total_trips_completed+1 else total_trips_completed end,
      today_earnings=case when p_new_status='completed' then today_earnings+coalesce(result_trip.final_fare,result_trip.estimated_fare) else today_earnings end
    where id=own_driver;
  end if;

  if p_new_status='completed' then
    select id into next_trip
    from public.trips
    where status='pending' and dispatch_mode='automatic' and reserved_driver_id=own_driver
      and (scheduled_for is null or scheduled_for<=now()+interval '2 minutes')
    order by coalesce(scheduled_for,created_at)
    limit 1;
    if found then perform public.centralgo_internal_dispatch_trip(next_trip.id); end if;
  end if;

  return result_trip;
end;
$$;

revoke all on function public.centralgo_driver_transition_trip(uuid,public.centralgo_trip_status) from public, anon;
grant execute on function public.centralgo_driver_transition_trip(uuid,public.centralgo_trip_status) to authenticated, service_role;
