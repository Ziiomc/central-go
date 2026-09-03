\set ON_ERROR_STOP on

-- Regression contract for the driver FIFO.
-- Safe to run against a compatible database: all fixture data is rolled back.
begin;

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
values
  ('e1000000-0000-4000-8000-000000000001','queue-a-20260903@centralgo.test',now(),'{"name":"Fila A"}'),
  ('e1000000-0000-4000-8000-000000000002','queue-b-20260903@centralgo.test',now(),'{"name":"Fila B"}'),
  ('e1000000-0000-4000-8000-000000000003','queue-c-20260903@centralgo.test',now(),'{"name":"Fila C"}'),
  ('e1000000-0000-4000-8000-000000000004','queue-d-20260903@centralgo.test',now(),'{"name":"Fila D"}');

insert into public.companies(id,name,code,active)
values('e2000000-0000-4000-8000-000000000001','Central QA Reconnect','QUEUE-R-QA',true);

insert into public.company_memberships(company_id,user_id,role,active)
values
  ('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','driver',true),
  ('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002','driver',true),
  ('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000003','driver',true),
  ('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000004','driver',true);

insert into public.vehicles(id,company_id,unit_number,license_plate,brand,model,year,status)
values
  ('e2500000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','QA-A','QRA-001','Toyota','Yaris',2024,'active'),
  ('e2500000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000001','QA-B','QRB-002','Toyota','Yaris',2024,'active'),
  ('e2500000-0000-4000-8000-000000000003','e2000000-0000-4000-8000-000000000001','QA-C','QRC-003','Toyota','Yaris',2024,'active'),
  ('e2500000-0000-4000-8000-000000000004','e2000000-0000-4000-8000-000000000001','QA-D','QRD-004','Toyota','Yaris',2024,'active');

insert into public.drivers(
  id,company_id,user_id,vehicle_id,unit_number,display_name,license_number,status,
  operation_mode,service_enabled,dispatch_queue_order,dispatch_queue_updated_at,
  service_control_updated_at
)
values
  ('e3000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','e2500000-0000-4000-8000-000000000001','QA-A','Conductor A','QRA-LIC','available','app',true,10,now()-interval '2 hours',now()-interval '2 hours'),
  ('e3000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002','e2500000-0000-4000-8000-000000000002','QA-B','Conductor B','QRB-LIC','available','app',true,20,now()-interval '90 minutes',now()-interval '90 minutes'),
  -- C deliberately has an old, low queue value: reconnect must never recover it.
  ('e3000000-0000-4000-8000-000000000003','e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000003','e2500000-0000-4000-8000-000000000003','QA-C','Conductor C','QRC-LIC','offline','app',true,5,now()-interval '3 hours',now()-interval '3 hours'),
  ('e3000000-0000-4000-8000-000000000004','e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000004','e2500000-0000-4000-8000-000000000004','QA-D','Conductor D','QRD-LIC','offline','app',true,6,now()-interval '3 hours',now()-interval '3 hours');

insert into public.driver_presence_sessions(company_id,driver_id,user_id,started_at,last_seen_at)
values
  ('e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001',now()-interval '60 minutes',now()),
  ('e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000002',now()-interval '30 minutes',now());

-- C reconnects: it must join behind A and B and receive a fresh presence anchor.
set local role authenticated;
set local request.jwt.claim.sub='e1000000-0000-4000-8000-000000000003';
select public.centralgo_driver_set_manual_status('e2000000-0000-4000-8000-000000000001','available');
reset role;

do $first_rejoin$
declare
  c_order bigint;
  a_order bigint;
  b_order bigint;
begin
  select dispatch_queue_order into c_order from public.drivers where id='e3000000-0000-4000-8000-000000000003';
  select dispatch_queue_order into a_order from public.drivers where id='e3000000-0000-4000-8000-000000000001';
  select dispatch_queue_order into b_order from public.drivers where id='e3000000-0000-4000-8000-000000000002';
  if c_order<=greatest(a_order,b_order) then
    raise exception 'QUEUE RECONNECT FAIL: C recuperó una posición antigua (% <= %)',c_order,greatest(a_order,b_order);
  end if;
  if a_order<>10 or b_order<>20 then
    raise exception 'QUEUE STABILITY FAIL: conectar C alteró A/B (% / %)',a_order,b_order;
  end if;
  if not exists(
    select 1 from public.driver_presence_sessions
    where driver_id='e3000000-0000-4000-8000-000000000003' and ended_at is null
  ) then
    raise exception 'QUEUE PRESENCE FAIL: C volvió disponible sin sesión activa';
  end if;
end;
$first_rejoin$;

-- Disconnect C, then D joins. When C comes back immediately afterwards, C must
-- be behind D rather than recovering the position assigned at disconnect time.
set local role authenticated;
set local request.jwt.claim.sub='e1000000-0000-4000-8000-000000000003';
select public.centralgo_driver_set_manual_status('e2000000-0000-4000-8000-000000000001','offline');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='e1000000-0000-4000-8000-000000000004';
select public.centralgo_driver_set_manual_status('e2000000-0000-4000-8000-000000000001','available');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='e1000000-0000-4000-8000-000000000003';
select public.centralgo_driver_set_manual_status('e2000000-0000-4000-8000-000000000001','available');
reset role;

