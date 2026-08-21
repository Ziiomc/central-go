create or replace function public.centralgo_operator_assign_trip(p_trip_id uuid, p_driver_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = public
as $function$
declare
  t public.trips%rowtype;
  d public.drivers%rowtype;
  result_trip public.trips%rowtype;
  previous_driver uuid;
begin
  select * into t from public.trips where id=p_trip_id for update;
  if not found then raise exception 'Carrera no encontrada' using errcode='P0002'; end if;
  if not public.centralgo_has_company_role(t.company_id,array['company_admin','operator']::public.centralgo_company_role[]) then
    raise exception 'Sin permiso para despachar esta central' using errcode='42501';
  end if;
  if t.status in ('completed','cancelled','in_progress') then raise exception 'La carrera ya no puede asignarse' using errcode='55000'; end if;
  if t.scheduled_for is not null and t.scheduled_for > now()+interval '10 minutes' then raise exception 'La carrera está agendada para más adelante' using errcode='55000'; end if;

  select * into d from public.drivers where id=p_driver_id for update;
  if not found or d.company_id<>t.company_id then raise exception 'Móvil inválido para esta central' using errcode='22023'; end if;
  if t.client_id is not null and exists(
    select 1 from public.client_driver_blocks b
    where b.company_id=t.company_id and b.client_id=t.client_id and b.driver_id=d.id and b.active
  ) then raise exception 'Este cliente tiene registrado que rechaza este móvil' using errcode='55000'; end if;
  if d.status<>'available' and t.driver_id is distinct from d.id then raise exception 'El móvil no está disponible' using errcode='55000'; end if;

  if d.operation_mode <> 'traditional' and not exists (
    select 1 from public.driver_presence_sessions s
    where s.driver_id=d.id
      and s.ended_at is null
      and s.last_seen_at > now()-interval '4 minutes'
  ) then
    raise exception 'El móvil figura disponible, pero su app no está conectada. Pídele al conductor abrir Central GO y vuelve a intentar.' using errcode='55000';
  end if;

  if exists(
    select 1 from public.trips x
    where x.driver_id=d.id and x.id<>t.id and x.status in ('assigned','en_route','arrived','in_progress')
  ) then raise exception 'El móvil ya tiene una carrera activa' using errcode='55000'; end if;

  previous_driver:=t.driver_id;
  if previous_driver is not null and previous_driver<>d.id then
    update public.drivers set status='available' where id=previous_driver;
  end if;

  update public.trips set
    status='pending',driver_id=null,driver_unit_number=null,driver_name=null,offer_expires_at=null,
    dispatch_mode='manual',reserved_driver_id=null,reserved_driver_unit_number=null,reserved_driver_name=null,reservation_reason=null
  where id=t.id;

  result_trip:=public.centralgo_internal_assign_offer(t.id,d.id,'Asignación manual de operadora');
  return result_trip;
end;
$function$;
