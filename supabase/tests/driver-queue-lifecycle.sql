\set ON_ERROR_STOP on

-- Queue lifecycle contract for the driver app. The transaction is rolled back
-- so this suite is safe against any isolated production-compatible database.
begin;

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
values
  ('d1000000-0000-4000-8000-000000000001','queue-driver-a@centralgo.test',now(),'{"name":"Fila A"}'),
  ('d1000000-0000-4000-8000-000000000002','queue-driver-b@centralgo.test',now(),'{"name":"Fila B"}');

insert into public.companies(id,name,code,active)
values('d2000000-0000-4000-8000-000000000001','Central QA Fila','QUEUE-QA',true);

insert into public.company_memberships(company_id,user_id,role,active)
values
  ('d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','driver',true),
  ('d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002','driver',true);

insert into public.vehicles(id,company_id,unit_number,license_plate,brand,model,year,status)
values
  ('d2500000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','QA-1','QUEUE-A','Toyota','Yaris',2024,'active'),
  ('d2500000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','QA-2','QUEUE-B','Toyota','Yaris',2024,'active'),
  ('d2500000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001','QA-3','QUEUE-C','Toyota','Yaris',2024,'active'),
  ('d2500000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000001','QA-4','QUEUE-D','Toyota','Yaris',2024,'active');

insert into public.drivers(
  id,company_id,user_id,vehicle_id,unit_number,display_name,license_number,status,
  operation_mode,service_enabled,dispatch_queue_order,dispatch_queue_updated_at
)
values
  ('d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','d2500000-0000-4000-8000-000000000001','QA-1','Conductor A','QUEUE-LIC-A','available','app',true,1,now()-interval '2 hours'),
  ('d3000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002','d2500000-0000-4000-8000-000000000002','QA-2','Conductor B','QUEUE-LIC-B','available','traditional',true,2,now()-interval '90 minutes');

insert into public.driver_presence_sessions(company_id,driver_id,user_id,started_at,last_seen_at)
values(
  'd2000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  now()-interval '30 minutes',
  now()
);

set local role authenticated;
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000001';

select public.centralgo_driver_set_manual_status(
  'd2000000-0000-4000-8000-000000000001','paused'
);

do $paused_snapshot$
declare
  own_position bigint;
  own_status text;
begin
  select ranked.position,ranked.status
  into own_position,own_status
  from (
    select q.driver_id,q.status,
           row_number() over(order by q.queue_order,q.unit_number,q.driver_id) as position
    from public.centralgo_driver_queue_snapshot('d2000000-0000-4000-8000-000000000001') q
  ) ranked
  where ranked.driver_id='d3000000-0000-4000-8000-000000000001';

  if own_position<>1 or own_status<>'paused' then
    raise exception 'QUEUE FAIL: la pausa no conservó/mostró la posición 1 (posición %, estado %)',own_position,own_status;
  end if;
end;
$paused_snapshot$;

reset role;
update public.drivers
set service_control_updated_at=now()-interval '14 minutes'
where id='d3000000-0000-4000-8000-000000000001';

set local role authenticated;
select public.centralgo_driver_set_manual_status(
  'd2000000-0000-4000-8000-000000000001','available'
);
reset role;

do $short_pause$
begin
  if (select dispatch_queue_order from public.drivers where id='d3000000-0000-4000-8000-000000000001')<>1 then
    raise exception 'QUEUE FAIL: una pausa inferior a 15 minutos perdió su lugar';
  end if;
end;
$short_pause$;

set local role authenticated;
select public.centralgo_driver_set_manual_status(
  'd2000000-0000-4000-8000-000000000001','paused'
);
reset role;

update public.drivers
set service_control_updated_at=now()-interval '16 minutes',
    dispatch_queue_updated_at=now()-interval '1 hour'
where id='d3000000-0000-4000-8000-000000000001';

set local role authenticated;
select public.centralgo_driver_presence_ping('d2000000-0000-4000-8000-000000000001');
reset role;

do $expired_pause$
begin
  if (select dispatch_queue_order from public.drivers where id='d3000000-0000-4000-8000-000000000001')<=2 then
    raise exception 'QUEUE FAIL: una pausa superior a 15 minutos no pasó al final';
  end if;
end;
$expired_pause$;

