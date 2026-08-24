\set ON_ERROR_STOP on

begin;

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
values('71111111-1111-4111-8111-111111111111','critical-operator@centralgo.test',now(),'{"name":"Operadora Crítica"}');
insert into public.companies(id,name,code,active)
values('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Central Operaciones Críticas','CRIT',true);
insert into public.company_memberships(company_id,user_id,role,active)
values('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','71111111-1111-4111-8111-111111111111','operator',true);
insert into public.vehicles(id,company_id,unit_number,license_plate,brand,model,year,status)
values('72222222-2222-4222-8222-222222222222','7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','R-17','TEST-R17','Toyota','Yaris',2022,'active');
insert into public.drivers(id,company_id,vehicle_id,unit_number,display_name,license_number,status,operation_mode,service_enabled)
values('73333333-3333-4333-8333-333333333333','7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','72222222-2222-4222-8222-222222222222','R-17','Conductor por radio','LIC-R17','available','traditional',true);

set local role authenticated;
set local request.jwt.claim.sub='71111111-1111-4111-8111-111111111111';

select id from public.centralgo_operator_create_trip(
  p_company_id=>'7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',p_operator_request_id=>'74444444-4444-4444-8444-444444444444',
  p_client_id=>null,p_client_name=>'Pasajera QA',p_client_phone=>'+56900000000',
  p_origin_address=>'Plaza de Armas 1',p_origin_lat=>-35.8454,p_origin_lng=>-71.5979,p_origin_notes=>null,
  p_destination_address=>'Hospital de Linares',p_destination_lat=>-35.8490,p_destination_lng=>-71.6030,p_destination_notes=>null,
  p_driver_id=>'73333333-3333-4333-8333-333333333333',p_vehicle_type_requested=>'standard',
  p_estimated_distance_km=>2.5,p_estimated_duration_mins=>8,p_estimated_fare=>5000,
  p_is_fixed_fare=>false,p_fixed_fare_amount=>null,p_payment_method=>'efectivo',
  p_notes=>'Prueba de operación crítica',p_scheduled_for=>null,p_dispatch_mode=>'manual'
);

do $$ begin
  if not exists(select 1 from public.trips where operator_request_id='74444444-4444-4444-8444-444444444444' and status='en_route'
    and driver_id='73333333-3333-4333-8333-333333333333' and offer_expires_at is null and dispatch_mode='manual') then
    raise exception 'CRITICAL TEST FAIL: asignación tradicional con vencimiento o estado incorrecto';
  end if;
end $$;

select id from public.centralgo_operator_create_trip(
  p_company_id=>'7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',p_operator_request_id=>'74444444-4444-4444-8444-444444444444',
  p_client_id=>null,p_client_name=>'Pasajera QA',p_client_phone=>'+56900000000',
  p_origin_address=>'Plaza de Armas 1',p_origin_lat=>-35.8454,p_origin_lng=>-71.5979,p_origin_notes=>null,
  p_destination_address=>'Hospital de Linares',p_destination_lat=>-35.8490,p_destination_lng=>-71.6030,p_destination_notes=>null,
  p_driver_id=>'73333333-3333-4333-8333-333333333333',p_vehicle_type_requested=>'standard',
  p_estimated_distance_km=>2.5,p_estimated_duration_mins=>8,p_estimated_fare=>5000,
  p_is_fixed_fare=>false,p_fixed_fare_amount=>null,p_payment_method=>'efectivo',
  p_notes=>'Prueba de operación crítica',p_scheduled_for=>null,p_dispatch_mode=>'manual'
);

do $$ begin
  if (select count(*) from public.trips where company_id='7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and operator_request_id='74444444-4444-4444-8444-444444444444')<>1 then
    raise exception 'CRITICAL TEST FAIL: el reintento duplicó la carrera';
  end if;
end $$;

select public.centralgo_operator_set_trip_status((select id from public.trips where operator_request_id='74444444-4444-4444-8444-444444444444'),'in_progress');
select public.centralgo_complete_trip((select id from public.trips where operator_request_id='74444444-4444-4444-8444-444444444444'),7650,'transferencia');
select public.centralgo_complete_trip((select id from public.trips where operator_request_id='74444444-4444-4444-8444-444444444444'),7650,'transferencia');

do $$ begin
  if not exists(select 1 from public.trips where operator_request_id='74444444-4444-4444-8444-444444444444' and status='completed'
    and final_fare=7650 and payment_method='transferencia') then
    raise exception 'CRITICAL TEST FAIL: monto o medio de pago final no persistido';
  end if;
  if not exists(select 1 from public.drivers where id='73333333-3333-4333-8333-333333333333'
    and status='available' and total_trips_completed=1 and today_earnings=7650) then
    raise exception 'CRITICAL TEST FAIL: cierre duplicó o perdió ganancias';
  end if;
end $$;

rollback;
