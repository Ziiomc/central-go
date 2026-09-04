\set ON_ERROR_STOP on

-- Deliberately hostile operational test. These users double click, retry stale
-- actions, cancel/reassign repeatedly, use the wrong central and try impossible
-- transitions. Everything happens inside one transaction and is rolled back.
begin;

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('e1000000-0000-4000-8000-000000000001','chaos-operator@centralgo.test',now(),'{"name":"Operador Torpe"}'),
 ('e1000000-0000-4000-8000-000000000002','chaos-other@centralgo.test',now(),'{"name":"Otra Central"}');
insert into public.companies(id,name,code,active) values
 ('e2000000-0000-4000-8000-000000000001','Central Caos','CAOS',true),
 ('e2000000-0000-4000-8000-000000000002','Central Ajena','AJENA',true);
insert into public.company_memberships(company_id,user_id,role,active) values
 ('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','operator',true),
 ('e2000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000002','operator',true);
insert into public.vehicles(id,company_id,unit_number,license_plate,brand,model,year,status) values
 ('e3000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','T-01','CHAOS01','Toyota','Yaris',2024,'active'),
 ('e3000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000001','T-02','CHAOS02','Kia','Rio',2024,'active'),
 ('e3000000-0000-4000-8000-000000000003','e2000000-0000-4000-8000-000000000002','A-01','AJENA01','Nissan','Versa',2024,'active');
insert into public.drivers(id,company_id,vehicle_id,unit_number,display_name,license_number,status,operation_mode,service_enabled) values
 ('e4000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','T-01','Chofer Torpe Uno','LIC-CHAOS-1','available','traditional',true),
 ('e4000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000002','T-02','Chofer Torpe Dos','LIC-CHAOS-2','available','traditional',true),
 ('e4000000-0000-4000-8000-000000000003','e2000000-0000-4000-8000-000000000002','e3000000-0000-4000-8000-000000000003','A-01','Chofer Ajeno','LIC-AJENA','available','traditional',true);

set local role authenticated;
set local request.jwt.claim.sub='e1000000-0000-4000-8000-000000000001';

do $$
declare
  v_trip_id uuid;
  v_before bigint;
  v_after bigint;
  audit_before int;
  audit_after int;
  event_after int;
  i int;
  request_id uuid;
