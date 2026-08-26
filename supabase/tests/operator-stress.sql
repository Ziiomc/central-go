\set ON_ERROR_STOP on

-- End-to-end operator stress test. Every write is rolled back so the same suite can
-- also be executed safely against an isolated or production-compatible database.
begin;

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
values('81111111-1111-4111-8111-111111111111','stress-operator@centralgo.test',now(),'{"name":"Operadora Estrés"}');

insert into public.companies(id,name,code,active)
values
  ('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Central Operadora Estrés','STRESS',true),
  ('8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Central Aislada Estrés','ISOLATED',true);

insert into public.company_memberships(company_id,user_id,role,active)
values('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','81111111-1111-4111-8111-111111111111','operator',true);

do $setup$
declare
  i integer;
  vehicle_id uuid;
  driver_id uuid;
begin
  for i in 1..12 loop
    vehicle_id:=md5('operator-stress-vehicle-'||i)::uuid;
    driver_id:=md5('operator-stress-driver-'||i)::uuid;
    insert into public.vehicles(id,company_id,unit_number,license_plate,brand,model,year,status)
    values(vehicle_id,'8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',format('S-%s',lpad(i::text,2,'0')),format('QA-%s',lpad(i::text,2,'0')),'Toyota','Yaris',2024,'active');
    insert into public.drivers(id,company_id,vehicle_id,unit_number,display_name,license_number,status,operation_mode,service_enabled)
    values(driver_id,'8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',vehicle_id,format('S-%s',lpad(i::text,2,'0')),format('Conductor estrés %s',i),format('LIC-STRESS-%s',i),'available','traditional',true);
  end loop;
end;
$setup$;

insert into public.trips(
  id,company_id,code,client_name,client_phone,origin_address,origin_lat,origin_lng,
  destination_address,destination_lat,destination_lng,status,operator_name,dispatch_mode
) values(
  '8ccccccc-cccc-4ccc-8ccc-cccccccccccc','8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ISOLATED-1',
  'Cliente aislado','+56900000999','Origen aislado',-35.84,-71.59,'Destino aislado',-35.85,-71.60,
  'pending','Otra central','manual'
);

set local role authenticated;
set local request.jwt.claim.sub='81111111-1111-4111-8111-111111111111';

do $stress$
declare
  i integer;
  driver_id uuid;
  request_id uuid;
  trip_row public.trips%rowtype;
begin
  -- 120 calls exercise create, radio assignment, intermediate states, completion,
  -- cancellation, unassignment, reassignment and idempotent client retries.
  for i in 1..120 loop
    driver_id:=md5('operator-stress-driver-'||(((i-1)%12)+1))::uuid;
    request_id:=md5('operator-stress-request-'||i)::uuid;

    select * into trip_row from public.centralgo_operator_create_trip(
      p_company_id=>'8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',p_operator_request_id=>request_id,
      p_client_id=>null,p_client_name=>format('Pasajero estrés %s',i),p_client_phone=>format('+569%08s',i),
      p_origin_address=>format('Origen estrés %s',i),p_origin_lat=>-35.8454,p_origin_lng=>-71.5979,p_origin_notes=>null,
      p_destination_address=>format('Destino estrés %s',i),p_destination_lat=>-35.8490,p_destination_lng=>-71.6030,p_destination_notes=>null,
      p_driver_id=>driver_id,p_vehicle_type_requested=>'standard',p_estimated_distance_km=>2.5,
      p_estimated_duration_mins=>8,p_estimated_fare=>5000+i,p_is_fixed_fare=>false,p_fixed_fare_amount=>null,
      p_payment_method=>'efectivo',p_notes=>format('STRESS_BATCH %s',i),p_scheduled_for=>null,p_dispatch_mode=>'manual'
    );

    if mod(i,5)=0 then
      perform public.centralgo_operator_cancel_trip(trip_row.id,'Cancelación controlada de estrés');
    else
      if mod(i,4)=0 then
        perform public.centralgo_operator_unassign_trip(trip_row.id,'Reasignación controlada de estrés');
        perform public.centralgo_operator_assign_trip(trip_row.id,driver_id);
      end if;
      perform public.centralgo_operator_set_trip_status(trip_row.id,'arrived');
      perform public.centralgo_operator_set_trip_status(trip_row.id,'in_progress');
      perform public.centralgo_complete_trip(trip_row.id,5000+i,'transferencia');
    end if;

    if mod(i,10)=0 then
      -- A retry with the same operation ID must return the original row, even
      -- after it has already completed or been cancelled.
      perform public.centralgo_operator_create_trip(
        p_company_id=>'8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',p_operator_request_id=>request_id,
        p_client_id=>null,p_client_name=>'Reintento idempotente',p_client_phone=>'+56911111111',
        p_origin_address=>'No debe duplicarse',p_origin_lat=>-35.8454,p_origin_lng=>-71.5979,p_origin_notes=>null,
        p_destination_address=>'No debe duplicarse',p_destination_lat=>-35.8490,p_destination_lng=>-71.6030,p_destination_notes=>null,
        p_driver_id=>driver_id,p_vehicle_type_requested=>'standard',p_estimated_distance_km=>1,
        p_estimated_duration_mins=>3,p_estimated_fare=>1,p_is_fixed_fare=>false,p_fixed_fare_amount=>null,
        p_payment_method=>'efectivo',p_notes=>'RETRY_SHOULD_NOT_REPLACE',p_scheduled_for=>null,p_dispatch_mode=>'manual'
      );
    end if;
  end loop;
