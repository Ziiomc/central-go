-- Operator-safe driver state controls and SOS fan-out notifications.

create or replace function public.centralgo_operator_set_driver_status(
  p_driver_id uuid,
  p_new_status public.centralgo_driver_status
)
returns public.centralgo_driver_status
language plpgsql
security definer
set search_path = public
as $$
declare
  driver_row public.drivers%rowtype;
begin
  if p_new_status not in ('available','paused','offline') then
    raise exception 'Estado manual no permitido' using errcode = '22023';
  end if;
  select * into driver_row from public.drivers where id = p_driver_id for update;
  if not found then raise exception 'Conductor no encontrado' using errcode = 'P0002'; end if;
  if not public.centralgo_has_company_role(driver_row.company_id, array['company_admin','operator']::public.centralgo_company_role[]) then
    raise exception 'Sin permiso para cambiar este móvil' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.trips t where t.driver_id = driver_row.id
      and t.status in ('assigned','en_route','arrived','in_progress')
  ) then
    raise exception 'El móvil tiene una carrera activa' using errcode = '55000';
  end if;
  update public.drivers set status = p_new_status where id = driver_row.id;
  return p_new_status;
end;
$$;

create or replace function public.centralgo_driver_trigger_sos(p_lat double precision default null, p_lng double precision default null, p_address text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_driver public.drivers%rowtype;
  event_id uuid;
begin
  select d.* into target_driver from public.drivers d
  where d.user_id = auth.uid() order by d.updated_at desc limit 1 for update;
  if not found then raise exception 'Conductor autenticado no encontrado' using errcode = '42501'; end if;

  update public.drivers set status = 'sos', sos_active = true, sos_timestamp = now() where id = target_driver.id;
  insert into public.sos_events(company_id, driver_id, lat, lng, address)
  values(target_driver.company_id, target_driver.id, p_lat, p_lng, nullif(trim(coalesce(p_address,'')), ''))
  returning id into event_id;

  insert into public.notifications(company_id, recipient_user_id, title, message, type, related_id)
  select target_driver.company_id, m.user_id,
         '🚨 ALERTA SOS EMERGENCIA',
         format('Móvil %s (%s) activó botón de pánico%s', target_driver.unit_number, target_driver.display_name,
                case when nullif(trim(coalesce(p_address,'')), '') is null then '' else ' en ' || trim(p_address) end),
         'sos', event_id
  from public.company_memberships m
  where m.company_id = target_driver.company_id and m.active and m.role in ('company_admin','operator');

  return event_id;
end;
$$;

revoke all on function public.centralgo_operator_set_driver_status(uuid, public.centralgo_driver_status) from public, anon;
grant execute on function public.centralgo_operator_set_driver_status(uuid, public.centralgo_driver_status) to authenticated;

revoke all on function public.centralgo_driver_trigger_sos(double precision, double precision, text) from public, anon;
grant execute on function public.centralgo_driver_trigger_sos(double precision, double precision, text) to authenticated;
