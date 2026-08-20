-- Central GO: daily service control independent from permanent driver registration.
-- App drivers participate automatically when connected, unless the central suspends them.
-- Traditional drivers can be placed in/out of the priority queue manually.

alter table public.drivers
  add column if not exists service_enabled boolean not null default true,
  add column if not exists service_control_updated_at timestamptz not null default now();

comment on column public.drivers.service_enabled is
  'Whether the driver is authorized to participate in today''s operation. App connectivity and permanent registration are separate concerns.';

create index if not exists drivers_company_service_enabled_idx
  on public.drivers(company_id, service_enabled, operation_mode, status);

create or replace function public.centralgo_operator_set_driver_daily_service(
  p_driver_id uuid,
  p_enabled boolean,
  p_mode text default null
)
returns public.drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.drivers%rowtype;
  next_mode text;
begin
  select * into d
  from public.drivers
  where id = p_driver_id
  for update;

  if not found then
    raise exception 'Conductor no encontrado' using errcode='P0002';
  end if;

  if not public.centralgo_has_company_role(
    d.company_id,
    array['company_admin','operator']::public.centralgo_company_role[]
  ) and not public.centralgo_is_super_admin() then
    raise exception 'Sin permiso para controlar el turno de este móvil' using errcode='42501';
  end if;

  if exists(
    select 1 from public.trips t
    where t.driver_id=d.id
      and t.status in ('assigned','en_route','arrived','in_progress')
  ) then
    raise exception 'No puedes cambiar el turno mientras el móvil tiene una carrera activa' using errcode='55000';
  end if;

  next_mode := coalesce(p_mode, d.operation_mode, 'app');
  if next_mode not in ('app','traditional') then
    raise exception 'Modo de operación no permitido' using errcode='22023';
  end if;

  update public.drivers
  set operation_mode = next_mode,
      service_enabled = p_enabled,
      -- Traditional mobiles are controlled by the operator. App mobiles only
      -- become available after their own app reports presence/GPS.
      status = case
        when not p_enabled then 'offline'::public.centralgo_driver_status
        when next_mode='traditional' then 'available'::public.centralgo_driver_status
        when d.status='offline' then 'offline'::public.centralgo_driver_status
        else d.status
      end,
      service_control_updated_at = now(),
      updated_at = now()
  where id=d.id
  returning * into d;

  return d;
end;
$$;

revoke all on function public.centralgo_operator_set_driver_daily_service(uuid,boolean,text) from public, anon;
grant execute on function public.centralgo_operator_set_driver_daily_service(uuid,boolean,text) to authenticated, service_role;

-- A central suspension must win over a late GPS/presence update that tries to
-- mark an app driver as available again.
create or replace function public.centralgo_enforce_driver_service_enabled()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.service_enabled=false and new.status='available' then
    new.status := 'offline'::public.centralgo_driver_status;
  end if;
  return new;
end;
$$;

drop trigger if exists centralgo_enforce_driver_service_enabled on public.drivers;
create trigger centralgo_enforce_driver_service_enabled
before insert or update of status,service_enabled on public.drivers
for each row execute function public.centralgo_enforce_driver_service_enabled();

-- App presence remains automatic, but a driver suspended by the central does
-- not create an operational session until re-enabled.
create or replace function public.centralgo_driver_presence_ping(target_company uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  own_driver uuid;
  driver_row public.drivers%rowtype;
  session_id uuid;
begin
  own_driver := public.centralgo_driver_id_for_user(target_company);
  if own_driver is null then
    raise exception 'Conductor no vinculado a esta central' using errcode='42501';
  end if;

  select * into driver_row from public.drivers where id=own_driver for update;
  if not driver_row.service_enabled then
    update public.driver_presence_sessions
      set last_seen_at=now(), ended_at=now()
      where driver_id=own_driver and ended_at is null;
    return null;
  end if;

  update public.driver_presence_sessions
  set ended_at=last_seen_at
  where driver_id=own_driver and ended_at is null
    and last_seen_at < now()-interval '4 minutes';

  select id into session_id
  from public.driver_presence_sessions
  where driver_id=own_driver and ended_at is null
  order by started_at desc limit 1 for update;

  if session_id is null then
    insert into public.driver_presence_sessions(company_id,driver_id,user_id)
    values(target_company,own_driver,auth.uid()) returning id into session_id;
  else
    update public.driver_presence_sessions set last_seen_at=now() where id=session_id;
  end if;

  return session_id;
end;
$$;

revoke all on function public.centralgo_driver_presence_ping(uuid) from public, anon;
grant execute on function public.centralgo_driver_presence_ping(uuid) to authenticated, service_role;