end;
$stress$;

do $reservations$
declare
  i integer;
  driver_id uuid;
  trip_row public.trips%rowtype;
begin
  for i in 1..12 loop
    driver_id:=md5('operator-stress-driver-'||i)::uuid;
    select * into trip_row from public.centralgo_operator_create_trip(
      p_company_id=>'8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',p_operator_request_id=>md5('operator-stress-reservation-'||i)::uuid,
      p_client_id=>null,p_client_name=>format('Reserva estrés %s',i),p_client_phone=>'+56922222222',
      p_origin_address=>format('Retiro reserva %s',i),p_origin_lat=>-35.8454,p_origin_lng=>-71.5979,p_origin_notes=>null,
      p_destination_address=>'Destino reserva',p_destination_lat=>-35.8490,p_destination_lng=>-71.6030,p_destination_notes=>null,
      p_driver_id=>null,p_vehicle_type_requested=>'standard',p_estimated_distance_km=>3,p_estimated_duration_mins=>10,
      p_estimated_fare=>6500,p_is_fixed_fare=>false,p_fixed_fare_amount=>null,p_payment_method=>'efectivo',
      p_notes=>'STRESS_RESERVATION',p_scheduled_for=>now()+interval '30 minutes'+(i||' minutes')::interval,p_dispatch_mode=>'manual'
    );
    perform public.centralgo_operator_reserve_scheduled_trip(trip_row.id,driver_id);
  end loop;

  perform public.centralgo_operator_reserve_scheduled_trip(
    (select id from public.trips where operator_request_id=md5('operator-stress-reservation-12')::uuid),null
  );

  begin
    perform public.centralgo_operator_assign_trip(
      (select id from public.trips where operator_request_id=md5('operator-stress-reservation-1')::uuid),
      md5('operator-stress-driver-1')::uuid
    );
    raise exception 'STRESS FAIL: una reserva futura se despachó antes de la ventana';
  exception when sqlstate '55000' then null;
  end;
end;
$reservations$;

do $edge_cases$
declare
  active_trip public.trips%rowtype;
  pending_trip public.trips%rowtype;