begin
  -- 1. A user clicks Nueva carrera nine times because "nothing happened".
  select id into v_trip_id from public.centralgo_operator_create_trip(
    'e2000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001',null,'Cliente Caos','+56900000001',
    'Origen caos',-35.84,-71.59,null,'Destino caos',-35.85,-71.60,null,null,'standard',2,8,5000,false,null,'efectivo','CHAOS',null,'manual');
  for i in 1..8 loop
    perform public.centralgo_operator_create_trip(
      'e2000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001',null,'Cliente Caos','+56900000001',
      'Origen caos',-35.84,-71.59,null,'Destino caos',-35.85,-71.60,null,null,'standard',2,8,5000,false,null,'efectivo','CHAOS',null,'manual');
  end loop;
  if (select count(*) from public.trips where operator_request_id='e5000000-0000-4000-8000-000000000001')<>1 then
    raise exception 'CHAOS FAIL: repeated create duplicated the trip';
  end if;

  -- 2. Same manual assignment twice must be a no-op the second time.
  perform public.centralgo_operator_assign_trip(v_trip_id,'e4000000-0000-4000-8000-000000000001');
  select version into v_before from public.trips where id=v_trip_id;
  select count(*) into audit_before from public.audit_logs where company_id='e2000000-0000-4000-8000-000000000001' and action='ASIGNACION_TRADICIONAL_CONFIRMADA';
  perform public.centralgo_operator_assign_trip(v_trip_id,'e4000000-0000-4000-8000-000000000001');
  select version into v_after from public.trips where id=v_trip_id;
  select count(*) into audit_after from public.audit_logs where company_id='e2000000-0000-4000-8000-000000000001' and action='ASIGNACION_TRADICIONAL_CONFIRMADA';
  if v_after<>v_before or audit_after<>audit_before then
    raise exception 'CHAOS FAIL: duplicate assignment changed state/audit';
  end if;

  -- 3. A mobile with an active trip cannot be manually taken out of service.
  begin
    perform public.centralgo_operator_set_driver_daily_service('e4000000-0000-4000-8000-000000000001',false,'traditional');
    raise exception 'CHAOS FAIL: active mobile was removed from service';
  exception when sqlstate '55000' then null; end;

  -- 4. Repeated cancellation behaves like one cancellation, not two events.
  perform public.centralgo_operator_cancel_trip(v_trip_id,'Cliente se confundió');
  select version into v_before from public.trips where id=v_trip_id;
  select count(*) into event_after from public.trip_dispatch_events e where e.trip_id=v_trip_id;
  perform public.centralgo_operator_cancel_trip(v_trip_id,'Cliente se confundió');
  select version into v_after from public.trips where id=v_trip_id;
  if v_after<>v_before or (select count(*) from public.trip_dispatch_events e where e.trip_id=v_trip_id)<>event_after then
    raise exception 'CHAOS FAIL: repeated cancel produced extra mutation';
  end if;
  if (select status from public.drivers where id='e4000000-0000-4000-8000-000000000001')<>'available' then
    raise exception 'CHAOS FAIL: cancellation left mobile busy';
  end if;
  begin
    perform public.centralgo_operator_assign_trip(v_trip_id,'e4000000-0000-4000-8000-000000000002');
    raise exception 'CHAOS FAIL: cancelled trip was reassigned';
  exception when sqlstate '55000' then null; end;

  -- 5. Manual take-out/re-entry is reversible. The fleet row stays enabled so
  -- the console can keep the mobile visible in red, but OFFLINE removes it from
  -- the active queue. Re-entry must move the mobile to the true tail.
  select dispatch_queue_order into v_before
  from public.drivers where id='e4000000-0000-4000-8000-000000000001';
  perform public.centralgo_operator_set_driver_daily_service('e4000000-0000-4000-8000-000000000001',false,'traditional');
  if not exists(select 1 from public.drivers where id='e4000000-0000-4000-8000-000000000001' and service_enabled and status='offline') then
    raise exception 'CHAOS FAIL: manual remove did not leave the roster row offline';
  end if;
  if not exists(select 1 from public.vehicles where id='e3000000-0000-4000-8000-000000000001' and archived_at is null) then
    raise exception 'CHAOS FAIL: removing from queue deleted/archived vehicle';
  end if;
  perform public.centralgo_operator_set_driver_daily_service('e4000000-0000-4000-8000-000000000001',true,'traditional');
  if not exists(select 1 from public.drivers where id='e4000000-0000-4000-8000-000000000001' and service_enabled and status='available') then
    raise exception 'CHAOS FAIL: manual re-entry did not restore mobile';
  end if;
  select dispatch_queue_order into v_after
  from public.drivers where id='e4000000-0000-4000-8000-000000000001';
  if v_after<=v_before or exists(
    select 1 from public.drivers d
    where d.company_id='e2000000-0000-4000-8000-000000000001'
      and d.id<>'e4000000-0000-4000-8000-000000000001'
      and d.archived_at is null
      and d.dispatch_queue_order>=v_after
  ) then
    raise exception 'CHAOS FAIL: manual re-entry did not move mobile to queue tail';
  end if;

  -- 6. Wrong central, impossible state and blank cancellation reason are rejected.
  select id into v_trip_id from public.centralgo_operator_create_trip(
    'e2000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000002',null,'Cliente Dos','',
    'Origen dos',-35.84,-71.59,null,'Destino dos',-35.85,-71.60,null,null,'standard',1,5,2500,false,null,'efectivo',null,null,'manual');
  begin perform public.centralgo_operator_assign_trip(v_trip_id,'e4000000-0000-4000-8000-000000000003'); raise exception 'CHAOS FAIL: cross-company mobile accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.centralgo_operator_set_trip_status(v_trip_id,'arrived'); raise exception 'CHAOS FAIL: pending trip jumped to arrived'; exception when sqlstate '55000' then null; end;
  begin perform public.centralgo_operator_cancel_trip(v_trip_id,'   '); raise exception 'CHAOS FAIL: blank cancellation accepted'; exception when sqlstate '22023' then null; end;

  -- 7. Future reservations cannot be dragged into today's live dispatch early.
  select id into v_trip_id from public.centralgo_operator_create_trip(
    'e2000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000003',null,'Reserva Torpe','',
    'Origen reserva',-35.84,-71.59,null,'Destino reserva',-35.85,-71.60,null,null,'standard',1,5,2500,false,null,'efectivo',null,now()+interval '2 hours','manual');
  begin perform public.centralgo_operator_assign_trip(v_trip_id,'e4000000-0000-4000-8000-000000000002'); raise exception 'CHAOS FAIL: future reservation dispatched early'; exception when sqlstate '55000' then null; end;

  -- 8. Invalid/corrupt values must be stopped at the RPC boundary.
  begin
    perform public.centralgo_operator_create_trip('e2000000-0000-4000-8000-000000000001',gen_random_uuid(),null,'Malo','', 'Origen',999,-71,null,'Destino',-35,-71,null,null,'standard',1,1,1,false,null,'efectivo',null,null,'manual');
    raise exception 'CHAOS FAIL: invalid latitude accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.centralgo_operator_create_trip('e2000000-0000-4000-8000-000000000001',gen_random_uuid(),null,'Malo','', 'Origen',-35,-71,null,'Destino',-35,-71,null,null,'standard',-1,1,-100,false,null,'efectivo',null,null,'manual');
    raise exception 'CHAOS FAIL: negative fare/distance accepted';
  exception when sqlstate '22023' then null; end;

  -- 9. Reassign/unassign abuse loop: 25 services, two mobiles, stale duplicate actions.
  for i in 1..25 loop
    request_id:=gen_random_uuid();
    select id into v_trip_id from public.centralgo_operator_create_trip(
      'e2000000-0000-4000-8000-000000000001',request_id,null,'Cliente Loop','',
      'Origen loop',-35.84,-71.59,null,'Destino loop',-35.85,-71.60,null,null,'standard',1,4,2200,false,null,'efectivo',null,null,'manual');
    perform public.centralgo_operator_assign_trip(v_trip_id,'e4000000-0000-4000-8000-000000000001');
    perform public.centralgo_operator_unassign_trip(v_trip_id,'Operador cambió de idea');
    select version into v_before from public.trips where id=v_trip_id;
    perform public.centralgo_operator_unassign_trip(v_trip_id,'Operador cambió de idea');
    select version into v_after from public.trips where id=v_trip_id;
    if v_after<>v_before then raise exception 'CHAOS FAIL: repeated unassign mutated trip'; end if;
    perform public.centralgo_operator_assign_trip(v_trip_id,'e4000000-0000-4000-8000-000000000002');
    perform public.centralgo_operator_cancel_trip(v_trip_id,'Prueba torpe');
  end loop;

  if exists(select 1 from public.drivers where company_id='e2000000-0000-4000-8000-000000000001' and status in ('en_route','in_trip')) then
    raise exception 'CHAOS FAIL: abuse loop left a mobile stuck busy';
  end if;
  if exists(select 1 from public.trips where company_id='e2000000-0000-4000-8000-000000000001' and driver_id is not null and status='pending') then
    raise exception 'CHAOS FAIL: pending trip retained a driver after abuse';
  end if;
end $$;

rollback;
