\set ON_ERROR_STOP on
begin;

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
values ('f1000000-0000-4000-8000-000000000001','blank-mobile-operator@centralgo.test',now(),'{"name":"Operador Blank Mobile"}');

insert into public.companies(id,name,code,active)
values ('f2000000-0000-4000-8000-000000000001','Central Blank Mobile','BLANK-MOBILE',true);

insert into public.company_memberships(company_id,user_id,role,active)
values ('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','operator',true);

insert into public.drivers(
  id,company_id,user_id,vehicle_id,unit_number,display_name,license_number,
  status,operation_mode,service_enabled
) values (
  'f4000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001',null,null,'',
  'Conductor sin móvil','LIC-BLANK-MOBILE','offline','app',true
);

set local role authenticated;
set local request.jwt.claim.sub='f1000000-0000-4000-8000-000000000001';

do $$
begin
  begin
    perform public.centralgo_operator_set_driver_daily_service(
      'f4000000-0000-4000-8000-000000000001',true,'traditional'
    );
    raise exception 'BLANK MOBILE FAIL: se activó un conductor sin número de móvil';
  exception when sqlstate '22023' then
    null;
  end;

  if exists (
    select 1 from public.drivers
    where id='f4000000-0000-4000-8000-000000000001'
      and status<>'offline'
  ) then
    raise exception 'BLANK MOBILE FAIL: el RPC dejó activo al conductor incompleto';
  end if;
end $$;

reset role;

-- Simula un registro manual incompleto que intenta saltarse el RPC. En modo
-- tradicional el trigger conserva el número manual; el CHECK debe impedir que
-- una fila sin número llegue a estado activo.
update public.drivers
set operation_mode='traditional'
where id='f4000000-0000-4000-8000-000000000001';

do $$
begin
  begin
    update public.drivers
    set status='available'::public.centralgo_driver_status
    where id='f4000000-0000-4000-8000-000000000001';
    raise exception 'BLANK MOBILE FAIL: el constraint permitió estado activo sin número';
  exception when check_violation then
    null;
  end;
end $$;

rollback;
