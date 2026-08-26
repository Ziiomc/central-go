-- Driver-visible scheduled reservations and private operator-to-driver voice radio.

DROP POLICY IF EXISTS trips_read_company ON public.trips;
CREATE POLICY trips_read_company ON public.trips
FOR SELECT TO authenticated
USING (
  public.centralgo_has_company_role(company_id,ARRAY['company_admin','operator']::public.centralgo_company_role[])
  OR EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.user_id=(SELECT auth.uid())
      AND d.company_id=trips.company_id
      AND d.archived_at IS NULL
      AND (d.id=trips.driver_id OR d.id=trips.reserved_driver_id)
  )
);

CREATE OR REPLACE FUNCTION public.centralgo_operator_reserve_scheduled_trip(p_trip_id uuid,p_driver_id uuid DEFAULT NULL)
RETURNS public.trips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t public.trips%rowtype;
  d public.drivers%rowtype;
  previous_driver uuid;
  result_trip public.trips%rowtype;
  schedule_text text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión' USING errcode='42501'; END IF;
  SELECT * INTO t FROM public.trips WHERE id=p_trip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva no encontrada' USING errcode='P0002'; END IF;
  IF NOT public.centralgo_has_company_role(t.company_id,ARRAY['company_admin','operator']::public.centralgo_company_role[]) THEN
    RAISE EXCEPTION 'Sin permiso para administrar reservas de esta central' USING errcode='42501';
  END IF;
  IF t.scheduled_for IS NULL THEN RAISE EXCEPTION 'Esta carrera no es una reserva programada' USING errcode='22023'; END IF;
  IF t.status<>'pending' THEN RAISE EXCEPTION 'La reserva ya está en proceso y no puede cambiar de móvil' USING errcode='55000'; END IF;
  IF t.scheduled_for < now()-interval '30 minutes' THEN RAISE EXCEPTION 'La hora de esta reserva ya pasó' USING errcode='55000'; END IF;

  previous_driver:=t.reserved_driver_id;
  IF p_driver_id IS NULL THEN
    UPDATE public.trips
       SET reserved_driver_id=NULL,reserved_driver_unit_number=NULL,reserved_driver_name=NULL,reservation_reason=NULL,version=version+1
     WHERE id=t.id RETURNING * INTO result_trip;
  ELSE
    SELECT * INTO d FROM public.drivers WHERE id=p_driver_id AND archived_at IS NULL FOR SHARE;
    IF NOT FOUND OR d.company_id<>t.company_id THEN RAISE EXCEPTION 'Móvil inválido para esta central' USING errcode='22023'; END IF;
    IF d.sos_active THEN RAISE EXCEPTION 'No puedes reservar un móvil con SOS activo' USING errcode='55000'; END IF;

    UPDATE public.trips
       SET reserved_driver_id=d.id,
           reserved_driver_unit_number=d.unit_number,
           reserved_driver_name=d.display_name,
           reservation_reason='Reserva confirmada por operadora',
           dispatch_mode='automatic',
           version=version+1
     WHERE id=t.id RETURNING * INTO result_trip;

    schedule_text:=to_char(t.scheduled_for AT TIME ZONE 'America/Santiago','DD/MM/YYYY HH24:MI');
    IF d.user_id IS NOT NULL AND previous_driver IS DISTINCT FROM d.id THEN
      INSERT INTO public.notifications(company_id,recipient_user_id,title,message,type,read,related_id)
      VALUES(t.company_id,d.user_id,'RESERVA ASIGNADA',concat('Reserva ',t.code,' · ',schedule_text,' · Retiro: ',t.origin_address),'trip',false,t.id);
    END IF;
  END IF;

  IF previous_driver IS NOT NULL AND previous_driver IS DISTINCT FROM p_driver_id THEN
    INSERT INTO public.notifications(company_id,recipient_user_id,title,message,type,read,related_id)
    SELECT t.company_id,old_driver.user_id,'RESERVA REASIGNADA',concat('La reserva ',t.code,' ya no está asignada a tu móvil.'),'warning',false,t.id
    FROM public.drivers old_driver WHERE old_driver.id=previous_driver AND old_driver.user_id IS NOT NULL;
  END IF;

  PERFORM public.centralgo_write_audit(
    t.company_id,
    CASE WHEN p_driver_id IS NULL THEN 'QUITAR_MOVIL_RESERVA' ELSE 'RESERVAR_MOVIL' END,
    CASE WHEN p_driver_id IS NULL
      THEN format('Quitó el móvil reservado de %s',t.code)
      ELSE format('Reservó %s (%s) para %s',d.unit_number,d.display_name,t.code)
    END,
    jsonb_build_object('tripId',t.id,'driverId',p_driver_id,'scheduledFor',t.scheduled_for)
  );
  RETURN result_trip;
END;
$function$;

REVOKE ALL ON FUNCTION public.centralgo_operator_reserve_scheduled_trip(uuid,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.centralgo_operator_reserve_scheduled_trip(uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.centralgo_operator_reserve_scheduled_trip(uuid,uuid) TO authenticated;

DROP POLICY IF EXISTS centralgo_radio_company_read ON realtime.messages;
CREATE POLICY centralgo_radio_company_read ON realtime.messages
FOR SELECT TO authenticated
USING (
  extension='broadcast'
  AND EXISTS (
    SELECT 1 FROM public.companies c
    WHERE realtime.topic()='centralgo-radio:'||c.id::text
      AND (
        public.centralgo_has_company_role(c.id,ARRAY['company_admin','operator']::public.centralgo_company_role[])
        OR public.centralgo_driver_id_for_user(c.id) IS NOT NULL
      )
  )
);

DROP POLICY IF EXISTS centralgo_radio_operator_write ON realtime.messages;
CREATE POLICY centralgo_radio_operator_write ON realtime.messages
FOR INSERT TO authenticated
WITH CHECK (
  extension='broadcast'
  AND EXISTS (
    SELECT 1 FROM public.companies c
    WHERE realtime.topic()='centralgo-radio:'||c.id::text
      AND public.centralgo_has_company_role(c.id,ARRAY['company_admin','operator']::public.centralgo_company_role[])
  )
);
