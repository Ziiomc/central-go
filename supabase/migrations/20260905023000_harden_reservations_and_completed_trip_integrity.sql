CREATE OR REPLACE FUNCTION public.centralgo_operator_reserve_scheduled_trip(p_trip_id uuid, p_driver_id uuid DEFAULT NULL::uuid)
RETURNS public.trips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  t public.trips%rowtype;
  d public.drivers%rowtype;
  previous_driver uuid;
  result_trip public.trips%rowtype;
  schedule_text text;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión' using errcode='42501'; end if;
  select * into t from public.trips where id=p_trip_id for update;
  if not found then raise exception 'Reserva no encontrada' using errcode='P0002'; end if;
  if not public.centralgo_has_company_role(t.company_id,array['company_admin','operator']::public.centralgo_company_role[]) then
    raise exception 'Sin permiso para administrar reservas de esta central' using errcode='42501';
  end if;
  if t.scheduled_for is null then raise exception 'Esta carrera no es una reserva programada' using errcode='22023'; end if;
  if t.status<>'pending' then raise exception 'La reserva ya está en proceso y no puede cambiar de móvil' using errcode='55000'; end if;
  if t.scheduled_for < now()-interval '30 minutes' then raise exception 'La hora de esta reserva ya pasó' using errcode='55000'; end if;

  previous_driver:=t.reserved_driver_id;
  if p_driver_id is null then
    update public.trips
       set reserved_driver_id=null,reserved_driver_unit_number=null,reserved_driver_name=null,reservation_reason=null,version=version+1
     where id=t.id returning * into result_trip;
  else
    select * into d from public.drivers where id=p_driver_id and archived_at is null for share;
    if not found or d.company_id<>t.company_id then raise exception 'Móvil inválido para esta central' using errcode='22023'; end if;
    if not coalesce(d.service_enabled,false) then raise exception 'No puedes reservar un móvil deshabilitado para servicio' using errcode='55000'; end if;
    if d.sos_active then raise exception 'No puedes reservar un móvil con SOS activo' using errcode='55000'; end if;

    update public.trips
       set reserved_driver_id=d.id,
           reserved_driver_unit_number=d.unit_number,
           reserved_driver_name=d.display_name,
           reservation_reason='Reserva confirmada por operadora',
           dispatch_mode='automatic',
           version=version+1
     where id=t.id returning * into result_trip;

    schedule_text:=to_char(t.scheduled_for at time zone 'America/Santiago','DD/MM/YYYY HH24:MI');
    if d.user_id is not null and previous_driver is distinct from d.id then
      insert into public.notifications(company_id,recipient_user_id,title,message,type,read,related_id)
      values(t.company_id,d.user_id,'RESERVA ASIGNADA',concat('Reserva ',t.code,' · ',schedule_text,' · Retiro: ',t.origin_address),'trip',false,t.id);
    end if;
  end if;

  if previous_driver is not null and previous_driver is distinct from p_driver_id then
    insert into public.notifications(company_id,recipient_user_id,title,message,type,read,related_id)
    select t.company_id,old_driver.user_id,'RESERVA REASIGNADA',concat('La reserva ',t.code,' ya no está asignada a tu móvil.'),'warning',false,t.id
    from public.drivers old_driver where old_driver.id=previous_driver and old_driver.user_id is not null;
  end if;

  perform public.centralgo_write_audit(
    t.company_id,
    case when p_driver_id is null then 'QUITAR_MOVIL_RESERVA' else 'RESERVAR_MOVIL' end,
    case when p_driver_id is null
      then format('Quitó el móvil reservado de %s',t.code)
      else format('Reservó %s (%s) para %s',d.unit_number,d.display_name,t.code)
    end,
    jsonb_build_object('tripId',t.id,'driverId',p_driver_id,'scheduledFor',t.scheduled_for)
  );
  return result_trip;
end;
$function$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.trips'::regclass
      AND conname='centralgo_completed_trip_integrity'
  ) THEN
    ALTER TABLE public.trips
      ADD CONSTRAINT centralgo_completed_trip_integrity
      CHECK (
        status <> 'completed'::public.centralgo_trip_status
        OR (completed_at IS NOT NULL AND final_fare IS NOT NULL)
      ) NOT VALID;
  END IF;
END
$migration$;