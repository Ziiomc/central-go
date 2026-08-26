-- Clumsy-user / unstable-network hardening.
-- Repeating the same logical operation must not duplicate audit events, notes,
-- offers or versions. This makes stale double clicks and HTTP retries harmless.

create or replace function public.centralgo_operator_assign_trip(p_trip_id uuid, p_driver_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
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
  if t.status in ('completed','cancelled','in_progress') then
    raise exception 'La carrera ya no puede asignarse' using errcode='55000';
  end if;
  if t.scheduled_for is not null and t.scheduled_for > now()+interval '10 minutes' then
    raise exception 'La carrera está agendada para más adelante' using errcode='55000';
  end if;

  -- Same action arriving twice (double click / retry) is already satisfied.
  if t.driver_id=p_driver_id and t.status in ('assigned','en_route','arrived') then
    return t;
  end if;

  select * into d from public.drivers where id=p_driver_id for update;
  if not found or d.company_id<>t.company_id then
    raise exception 'Móvil inválido para esta central' using errcode='22023';
  end if;
  if t.client_id is not null and exists(
    select 1 from public.client_driver_blocks b
    where b.company_id=t.company_id and b.client_id=t.client_id and b.driver_id=d.id and b.active
  ) then
    raise exception 'Este cliente tiene registrado que rechaza este móvil' using errcode='55000';
  end if;
  if d.status<>'available' and t.driver_id is distinct from d.id then
    raise exception 'El móvil no está disponible' using errcode='55000';
  end if;
  if d.operation_mode <> 'traditional' and not exists (
    select 1 from public.driver_presence_sessions s
    where s.driver_id=d.id and s.ended_at is null and s.last_seen_at > now()-interval '4 minutes'
  ) then
    raise exception 'El móvil figura disponible, pero su app no está conectada. Pídele al conductor abrir Central GO y vuelve a intentar.' using errcode='55000';
  end if;
  if exists(
    select 1 from public.trips x
    where x.driver_id=d.id and x.id<>t.id and x.status in ('assigned','en_route','arrived','in_progress')
  ) then
    raise exception 'El móvil ya tiene una carrera activa' using errcode='55000';
  end if;

  previous_driver:=t.driver_id;
  if previous_driver is not null and previous_driver<>d.id then
    update public.drivers set status='available' where id=previous_driver;
  end if;

  if d.operation_mode='traditional' then
    update public.trips
    set driver_id=d.id,
        driver_unit_number=d.unit_number,
        driver_name=d.display_name,
        status='en_route',
        assigned_at=coalesce(assigned_at,now()),
        en_route_at=coalesce(en_route_at,now()),
        offer_expires_at=null,
        dispatch_mode='manual',
        reserved_driver_id=null,
        reserved_driver_unit_number=null,
        reserved_driver_name=null,
        reservation_reason=null,
        version=version+1
    where id=t.id
    returning * into result_trip;

    update public.drivers set status='en_route' where id=d.id;
    perform public.centralgo_write_audit(
      t.company_id,
      'ASIGNACION_TRADICIONAL_CONFIRMADA',
      format('La operadora confirmó por radio o teléfono la carrera %s para el móvil %s',t.code,d.unit_number),
      jsonb_build_object('tripId',t.id,'driverId',d.id,'operationMode','traditional')
    );
    return result_trip;
  end if;

  update public.trips set
    status='pending',
    driver_id=null,
    driver_unit_number=null,
    driver_name=null,
    offer_expires_at=null,
    dispatch_mode='manual',
    reserved_driver_id=null,
    reserved_driver_unit_number=null,
    reserved_driver_name=null,
    reservation_reason=null,
    offered_driver_ids=array_remove(coalesce(offered_driver_ids,'{}'::uuid[]),d.id)
  where id=t.id;

  result_trip:=public.centralgo_internal_assign_offer(t.id,d.id,'Asignación manual de operadora');
  return result_trip;
end;
$$;

create or replace function public.centralgo_operator_unassign_trip(p_trip_id uuid, p_reason text default null)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  current_trip public.trips%rowtype;
  result_trip public.trips%rowtype;
  clean_reason text:=nullif(trim(coalesce(p_reason,'')),'');
begin
  select * into current_trip from public.trips where id=p_trip_id for update;
  if not found then raise exception 'Carrera no encontrada' using errcode='P0002'; end if;
  if not public.centralgo_has_company_role(current_trip.company_id,array['company_admin','operator']::public.centralgo_company_role[]) then
    raise exception 'Sin permiso para modificar esta carrera' using errcode='42501';
  end if;
  if current_trip.status in ('completed','cancelled','in_progress') then
    raise exception 'La carrera ya no puede volver a pendientes' using errcode='55000';
  end if;

  -- Already pending and driverless means the stale retry is fully satisfied.
  if current_trip.status='pending' and current_trip.driver_id is null then
    return current_trip;
  end if;

  if current_trip.driver_id is not null then
    update public.drivers set status='available' where id=current_trip.driver_id;

    insert into public.notifications(company_id,recipient_user_id,title,message,type,read,related_id)
    select current_trip.company_id,d.user_id,'Carrera retirada',
           case when clean_reason is null
             then 'La central retiró esta carrera de tu móvil. Ya no debes dirigirte al servicio.'
             else concat('La central retiró esta carrera de tu móvil. Motivo: ',clean_reason)
           end,
           'warning',false,current_trip.id
      from public.drivers d
     where d.id=current_trip.driver_id and d.user_id is not null;
  end if;

  update public.trips set
    status='pending',
    dispatch_mode='manual',
    driver_id=null,
    driver_unit_number=null,
    driver_name=null,
    vehicle_id=null,
    vehicle_unit_number=null,
    vehicle_plate=null,
    reserved_driver_id=null,
    reserved_driver_unit_number=null,
    reserved_driver_name=null,
    reservation_reason=null,
    assigned_at=null,
    offer_expires_at=null,
    en_route_at=null,
    arrived_at=null,
    started_at=null,
    notes=case when clean_reason is null then notes else concat_ws(' | ',nullif(notes,''),clean_reason) end,
    version=version+1
  where id=current_trip.id
  returning * into result_trip;

  return result_trip;
end;
$$;

create or replace function public.centralgo_operator_cancel_trip_v2(p_trip_id uuid, p_reason text, p_source text default 'operator')
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  current_trip public.trips%rowtype;
  result_trip public.trips%rowtype;
  event_kind text;
  source_label text;
begin
  select * into current_trip from public.trips where id=p_trip_id for update;
  if not found then raise exception 'Carrera no encontrada' using errcode='P0002'; end if;
  if not public.centralgo_has_company_role(current_trip.company_id,array['company_admin','operator']::public.centralgo_company_role[]) then
    raise exception 'Sin permiso para cancelar esta carrera' using errcode='42501';
  end if;

  -- Cancellation is idempotent: a repeated request returns the already-closed row.
  if current_trip.status='cancelled' then return current_trip; end if;
  if current_trip.status='completed' then raise exception 'La carrera ya está finalizada' using errcode='55000'; end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Debes indicar el motivo de cancelación' using errcode='22023'; end if;

  p_source:=case when p_source='client' then 'client' else 'operator' end;
  event_kind:=case when p_source='client' then 'client_cancelled' else 'operator_cancelled' end;
  source_label:=case when p_source='client' then 'El cliente canceló la carrera.' else 'La central canceló la carrera.' end;

  if current_trip.driver_id is not null then
    update public.drivers
       set status='available',
           dispatch_priority_credit=dispatch_priority_credit+case when p_source='client' then 1 else 0 end
     where id=current_trip.driver_id;

    insert into public.trip_dispatch_events(company_id,trip_id,driver_id,event_type,reason,created_by)
    values(current_trip.company_id,current_trip.id,current_trip.driver_id,event_kind,trim(p_reason),auth.uid());

    insert into public.notifications(company_id,recipient_user_id,title,message,type,read,related_id)
    select current_trip.company_id,d.user_id,'Carrera cancelada',
           concat(source_label,' Motivo: ',trim(p_reason)),'warning',false,current_trip.id
      from public.drivers d
     where d.id=current_trip.driver_id and d.user_id is not null;
  end if;

  update public.trips
     set status='cancelled',cancelled_at=now(),cancel_reason=trim(p_reason),cancel_source=p_source,version=version+1
   where id=current_trip.id
   returning * into result_trip;

  return result_trip;
end;
$$;

revoke all on function public.centralgo_operator_assign_trip(uuid,uuid) from public,anon;
revoke all on function public.centralgo_operator_unassign_trip(uuid,text) from public,anon;
revoke all on function public.centralgo_operator_cancel_trip_v2(uuid,text,text) from public,anon;
grant execute on function public.centralgo_operator_assign_trip(uuid,uuid) to authenticated;
grant execute on function public.centralgo_operator_unassign_trip(uuid,text) to authenticated;
grant execute on function public.centralgo_operator_cancel_trip_v2(uuid,text,text) to authenticated;