begin
  select * into active_trip from public.centralgo_operator_create_trip(
    p_company_id=>'8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',p_operator_request_id=>md5('operator-stress-busy-a')::uuid,
    p_client_id=>null,p_client_name=>'Ocupado A',p_client_phone=>'+56933333331',
    p_origin_address=>'Origen ocupado A',p_origin_lat=>-35.8454,p_origin_lng=>-71.5979,p_origin_notes=>null,
    p_destination_address=>'Destino ocupado A',p_destination_lat=>-35.8490,p_destination_lng=>-71.6030,p_destination_notes=>null,
    p_driver_id=>md5('operator-stress-driver-1')::uuid,p_vehicle_type_requested=>'standard',p_estimated_distance_km=>2,
    p_estimated_duration_mins=>6,p_estimated_fare=>5000,p_is_fixed_fare=>false,p_fixed_fare_amount=>null,
    p_payment_method=>'efectivo',p_notes=>'STRESS_BUSY_A',p_scheduled_for=>null,p_dispatch_mode=>'manual'
  );
  select * into pending_trip from public.centralgo_operator_create_trip(
    p_company_id=>'8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',p_operator_request_id=>md5('operator-stress-busy-b')::uuid,
    p_client_id=>null,p_client_name=>'Ocupado B',p_client_phone=>'+56933333332',
    p_origin_address=>'Origen ocupado B',p_origin_lat=>-35.8454,p_origin_lng=>-71.5979,p_origin_notes=>null,
    p_destination_address=>'Destino ocupado B',p_destination_lat=>-35.8490,p_destination_lng=>-71.6030,p_destination_notes=>null,
    p_driver_id=>null,p_vehicle_type_requested=>'standard',p_estimated_distance_km=>2,
    p_estimated_duration_mins=>6,p_estimated_fare=>5000,p_is_fixed_fare=>false,p_fixed_fare_amount=>null,
    p_payment_method=>'efectivo',p_notes=>'STRESS_BUSY_B',p_scheduled_for=>null,p_dispatch_mode=>'manual'
  );

  begin
    perform public.centralgo_operator_assign_trip(pending_trip.id,md5('operator-stress-driver-1')::uuid);
    raise exception 'STRESS FAIL: un móvil recibió dos carreras activas';
  exception when sqlstate '55000' then null;
  end;

  perform public.centralgo_operator_cancel_trip(active_trip.id,'Libera móvil ocupado');
  perform public.centralgo_operator_assign_trip(pending_trip.id,md5('operator-stress-driver-1')::uuid);
  perform public.centralgo_operator_unassign_trip(pending_trip.id,'Retorno a pendientes');

  begin
    perform public.centralgo_operator_cancel_trip('8ccccccc-cccc-4ccc-8ccc-cccccccccccc','Intento entre centrales');
    raise exception 'STRESS FAIL: una operadora modificó otra central';
  exception when sqlstate '42501' then null;
  end;

  begin
    perform public.centralgo_operator_create_trip(
      p_company_id=>'8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',p_operator_request_id=>md5('operator-stress-bad-coordinates')::uuid,
      p_client_id=>null,p_client_name=>'Coordenadas inválidas',p_client_phone=>'+56944444444',
      p_origin_address=>'Origen inválido',p_origin_lat=>-135,p_origin_lng=>-71.5979,p_origin_notes=>null,
      p_destination_address=>'Destino inválido',p_destination_lat=>-35.8490,p_destination_lng=>-271,p_destination_notes=>null,
      p_driver_id=>null,p_vehicle_type_requested=>'standard',p_estimated_distance_km=>2,p_estimated_duration_mins=>6,
      p_estimated_fare=>5000,p_is_fixed_fare=>false,p_fixed_fare_amount=>null,p_payment_method=>'efectivo',
      p_notes=>'SHOULD_NOT_EXIST',p_scheduled_for=>null,p_dispatch_mode=>'manual'
    );
    raise exception 'STRESS FAIL: se aceptaron coordenadas fuera de rango';
  exception when sqlstate '22023' then null;
  end;
end;
$edge_cases$;

do $assertions$
declare
  expected_earnings numeric;
begin
  select sum(5000+i) into expected_earnings from generate_series(1,120) i where mod(i,5)<>0;

  if (select count(*) from public.trips where company_id='8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and notes like 'STRESS_BATCH%' and status='completed')<>96 then
    raise exception 'STRESS FAIL: cantidad de carreras completadas incorrecta';
  end if;
  if (select count(*) from public.trips where company_id='8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and notes like 'STRESS_BATCH%' and status='cancelled')<>24 then
    raise exception 'STRESS FAIL: cantidad de carreras canceladas incorrecta';
  end if;
  if exists(
    select operator_request_id from public.trips
    where company_id='8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and operator_request_id is not null
    group by operator_request_id having count(*)>1
  ) then
    raise exception 'STRESS FAIL: el reintento idempotente duplicó carreras';
  end if;
  if (select sum(total_trips_completed) from public.drivers where company_id='8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>96 then
    raise exception 'STRESS FAIL: el contador de viajes de conductores no coincide';
  end if;
  if (select sum(today_earnings) from public.drivers where company_id='8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>expected_earnings then
    raise exception 'STRESS FAIL: las ganancias se duplicaron o se perdieron';
  end if;
  if exists(
    select driver_id from public.trips
    where company_id='8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and status in ('assigned','en_route','arrived','in_progress') and driver_id is not null
    group by driver_id having count(*)>1
  ) then
    raise exception 'STRESS FAIL: un móvil terminó con más de una carrera activa';
  end if;
  if (select count(*) from public.trips where company_id='8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and notes='STRESS_RESERVATION' and status='pending')<>12 then
    raise exception 'STRESS FAIL: se perdió una reserva programada';
  end if;
  if (select count(*) from public.trips where company_id='8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and notes='STRESS_RESERVATION' and reserved_driver_id is not null)<>11 then
    raise exception 'STRESS FAIL: reserva o liberación de móvil inconsistente';
  end if;
  if not exists(
    select 1 from public.trips where operator_request_id=md5('operator-stress-busy-b')::uuid
      and status='pending' and driver_id is null and dispatch_mode='manual'
  ) then
    raise exception 'STRESS FAIL: desasignar no devolvió la carrera a pendientes';
  end if;
  if exists(select 1 from public.trips where notes='SHOULD_NOT_EXIST') then
    raise exception 'STRESS FAIL: persistió una carrera inválida';
  end if;
end;
$assertions$;

rollback;
