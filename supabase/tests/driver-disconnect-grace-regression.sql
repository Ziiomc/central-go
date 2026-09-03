\set ON_ERROR_STOP on

-- Regression contract for accidental driver Disconnect:
-- * reconnecting within 60 seconds restores the exact FIFO slot;
-- * reconnecting after the grace window joins at the tail;
-- * Pause continues to use its independent 15-minute rule.
-- All fixture data is rolled back.
begin;

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
values
  ('a1100000-0000-4000-8000-000000000001','disconnect-grace-a@centralgo.test',now(),'{"name":"Fila A"}'),
  ('a1100000-0000-4000-8000-000000000002','disconnect-grace-c@centralgo.test',now(),'{"name":"Fila C"}'),
  ('a1100000-0000-4000-8000-000000000003','disconnect-grace-d@centralgo.test',now(),'{"name":"Fila D"}');

insert into public.companies(id,name,code,active)
values('a1200000-0000-4000-8000-000000000001','Central Disconnect Grace QA','DISCONNECT-GRACE-QA',true);

insert into public.company_memberships(company_id,user_id,role,active)
values
  ('a1200000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000001','driver',true),
  ('a1200000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000002','driver',true),
  ('a1200000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000003','driver',true);

insert into public.vehicles(id,company_id,unit_number,license_plate,brand,model,year,status)
values
  ('a1250000-0000-4000-8000-000000000001','a1200000-0000-4000-8000-000000000001','G-A','GRA-001','Toyota','Yaris',2024,'active'),
  ('a1250000-0000-4000-8000-000000000002','a1200000-0000-4000-8000-000000000001','G-C','GRC-002','Toyota','Yaris',2024,'active'),
  ('a1250000-0000-4000-8000-000000000003','a1200000-0000-4000-8000-000000000001','G-D','GRD-003','Toyota','Yaris',2024,'active');

insert into public.drivers(
  id,company_id,user_id,vehicle_id,unit_number,display_name,license_number,status,
  operation_mode,service_enabled,dispatch_queue_order,dispatch_queue_updated_at,
  service_control_updated_at
)
values
  ('a1300000-0000-4000-8000-000000000001','a1200000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000001','a1250000-0000-4000-8000-000000000001','G-A','Conductor A','GRA-LIC','available','app',true,10,now()-interval '2 hours',now()-interval '2 hours'),
  ('a1300000-0000-4000-8000-000000000002','a1200000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000002','a1250000-0000-4000-8000-000000000002','G-C','Conductor C','GRC-LIC','offline','app',true,5,now()-interval '3 hours',now()-interval '3 hours'),
  ('a1300000-0000-4000-8000-000000000003','a1200000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000003','a1250000-0000-4000-8000-000000000003','G-D','Conductor D','GRD-LIC','offline','app',true,6,now()-interval '3 hours',now()-interval '3 hours');

-- C starts from a genuinely old offline state, so its first join must be fresh.
set local role authenticated;
set local request.jwt.claim.sub='a1100000-0000-4000-8000-000000000002';
select public.centralgo_driver_set_manual_status('a1200000-0000-4000-8000-000000000001','available');
reset role;

create temporary table disconnect_grace_state(saved_order bigint) on commit drop;
insert into disconnect_grace_state(saved_order)
select dispatch_queue_order from public.drivers where id='a1300000-0000-4000-8000-000000000002';

-- C disconnects. D joins while C is offline. C returns immediately and must
-- recover the exact slot it held before the accidental Disconnect.
set local role authenticated;
set local request.jwt.claim.sub='a1100000-0000-4000-8000-000000000002';
select public.centralgo_driver_set_manual_status('a1200000-0000-4000-8000-000000000001','offline');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='a1100000-0000-4000-8000-000000000003';
select public.centralgo_driver_set_manual_status('a1200000-0000-4000-8000-000000000001','available');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='a1100000-0000-4000-8000-000000000002';
select public.centralgo_driver_set_manual_status('a1200000-0000-4000-8000-000000000001','available');
reset role;

do $within_grace$
declare
  c_order bigint;
  d_order bigint;
  saved_order bigint;
begin
  select dispatch_queue_order into c_order from public.drivers where id='a1300000-0000-4000-8000-000000000002';
  select dispatch_queue_order into d_order from public.drivers where id='a1300000-0000-4000-8000-000000000003';
  select disconnect_grace_state.saved_order into saved_order from disconnect_grace_state;

  if c_order<>saved_order then
    raise exception 'DISCONNECT GRACE FAIL: reconexión dentro de 60 s perdió el turno (% <> %)',c_order,saved_order;
  end if;
  if c_order>=d_order then
    raise exception 'DISCONNECT GRACE FAIL: el turno recuperado no quedó delante del conductor que se conectó después (% >= %)',c_order,d_order;
  end if;
end;
$within_grace$;

-- Simulate the same disconnect after the 60-second window without sleeping.
set local role authenticated;
set local request.jwt.claim.sub='a1100000-0000-4000-8000-000000000002';
select public.centralgo_driver_set_manual_status('a1200000-0000-4000-8000-000000000001','offline');
reset role;

update public.drivers
set service_control_updated_at=clock_timestamp()-interval '61 seconds'
where id='a1300000-0000-4000-8000-000000000002';

set local role authenticated;
set local request.jwt.claim.sub='a1100000-0000-4000-8000-000000000002';
select public.centralgo_driver_set_manual_status('a1200000-0000-4000-8000-000000000001','available');
reset role;

do $after_grace$
declare
  c_order bigint;
  d_order bigint;
begin
  select dispatch_queue_order into c_order from public.drivers where id='a1300000-0000-4000-8000-000000000002';
  select dispatch_queue_order into d_order from public.drivers where id='a1300000-0000-4000-8000-000000000003';

  if c_order<=d_order then
    raise exception 'DISCONNECT EXPIRY FAIL: después de 60 s el conductor no fue al final (% <= %)',c_order,d_order;
  end if;
end;
$after_grace$;

-- A normal short Pause must still preserve the current slot.
create temporary table pause_state(saved_order bigint) on commit drop;
insert into pause_state(saved_order)
select dispatch_queue_order from public.drivers where id='a1300000-0000-4000-8000-000000000002';

set local role authenticated;
set local request.jwt.claim.sub='a1100000-0000-4000-8000-000000000002';
select public.centralgo_driver_set_manual_status('a1200000-0000-4000-8000-000000000001','paused');
select public.centralgo_driver_set_manual_status('a1200000-0000-4000-8000-000000000001','available');
reset role;

do $pause_unchanged$
begin
  if (
    select d.dispatch_queue_order<>s.saved_order
    from public.drivers d cross join pause_state s
    where d.id='a1300000-0000-4000-8000-000000000002'
  ) then
    raise exception 'PAUSE REGRESSION FAIL: una pausa corta perdió su lugar';
  end if;
end;
$pause_unchanged$;

rollback;