do $immediate_reconnect$
declare
  c_order bigint;
  d_order bigint;
  a_order bigint;
  b_order bigint;
begin
  select dispatch_queue_order into c_order from public.drivers where id='e3000000-0000-4000-8000-000000000003';
  select dispatch_queue_order into d_order from public.drivers where id='e3000000-0000-4000-8000-000000000004';
  select dispatch_queue_order into a_order from public.drivers where id='e3000000-0000-4000-8000-000000000001';
  select dispatch_queue_order into b_order from public.drivers where id='e3000000-0000-4000-8000-000000000002';
  if c_order<=d_order then
    raise exception 'QUEUE RECONNECT FAIL: reconexión inmediata de C no quedó detrás de D (% <= %)',c_order,d_order;
  end if;
  if a_order<>10 or b_order<>20 then
    raise exception 'QUEUE STABILITY FAIL: reconexiones alteraron A/B (% / %)',a_order,b_order;
  end if;
end;
$immediate_reconnect$;

-- A short Pause preserves the exact queue slot.
create temporary table queue_regression_state(c_order bigint) on commit drop;
insert into queue_regression_state(c_order)
select dispatch_queue_order from public.drivers where id='e3000000-0000-4000-8000-000000000003';

set local role authenticated;
set local request.jwt.claim.sub='e1000000-0000-4000-8000-000000000003';
select public.centralgo_driver_set_manual_status('e2000000-0000-4000-8000-000000000001','paused');
select public.centralgo_driver_set_manual_status('e2000000-0000-4000-8000-000000000001','available');
reset role;

do $short_pause$
begin
  if (
    select d.dispatch_queue_order<>s.c_order
    from public.drivers d cross join queue_regression_state s
    where d.id='e3000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'QUEUE PAUSE FAIL: una pausa corta perdió el lugar';
  end if;
end;
$short_pause$;

-- A stale heartbeat caused by minimizing/backgrounding the PWA must NOT be
-- treated as an explicit disconnect and must preserve queue order.
update public.driver_presence_sessions
set started_at=now()-interval '25 minutes',
    last_seen_at=now()-interval '16 minutes'
where driver_id='e3000000-0000-4000-8000-000000000003' and ended_at is null;

set local role authenticated;
set local request.jwt.claim.sub='e1000000-0000-4000-8000-000000000003';
select public.centralgo_driver_presence_ping('e2000000-0000-4000-8000-000000000001');
reset role;

do $background_resume$
begin
  if (
    select d.dispatch_queue_order<>s.c_order
    from public.drivers d cross join queue_regression_state s
    where d.id='e3000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'QUEUE BACKGROUND FAIL: volver de segundo plano alteró la posición';
  end if;
  if not exists(
    select 1 from public.driver_presence_sessions
    where driver_id='e3000000-0000-4000-8000-000000000003' and ended_at is null
  ) then
    raise exception 'QUEUE BACKGROUND FAIL: no se renovó la presencia al volver';
  end if;
end;
$background_resume$;

-- Pause older than 15 minutes moves to the tail exactly once.
set local role authenticated;
set local request.jwt.claim.sub='e1000000-0000-4000-8000-000000000003';
select public.centralgo_driver_set_manual_status('e2000000-0000-4000-8000-000000000001','paused');
reset role;

update public.drivers
set service_control_updated_at=now()-interval '16 minutes',
    dispatch_queue_updated_at=now()-interval '1 hour'
where id='e3000000-0000-4000-8000-000000000003';

set local role authenticated;
set local request.jwt.claim.sub='e1000000-0000-4000-8000-000000000003';
select public.centralgo_driver_presence_ping('e2000000-0000-4000-8000-000000000001');
reset role;

create temporary table queue_pause_expired_state(c_order bigint) on commit drop;
insert into queue_pause_expired_state(c_order)
select dispatch_queue_order from public.drivers where id='e3000000-0000-4000-8000-000000000003';

set local role authenticated;
set local request.jwt.claim.sub='e1000000-0000-4000-8000-000000000003';
select public.centralgo_driver_presence_ping('e2000000-0000-4000-8000-000000000001');
reset role;

do $expired_pause_once$
declare
  c_order bigint;
  d_order bigint;
  saved_order bigint;
begin
  select dispatch_queue_order into c_order from public.drivers where id='e3000000-0000-4000-8000-000000000003';
  select dispatch_queue_order into d_order from public.drivers where id='e3000000-0000-4000-8000-000000000004';
  select q.c_order into saved_order from queue_pause_expired_state q;
  if c_order<=d_order then
    raise exception 'QUEUE PAUSE FAIL: pausa vencida no quedó al final (% <= %)',c_order,d_order;
  end if;
  if c_order<>saved_order then
    raise exception 'QUEUE PAUSE FAIL: segundo heartbeat volvió a mover la pausa vencida (% <> %)',c_order,saved_order;
  end if;
end;
$expired_pause_once$;

rollback;
