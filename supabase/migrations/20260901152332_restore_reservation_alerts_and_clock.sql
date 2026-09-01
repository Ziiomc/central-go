-- Restore the reservation warning removed when the dispatcher function was
-- replaced, and expose a safe authenticated server clock for UI synchronization.

alter table public.trips
  add column if not exists reservation_alerted_at timestamptz;

create index if not exists idx_trips_reservation_alert_due
  on public.trips(company_id,scheduled_for)
  where status='pending' and scheduled_for is not null and reservation_alerted_at is null;

create or replace function public.centralgo_server_time()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $function$
  select clock_timestamp();
$function$;

revoke all on function public.centralgo_server_time() from public, anon;
grant execute on function public.centralgo_server_time() to authenticated;

create or replace function public.centralgo_dispatch_due_work()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  rec record;
  member record;
  processed integer := 0;
  old_driver uuid;
begin
  -- Notify each active central member exactly once when pickup is 10 minutes away.
  for rec in
    select t.id,t.company_id,t.code,t.client_name,t.origin_address,t.scheduled_for,t.dispatch_mode
    from public.trips t
    where t.status='pending'
      and t.scheduled_for is not null
      and t.reservation_alerted_at is null
      and t.scheduled_for <= now()+interval '10 minutes'
      and t.scheduled_for > now()-interval '30 minutes'
    order by t.scheduled_for asc
    limit 100
    for update skip locked
  loop
    update public.trips
      set reservation_alerted_at=now()
      where id=rec.id and reservation_alerted_at is null;

    for member in
      select cm.user_id
      from public.company_memberships cm
      where cm.company_id=rec.company_id
        and cm.active
        and cm.role in ('company_admin','operator')
    loop
      insert into public.notifications(company_id,recipient_user_id,title,message,type,read,related_id)
      values(
        rec.company_id,
        member.user_id,
        'RESERVA EN 10 MINUTOS',
        format(
          '%s · %s · retiro %s. %s',
          rec.client_name,
          to_char(rec.scheduled_for at time zone 'America/Santiago','HH24:MI'),
          rec.origin_address,
          case when rec.dispatch_mode='automatic'
            then 'Despacho automático activado.'
            else 'Asignación manual pendiente.' end
        ),
        'warning',false,rec.id
      );
    end loop;
    processed := processed+1;
  end loop;

  -- Preserve the current 15-second offer retry behavior.
  for rec in
    select id,driver_id from public.trips
    where status='assigned' and offer_expires_at is not null and offer_expires_at <= now()
    order by offer_expires_at asc limit 50
    for update skip locked
  loop
    old_driver := rec.driver_id;
    update public.trips set
      status='pending',
      dispatch_mode='automatic',
      offered_driver_ids=case when old_driver is null then offered_driver_ids else array_append(coalesce(offered_driver_ids,'{}'::uuid[]),old_driver) end,
      driver_id=null,driver_unit_number=null,driver_name=null,assigned_at=null,offer_expires_at=null,
      notes=concat_ws(' | ',nullif(notes,''),'Oferta vencida: sin respuesta en 15 s'),version=version+1
    where id=rec.id and status='assigned';
    if old_driver is not null then update public.drivers set status='available' where id=old_driver; end if;
    perform public.centralgo_internal_dispatch_trip(rec.id);
    processed := processed+1;
  end loop;

  -- Preserve the current ten-minute automatic reservation dispatch window.
  for rec in
    select id from public.trips
    where status='pending' and dispatch_mode='automatic' and driver_id is null
      and (scheduled_for is null or scheduled_for <= now()+interval '10 minutes')
    order by coalesce(scheduled_for,created_at) asc limit 100
    for update skip locked
  loop
    perform public.centralgo_internal_dispatch_trip(rec.id);
    processed := processed+1;
  end loop;
  return processed;
end;
$function$;

revoke all on function public.centralgo_dispatch_due_work() from public, anon, authenticated;
grant execute on function public.centralgo_dispatch_due_work() to service_role;
