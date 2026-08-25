-- Permite que la operadora incorpore temporalmente a cualquier conductor
-- en modo manual y que el conductor vuelva a modo App al abrir Central GO.
create or replace function public.centralgo_driver_presence_ping(target_company uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  own_driver uuid;
  driver_row public.drivers%rowtype;
  session_id uuid;
  created_new_session boolean := false;
begin
  own_driver := public.centralgo_driver_id_for_user(target_company);
  if own_driver is null then
    raise exception 'Conductor no vinculado a esta central' using errcode='42501';
  end if;

  select * into driver_row
  from public.drivers
  where id=own_driver
  for update;

  if not driver_row.service_enabled then
    update public.driver_presence_sessions
      set last_seen_at=now(), ended_at=now()
      where driver_id=own_driver and ended_at is null;
    return null;
  end if;

  -- Si la operadora incorporó manualmente a un conductor que sí tiene cuenta,
  -- abrir la aplicación devuelve el control al modo App sin sacarlo de la fila.
  if driver_row.user_id is not null
     and driver_row.operation_mode='traditional' then
    update public.drivers
      set operation_mode='app',
          status=case
            when status in ('offline','paused') then 'available'::public.centralgo_driver_status
            else status
          end,
          service_control_updated_at=now(),
          updated_at=now()
      where id=own_driver
      returning * into driver_row;
  end if;

  update public.driver_presence_sessions
  set ended_at=last_seen_at
  where driver_id=own_driver and ended_at is null
    and last_seen_at < now()-interval '4 minutes';

  select id into session_id
  from public.driver_presence_sessions
  where driver_id=own_driver and ended_at is null
  order by started_at desc
  limit 1
  for update;

  if session_id is null then
    insert into public.driver_presence_sessions(company_id,driver_id,user_id)
    values(target_company,own_driver,auth.uid())
    returning id into session_id;
    created_new_session := true;
  else
    update public.driver_presence_sessions
      set last_seen_at=now()
      where id=session_id;
  end if;

  if created_new_session
     and driver_row.operation_mode='app'
     and driver_row.status='offline'
     and not exists (
       select 1
       from public.trips t
       where t.driver_id=own_driver
         and t.status in ('assigned','en_route','arrived','in_progress')
     ) then
    update public.drivers
      set status='available'::public.centralgo_driver_status,
          updated_at=now()
      where id=own_driver;
  end if;

  return session_id;
end;
$function$;

revoke execute on function public.centralgo_driver_presence_ping(uuid) from public, anon;
grant execute on function public.centralgo_driver_presence_ping(uuid) to authenticated;