insert into public.drivers(
  id,company_id,vehicle_id,unit_number,display_name,license_number,status,
  operation_mode,service_enabled,dispatch_queue_order,dispatch_queue_updated_at
)
values(
  'd3000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001','d2500000-0000-4000-8000-000000000003','QA-3','Conductor C','QUEUE-LIC-C','available','traditional',true,4,now()
);

set local role authenticated;
select public.centralgo_driver_set_manual_status(
  'd2000000-0000-4000-8000-000000000001','available'
);
select public.centralgo_driver_set_manual_status(
  'd2000000-0000-4000-8000-000000000001','offline'
);
reset role;

do $explicit_disconnect$
begin
  if (select status from public.drivers where id='d3000000-0000-4000-8000-000000000001')<>'offline' then
    raise exception 'QUEUE FAIL: Desconectar no dejó el móvil fuera de línea';
  end if;
  if (select dispatch_queue_order from public.drivers where id='d3000000-0000-4000-8000-000000000001')<=4 then
    raise exception 'QUEUE FAIL: Desconectar no movió el móvil al final';
  end if;
  if exists(select 1 from public.driver_presence_sessions where driver_id='d3000000-0000-4000-8000-000000000001' and ended_at is null) then
    raise exception 'QUEUE FAIL: Desconectar dejó una sesión de presencia activa';
  end if;
end;
$explicit_disconnect$;

set local role authenticated;
do $offline_heartbeat$
declare
  ping_result uuid;
begin
  ping_result:=public.centralgo_driver_presence_ping('d2000000-0000-4000-8000-000000000001');
  if ping_result is not null then
    raise exception 'QUEUE FAIL: un heartbeat revirtió una desconexión explícita';
  end if;
end;
$offline_heartbeat$;

select public.centralgo_driver_set_manual_status(
  'd2000000-0000-4000-8000-000000000001','available'
);
select public.centralgo_driver_presence_ping('d2000000-0000-4000-8000-000000000001');
reset role;

create temporary table queue_test_state(queue_before bigint) on commit drop;
insert into queue_test_state(queue_before)
select dispatch_queue_order
from public.drivers where id='d3000000-0000-4000-8000-000000000001';

update public.driver_presence_sessions
set started_at=now()-interval '11 minutes',
    last_seen_at=now()-interval '10 minutes'
where driver_id='d3000000-0000-4000-8000-000000000001' and ended_at is null;

set local role authenticated;
select public.centralgo_driver_presence_ping('d2000000-0000-4000-8000-000000000001');
reset role;

do $brief_gap$
begin
  if (
    select d.dispatch_queue_order<>s.queue_before
    from public.drivers d cross join queue_test_state s
    where d.id='d3000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'QUEUE FAIL: una interrupción inferior a 15 minutos perdió el lugar';
  end if;
end;
$brief_gap$;

insert into public.drivers(
  id,company_id,vehicle_id,unit_number,display_name,license_number,status,
  operation_mode,service_enabled,dispatch_queue_order,dispatch_queue_updated_at
)
values(
  'd3000000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000001','d2500000-0000-4000-8000-000000000004','QA-4','Conductor D','QUEUE-LIC-D','available','traditional',true,6,now()
);

update public.driver_presence_sessions
set started_at=now()-interval '20 minutes',
    last_seen_at=now()-interval '16 minutes'
where driver_id='d3000000-0000-4000-8000-000000000001' and ended_at is null;

set local role authenticated;
select public.centralgo_driver_presence_ping('d2000000-0000-4000-8000-000000000001');

do $long_background_gap$
declare
  own_order bigint;
  expected_order bigint;
  own_position bigint;
begin
  select dispatch_queue_order into own_order
  from public.drivers where id='d3000000-0000-4000-8000-000000000001';
  select queue_before into expected_order from queue_test_state;

  if own_order<>expected_order then
    raise exception 'QUEUE FAIL: volver de segundo plano alteró el lugar (% <> %)',own_order,expected_order;
  end if;

  select ranked.position into own_position
  from (
    select q.driver_id,
           row_number() over(order by q.queue_order,q.unit_number,q.driver_id) as position
    from public.centralgo_driver_queue_snapshot('d2000000-0000-4000-8000-000000000001') q
  ) ranked
  where ranked.driver_id='d3000000-0000-4000-8000-000000000001';

  if own_position<>3 then
    raise exception 'QUEUE FAIL: la app no conservó la posición tras volver de segundo plano (posición %)',own_position;
  end if;
end;
$long_background_gap$;

reset role;
rollback;
