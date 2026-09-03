create or replace function public.centralgo_dispatch_due_work()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  member record;
  processed integer := 0;
  old_driver uuid;
begin
  -- Availability and queue ownership live in Postgres. A missing browser
  -- heartbeat must never disconnect an available driver. Only an explicit
  -- status change can make the driver offline.
  --
  -- Pause is different: it preserves the driver's saved slot for at most
  -- 15 minutes. Once that limit expires, the driver loses that slot, moves to
  -- the tail and becomes OFFLINE so every client renders the row in red.
  update public.driver_presence_sessions s
  set last_seen_at=greatest(clock_timestamp(),s.started_at),
      ended_at=greatest(clock_timestamp(),s.started_at)
  where s.ended_at is null
    and exists (
      select 1
      from public.drivers d
      where d.id=s.driver_id
        and d.archived_at is null
        and d.service_enabled
        and d.status='paused'
        and d.service_control_updated_at < clock_timestamp()-interval '15 minutes'
    );

  with expired as (
    select
      d.id,
      d.company_id,
      row_number() over(
        partition by d.company_id
        order by d.service_control_updated_at asc,d.id asc
      )::bigint as tail_offset
    from public.drivers d
    where d.archived_at is null
      and d.service_enabled
      and d.status='paused'
      and d.service_control_updated_at < clock_timestamp()-interval '15 minutes'
  ), company_tail as (
    select company_id,coalesce(max(dispatch_queue_order),0)::bigint as max_order
    from public.drivers
    where archived_at is null
    group by company_id
  )
  update public.drivers d
  set status='offline'::public.centralgo_driver_status,
      sos_active=false,
      dispatch_queue_order=company_tail.max_order+expired.tail_offset,
      dispatch_queue_updated_at=clock_timestamp(),
      service_control_updated_at=clock_timestamp(),
      updated_at=clock_timestamp()
  from expired
  join company_tail on company_tail.company_id=expired.company_id
  where d.id=expired.id;

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
    update public.trips set reservation_alerted_at=now()
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
        rec.company_id,member.user_id,'RESERVA EN 10 MINUTOS',
        format(
          '%s · %s · retiro %s. %s',rec.client_name,
          to_char(rec.scheduled_for at time zone 'America/Santiago','HH24:MI'),
          rec.origin_address,
          case when rec.dispatch_mode='automatic'
            then 'Despacho automático activado.'
            else 'Asignación manual pendiente.' end
        ),
        'warning',false,rec.id
      );
    end loop;
    processed:=processed+1;
  end loop;

  for rec in
    select id,driver_id,dispatch_mode
    from public.trips
    where status='assigned'
      and offer_expires_at is not null
      and offer_expires_at<=now()
    order by offer_expires_at asc
    limit 50
    for update skip locked
  loop
    old_driver:=rec.driver_id;
    update public.trips
    set status='pending',
        dispatch_mode=rec.dispatch_mode,
        offered_driver_ids=case when old_driver is null then offered_driver_ids else array_append(coalesce(offered_driver_ids,'{}'::uuid[]),old_driver) end,
        driver_id=null,driver_unit_number=null,driver_name=null,assigned_at=null,offer_expires_at=null,
        notes=concat_ws(' | ',nullif(notes,''),'Oferta vencida: sin respuesta en 15 s'),
        version=version+1
    where id=rec.id and status='assigned';

    if old_driver is not null then
      update public.drivers set status='available' where id=old_driver;
    end if;

    if rec.dispatch_mode='automatic' then
      perform public.centralgo_internal_dispatch_trip(rec.id);
    end if;
    processed:=processed+1;
  end loop;

  for rec in
    select id from public.trips
    where status='pending'
      and dispatch_mode='automatic'
      and driver_id is null
      and (scheduled_for is null or scheduled_for<=now()+interval '10 minutes')
    order by coalesce(scheduled_for,created_at) asc
    limit 100
    for update skip locked
  loop
    perform public.centralgo_internal_dispatch_trip(rec.id);
    processed:=processed+1;
  end loop;

  return processed;
end;
$$;
