-- Make the critical dispatch lifecycle atomic and safe for radio-only drivers.

alter table public.trips
  add column if not exists operator_request_id uuid;

create unique index if not exists trips_company_operator_request_uidx
  on public.trips(company_id, operator_request_id)
  where operator_request_id is not null;

create or replace function public.centralgo_operator_assign_trip(p_trip_id uuid, p_driver_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = public
as $function$
declare
  t public.trips%rowtype;
  d public.drivers%rowtype;
  result_trip public.trips%rowtype;
  previous_driver uuid;
begin
  select * into t from public.trips where id=p_trip_id for update;
  if not found then raise exception 'Carrera no encontrada' using errcode='P0002'; end if;
  if not public.centralgo_has_company_role(t.company_id,array['company_admin','operator']::public.centralgo_company_role[]) then
    raise exception 'Sin permiso para despachar esta central' using errcode='42501';
  end if;
  if t.status in ('completed','cancelled','in_progress') then
    raise exception 'La carrera ya no puede asignarse' using errcode='55000';
  end if;
  if t.scheduled_for is not null and t.scheduled_for > now()+interval '10 minutes' then
    raise exception 'La carrera está agendada para más adelante' using errcode='55000';
  end if;

  select * into d from public.drivers where id=p_driver_id for update;
  if not found or d.company_id<>t.company_id then
    raise exception 'Móvil inválido para esta central' using errcode='22023';
  end if;
  if t.client_id is not null and exists(
    select 1 from public.client_driver_blocks b
    where b.company_id=t.company_id and b.client_id=t.client_id and b.driver_id=d.id and b.active
  ) then
    raise exception 'Este cliente tiene registrado que rechaza este móvil' using errcode='55000';
  end if;
  if d.status<>'available' and t.driver_id is distinct from d.id then
    raise exception 'El móvil no está disponible' using errcode='55000';
  end if;
  if d.operation_mode <> 'traditional' and not exists (
    select 1 from public.driver_presence_sessions s
    where s.driver_id=d.id and s.ended_at is null and s.last_seen_at > now()-interval '4 minutes'
  ) then
    raise exception 'El móvil figura disponible, pero su app no está conectada. Pídele al conductor abrir Central GO y vuelve a intentar.' using errcode='55000';
  end if;
  if exists(
    select 1 from public.trips x
    where x.driver_id=d.id and x.id<>t.id and x.status in ('assigned','en_route','arrived','in_progress')
  ) then
    raise exception 'El móvil ya tiene una carrera activa' using errcode='55000';
  end if;

  previous_driver:=t.driver_id;
  if previous_driver is not null and previous_driver<>d.id then
    update public.drivers set status='available' where id=previous_driver;
  end if;

  if d.operation_mode='traditional' then
    update public.trips
    set driver_id=d.id,
        driver_unit_number=d.unit_number,
        driver_name=d.display_name,
        status='en_route',
        assigned_at=coalesce(assigned_at,now()),
        en_route_at=coalesce(en_route_at,now()),
        offer_expires_at=null,
        dispatch_mode='manual',
        reserved_driver_id=null,
        reserved_driver_unit_number=null,
        reserved_driver_name=null,
        reservation_reason=null,
        version=version+1
    where id=t.id
    returning * into result_trip;

    update public.drivers set status='en_route' where id=d.id;
    perform public.centralgo_write_audit(
      t.company_id,
      'ASIGNACION_TRADICIONAL_CONFIRMADA',
      format('La operadora confirmó por radio o teléfono la carrera %s para el móvil %s',t.code,d.unit_number),
      jsonb_build_object('tripId',t.id,'driverId',d.id,'operationMode','traditional')
    );
    return result_trip;
  end if;

  update public.trips set
    status='pending',driver_id=null,driver_unit_number=null,driver_name=null,offer_expires_at=null,
    dispatch_mode='manual',reserved_driver_id=null,reserved_driver_unit_number=null,reserved_driver_name=null,reservation_reason=null
  where id=t.id;

  result_trip:=public.centralgo_internal_assign_offer(t.id,d.id,'Asignación manual de operadora');
  return result_trip;
end;
$function$;

create or replace function public.centralgo_operator_create_trip(
  p_company_id uuid,
  p_operator_request_id uuid,
  p_client_id uuid,
  p_client_name text,
  p_client_phone text,
  p_origin_address text,
  p_origin_lat double precision,
  p_origin_lng double precision,
  p_origin_notes text,
  p_destination_address text,
  p_destination_lat double precision,
  p_destination_lng double precision,
  p_destination_notes text,
  p_driver_id uuid,
  p_vehicle_type_requested text,
  p_estimated_distance_km numeric,
  p_estimated_duration_mins integer,
  p_estimated_fare numeric,
  p_is_fixed_fare boolean,
  p_fixed_fare_amount numeric,
  p_payment_method public.centralgo_payment_method,
  p_notes text,
  p_scheduled_for timestamptz,
  p_dispatch_mode text
)
returns public.trips
language plpgsql
security definer
set search_path = public
as $function$
declare
  company_row public.companies%rowtype;
  actor_name text;
  generated_code text;
  result_trip public.trips%rowtype;
begin
  if auth.uid() is null or not public.centralgo_has_company_role(
    p_company_id,array['company_admin','operator']::public.centralgo_company_role[]
  ) then
    raise exception 'Sin permiso para crear carreras en esta central' using errcode='42501';
  end if;
  if p_operator_request_id is null then
    raise exception 'Identificador de operación obligatorio' using errcode='22023';
  end if;

  select * into result_trip
  from public.trips
  where company_id=p_company_id and operator_request_id=p_operator_request_id;
  if found then return result_trip; end if;

  select * into company_row from public.companies where id=p_company_id and active for share;
  if not found then raise exception 'Central no disponible' using errcode='55000'; end if;
  if p_client_id is not null and not exists(
    select 1 from public.clients where id=p_client_id and company_id=p_company_id
  ) then
    raise exception 'Cliente inválido para esta central' using errcode='22023';
  end if;
  if nullif(trim(coalesce(p_origin_address,'')),'') is null then
    raise exception 'La dirección de retiro es obligatoria' using errcode='22023';
  end if;
  if p_origin_lat not between -90 and 90 or p_destination_lat not between -90 and 90
     or p_origin_lng not between -180 and 180 or p_destination_lng not between -180 and 180 then
    raise exception 'Coordenadas fuera de rango' using errcode='22023';
  end if;
  if coalesce(p_estimated_fare,0)<0 or coalesce(p_estimated_distance_km,0)<0 or coalesce(p_estimated_duration_mins,0)<0 then
    raise exception 'Distancia, duración o tarifa inválida' using errcode='22023';
  end if;
  if coalesce(p_dispatch_mode,'automatic') not in ('automatic','manual') then
    raise exception 'Modo de despacho inválido' using errcode='22023';
  end if;

  select coalesce(nullif(trim(name),''),'Operadora Central GO') into actor_name
  from public.profiles where id=auth.uid();

  loop
    generated_code:=upper(company_row.code)||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    exit when not exists(select 1 from public.trips where company_id=p_company_id and code=generated_code);
  end loop;

  insert into public.trips(
    company_id,code,operator_request_id,client_id,client_name,client_phone,
    origin_address,origin_lat,origin_lng,origin_notes,
    destination_address,destination_lat,destination_lng,destination_notes,
    status,operator_user_id,operator_name,vehicle_type_requested,
    estimated_distance_km,estimated_duration_mins,estimated_fare,
    is_fixed_fare,fixed_fare_amount,payment_method,notes,scheduled_for,dispatch_mode
  ) values (
    p_company_id,generated_code,p_operator_request_id,p_client_id,
    coalesce(nullif(trim(p_client_name),''),'Cliente Particular'),
    coalesce(nullif(trim(p_client_phone),''),'Sin teléfono'),
    trim(p_origin_address),p_origin_lat,p_origin_lng,nullif(trim(coalesce(p_origin_notes,'')),''),
    coalesce(nullif(trim(p_destination_address),''),'A convenir'),
    p_destination_lat,p_destination_lng,nullif(trim(coalesce(p_destination_notes,'')),''),
    'pending',auth.uid(),coalesce(actor_name,'Operadora Central GO'),p_vehicle_type_requested,
    coalesce(p_estimated_distance_km,0),coalesce(p_estimated_duration_mins,0),coalesce(p_estimated_fare,0),
    coalesce(p_is_fixed_fare,false),p_fixed_fare_amount,coalesce(p_payment_method,'efectivo'),
    nullif(trim(coalesce(p_notes,'')),''),p_scheduled_for,
    case when p_driver_id is not null then 'manual' else coalesce(p_dispatch_mode,'automatic') end
  ) returning * into result_trip;

  if p_driver_id is not null then
    result_trip:=public.centralgo_operator_assign_trip(result_trip.id,p_driver_id);
  else
    select * into result_trip from public.trips where id=result_trip.id;
  end if;
  return result_trip;
exception
  when unique_violation then
    select * into result_trip
    from public.trips
    where company_id=p_company_id and operator_request_id=p_operator_request_id;
    if found then return result_trip; end if;
    raise;
end;
$function$;

create or replace function public.centralgo_complete_trip(
  p_trip_id uuid,
  p_final_fare numeric,
  p_payment_method public.centralgo_payment_method
)
returns public.trips
language plpgsql
security definer
set search_path = public
as $function$
declare
  t public.trips%rowtype;
  own_driver uuid;
  caller_is_operator boolean;
  result_trip public.trips%rowtype;
  next_trip_id uuid;
begin
  select * into t from public.trips where id=p_trip_id for update;
  if not found then raise exception 'Carrera no encontrada' using errcode='P0002'; end if;

  own_driver:=public.centralgo_driver_id_for_user(t.company_id);
  caller_is_operator:=public.centralgo_has_company_role(
    t.company_id,array['company_admin','operator']::public.centralgo_company_role[]
  );
  if not caller_is_operator and (own_driver is null or t.driver_id is distinct from own_driver) then
    raise exception 'Sin permiso para finalizar esta carrera' using errcode='42501';
  end if;
  if t.status='completed' then return t; end if;
  if t.status<>'in_progress' then
    raise exception 'La carrera debe estar en curso antes de finalizarla' using errcode='55000';
  end if;
  if p_final_fare is null or p_final_fare<0 or p_final_fare>100000000 then
    raise exception 'Monto final inválido' using errcode='22023';
  end if;
  if p_payment_method is null then
    raise exception 'Medio de pago obligatorio' using errcode='22023';
  end if;

  update public.trips
  set status='completed',
      completed_at=coalesce(completed_at,now()),
      final_fare=round(p_final_fare,2),
      payment_method=p_payment_method,
      offer_expires_at=null,
      version=version+1
  where id=t.id and status='in_progress'
  returning * into result_trip;

  if result_trip.id is null then
    select * into result_trip from public.trips where id=t.id;
    return result_trip;
  end if;

  update public.drivers
  set status='available',
      total_trips_completed=total_trips_completed+1,
      today_earnings=today_earnings+result_trip.final_fare
  where id=t.driver_id;

  perform public.centralgo_write_audit(
    t.company_id,
    'FINALIZAR_VIAJE',
    format('Finalizó %s por $%s mediante %s',t.code,result_trip.final_fare,p_payment_method::text),
    jsonb_build_object('tripId',t.id,'driverId',t.driver_id,'finalFare',result_trip.final_fare,'paymentMethod',p_payment_method)
  );

  select id into next_trip_id
  from public.trips
  where status='pending' and dispatch_mode='automatic' and reserved_driver_id=t.driver_id
    and (scheduled_for is null or scheduled_for<=now()+interval '2 minutes')
  order by coalesce(scheduled_for,created_at)
  limit 1;
  if next_trip_id is not null then perform public.centralgo_internal_dispatch_trip(next_trip_id); end if;

  return result_trip;
end;
$function$;

revoke all on function public.centralgo_operator_assign_trip(uuid,uuid) from public,anon;
grant execute on function public.centralgo_operator_assign_trip(uuid,uuid) to authenticated,service_role;

revoke all on function public.centralgo_operator_create_trip(
  uuid,uuid,uuid,text,text,text,double precision,double precision,text,text,double precision,double precision,text,
  uuid,text,numeric,integer,numeric,boolean,numeric,public.centralgo_payment_method,text,timestamptz,text
) from public,anon;
grant execute on function public.centralgo_operator_create_trip(
  uuid,uuid,uuid,text,text,text,double precision,double precision,text,text,double precision,double precision,text,
  uuid,text,numeric,integer,numeric,boolean,numeric,public.centralgo_payment_method,text,timestamptz,text
) to authenticated,service_role;

revoke all on function public.centralgo_complete_trip(uuid,numeric,public.centralgo_payment_method) from public,anon;
grant execute on function public.centralgo_complete_trip(uuid,numeric,public.centralgo_payment_method) to authenticated,service_role;
