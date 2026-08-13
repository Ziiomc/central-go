-- Central GO: scheduled rides, predictive reservations and offer rotation.
-- Supabase provides pg_cron. Plain PostgreSQL used by CI does not, so the
-- scheduling layer is enabled only when the extension is available; all
-- dispatch functions and security tests still run in either environment.
do $centralgo_extension$
begin
  if exists(select 1 from pg_available_extensions where name='pg_cron') then
    execute 'create extension if not exists pg_cron';
  end if;
end;
$centralgo_extension$;

alter table public.trips
  add column if not exists scheduled_for timestamptz,
  add column if not exists dispatch_mode text not null default 'automatic',
  add column if not exists offer_expires_at timestamptz,
  add column if not exists offer_attempt integer not null default 0,
  add column if not exists offered_driver_ids uuid[] not null default '{}'::uuid[],
  add column if not exists reserved_driver_id uuid references public.drivers(id) on delete set null,
  add column if not exists reserved_driver_unit_number text,
  add column if not exists reserved_driver_name text,
  add column if not exists reservation_reason text;

alter table public.trips drop constraint if exists trips_dispatch_mode_check;
alter table public.trips add constraint trips_dispatch_mode_check check (dispatch_mode in ('automatic','manual'));

create index if not exists trips_scheduled_for_idx on public.trips(company_id,scheduled_for) where status='pending' and scheduled_for is not null;
create index if not exists trips_offer_expiry_idx on public.trips(offer_expires_at) where status='assigned' and offer_expires_at is not null;
create index if not exists trips_reserved_driver_idx on public.trips(reserved_driver_id) where status='pending' and reserved_driver_id is not null;
create index if not exists driver_radio_messages_sender_user_idx on public.driver_radio_messages(sender_user_id);

create or replace function public.centralgo_km_distance(lat1 double precision,lng1 double precision,lat2 double precision,lng2 double precision)
returns double precision
language sql immutable parallel safe
set search_path=''
as $$
 select case when lat1 is null or lng1 is null or lat2 is null or lng2 is null then 9999::double precision else
  6371*2*asin(sqrt(power(sin(radians(lat2-lat1)/2),2)+cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lng2-lng1)/2),2))) end;
$$;

create or replace function public.centralgo_internal_assign_offer(p_trip_id uuid,p_driver_id uuid,p_reason text default 'Despacho automático')
returns public.trips language plpgsql security definer set search_path=public as $$
declare t public.trips%rowtype; d public.drivers%rowtype; result_trip public.trips%rowtype;
begin
 select * into t from public.trips where id=p_trip_id for update;
 if not found or t.status<>'pending' then return t; end if;
 if t.scheduled_for is not null and t.scheduled_for>now()+interval '2 minutes' then return t; end if;
 select * into d from public.drivers where id=p_driver_id for update;
 if not found or d.company_id<>t.company_id or d.status<>'available' or d.sos_active then return t; end if;
 if d.id=any(coalesce(t.offered_driver_ids,'{}'::uuid[])) then return t; end if;
 if exists(select 1 from public.trips x where x.driver_id=d.id and x.id<>t.id and x.status in ('assigned','en_route','arrived','in_progress')) then return t; end if;
 update public.trips set driver_id=d.id,driver_unit_number=d.unit_number,driver_name=d.display_name,
  reserved_driver_id=null,reserved_driver_unit_number=null,reserved_driver_name=null,reservation_reason=null,
  status='assigned',assigned_at=now(),offer_expires_at=now()+interval '15 seconds',offer_attempt=offer_attempt+1,
  en_route_at=null,arrived_at=null,started_at=null,version=version+1
 where id=t.id returning * into result_trip;
 update public.drivers set status='en_route' where id=d.id;
 if d.user_id is not null then
  insert into public.notifications(company_id,recipient_user_id,title,message,type,read,related_id)
  values(t.company_id,d.user_id,'NUEVA CARRERA',concat('Retiro: ',t.origin_address,' → ',t.destination_address,'. Tienes 15 segundos para aceptar.'),'trip',false,t.id);
 end if;
 return result_trip;
end;$$;

create or replace function public.centralgo_internal_dispatch_trip(p_trip_id uuid)
returns public.trips language plpgsql security definer set search_path=public as $$
declare
 t public.trips%rowtype; reserved public.drivers%rowtype; free_driver public.drivers%rowtype; busy_driver public.drivers%rowtype;
 free_distance double precision:=9999; busy_score double precision:=9999; busy_remaining double precision:=9999; minutes_until_pickup double precision:=0;
begin
 select * into t from public.trips where id=p_trip_id for update;
 if not found or t.status<>'pending' or t.dispatch_mode<>'automatic' then return t; end if;
 if t.scheduled_for is not null then minutes_until_pickup:=greatest(0,extract(epoch from(t.scheduled_for-now()))/60.0); end if;
 if t.reserved_driver_id is not null then
  select * into reserved from public.drivers where id=t.reserved_driver_id;
  if found and reserved.status='available' and not reserved.sos_active and (t.scheduled_for is null or t.scheduled_for<=now()+interval '2 minutes') then
   return public.centralgo_internal_assign_offer(t.id,reserved.id,'Móvil predictivo liberado cerca del retiro');
  elsif not found or reserved.status in ('paused','offline','sos') then
   update public.trips set reserved_driver_id=null,reserved_driver_unit_number=null,reserved_driver_name=null,reservation_reason=null where id=t.id returning * into t;
  end if;
 end if;
 select d.* into free_driver from public.drivers d left join public.driver_locations l on l.driver_id=d.id
 where d.company_id=t.company_id and d.status='available' and not d.sos_active
  and not(d.id=any(coalesce(t.offered_driver_ids,'{}'::uuid[])))
  and not exists(select 1 from public.trips x where x.driver_id=d.id and x.status in ('assigned','en_route','arrived','in_progress'))
 order by public.centralgo_km_distance(l.lat,l.lng,t.origin_lat,t.origin_lng),d.rating desc limit 1;
 if found then select public.centralgo_km_distance(l.lat,l.lng,t.origin_lat,t.origin_lng) into free_distance from public.driver_locations l where l.driver_id=free_driver.id; free_distance:=coalesce(free_distance,9999); end if;
 select d.* into busy_driver from public.drivers d join public.trips active on active.driver_id=d.id and active.status='in_progress'
 where d.company_id=t.company_id and not d.sos_active and not(d.id=any(coalesce(t.offered_driver_ids,'{}'::uuid[])))
  and not exists(select 1 from public.trips r where r.reserved_driver_id=d.id and r.id<>t.id and r.status='pending')
  and greatest(0,coalesce(active.estimated_duration_mins,0)-extract(epoch from(now()-coalesce(active.started_at,now())))/60.0)<=case when t.scheduled_for is null then 7 else greatest(7,minutes_until_pickup+2) end
 order by public.centralgo_km_distance(active.destination_lat,active.destination_lng,t.origin_lat,t.origin_lng)+greatest(0,coalesce(active.estimated_duration_mins,0)-extract(epoch from(now()-coalesce(active.started_at,now())))/60.0)*0.18,d.rating desc limit 1;
 if found then
  select greatest(0,coalesce(active.estimated_duration_mins,0)-extract(epoch from(now()-coalesce(active.started_at,now())))/60.0),
   public.centralgo_km_distance(active.destination_lat,active.destination_lng,t.origin_lat,t.origin_lng)+greatest(0,coalesce(active.estimated_duration_mins,0)-extract(epoch from(now()-coalesce(active.started_at,now())))/60.0)*0.18
  into busy_remaining,busy_score from public.trips active where active.driver_id=busy_driver.id and active.status='in_progress' limit 1;
 end if;
 if busy_driver.id is not null and ((t.scheduled_for is not null and busy_remaining<=minutes_until_pickup+2 and busy_score<free_distance+1.0) or (t.scheduled_for is null and busy_remaining<=5 and busy_score+0.8<free_distance)) then
  update public.trips set reserved_driver_id=busy_driver.id,reserved_driver_unit_number=busy_driver.unit_number,reserved_driver_name=busy_driver.display_name,reservation_reason=concat('Predicción: termina a ',round(busy_score::numeric,1),' km equivalentes del retiro') where id=t.id returning * into t; return t;
 end if;
 if t.scheduled_for is not null and t.scheduled_for>now()+interval '2 minutes' then return t; end if;
 if free_driver.id is not null then return public.centralgo_internal_assign_offer(t.id,free_driver.id,'Móvil libre más conveniente'); end if;
 if busy_driver.id is not null then update public.trips set reserved_driver_id=busy_driver.id,reserved_driver_unit_number=busy_driver.unit_number,reserved_driver_name=busy_driver.display_name,reservation_reason='Próximo móvil a liberarse cerca del retiro' where id=t.id returning * into t; end if;
 return t;
end;$$;

create or replace function public.centralgo_dispatch_due_work()
returns integer language plpgsql security definer set search_path=public as $$
declare rec record; processed integer:=0; old_driver uuid;
begin
 for rec in select id,driver_id from public.trips where status='assigned' and offer_expires_at is not null and offer_expires_at<=now() order by offer_expires_at asc limit 50 for update skip locked loop
  old_driver:=rec.driver_id;
  update public.trips set status='pending',dispatch_mode='automatic',offered_driver_ids=case when old_driver is null then offered_driver_ids else array_append(coalesce(offered_driver_ids,'{}'::uuid[]),old_driver) end,
   driver_id=null,driver_unit_number=null,driver_name=null,assigned_at=null,offer_expires_at=null,notes=concat_ws(' | ',nullif(notes,''),'Oferta vencida: sin respuesta en 15 s'),version=version+1 where id=rec.id and status='assigned';
  if old_driver is not null then update public.drivers set status='available' where id=old_driver; end if;
  perform public.centralgo_internal_dispatch_trip(rec.id); processed:=processed+1;
 end loop;
 for rec in select id from public.trips where status='pending' and dispatch_mode='automatic' and (scheduled_for is null or scheduled_for<=now()+interval '2 minutes' or reserved_driver_id is not null) order by coalesce(scheduled_for,created_at) asc limit 100 for update skip locked loop
  perform public.centralgo_internal_dispatch_trip(rec.id); processed:=processed+1;
 end loop;
 return processed;
end;$$;

create or replace function public.centralgo_operator_auto_dispatch_trip(p_trip_id uuid)
returns public.trips language plpgsql security definer set search_path=public as $$
declare t public.trips%rowtype;
begin
 select * into t from public.trips where id=p_trip_id for update;
 if not found then raise exception 'Carrera no encontrada' using errcode='P0002'; end if;
 if not public.centralgo_has_company_role(t.company_id,array['company_admin','operator']::public.centralgo_company_role[]) then raise exception 'Sin permiso para despachar esta central' using errcode='42501'; end if;
 if t.status<>'pending' then raise exception 'La carrera ya no está disponible para despacho automático' using errcode='55000'; end if;
 update public.trips set dispatch_mode='automatic',reserved_driver_id=null,reserved_driver_unit_number=null,reserved_driver_name=null,reservation_reason=null where id=t.id;
 return public.centralgo_internal_dispatch_trip(t.id);
end;$$;

create or replace function public.centralgo_operator_assign_trip(p_trip_id uuid,p_driver_id uuid)
returns public.trips language plpgsql security definer set search_path=public as $$
declare t public.trips%rowtype; d public.drivers%rowtype; result_trip public.trips%rowtype; previous_driver uuid;
begin
 select * into t from public.trips where id=p_trip_id for update;
 if not found then raise exception 'Carrera no encontrada' using errcode='P0002'; end if;
 if not public.centralgo_has_company_role(t.company_id,array['company_admin','operator']::public.centralgo_company_role[]) then raise exception 'Sin permiso para despachar esta central' using errcode='42501'; end if;
 if t.status in('completed','cancelled','in_progress') then raise exception 'La carrera ya no puede asignarse' using errcode='55000'; end if;
 if t.scheduled_for is not null and t.scheduled_for>now()+interval '10 minutes' then raise exception 'La carrera está agendada para más adelante' using errcode='55000'; end if;
 select * into d from public.drivers where id=p_driver_id for update;
 if not found or d.company_id<>t.company_id then raise exception 'Móvil inválido para esta central' using errcode='22023'; end if;
 if d.status<>'available' and t.driver_id is distinct from d.id then raise exception 'El móvil no está disponible' using errcode='55000'; end if;
 if exists(select 1 from public.trips x where x.driver_id=d.id and x.id<>t.id and x.status in('assigned','en_route','arrived','in_progress')) then raise exception 'El móvil ya tiene una carrera activa' using errcode='55000'; end if;
 previous_driver:=t.driver_id; if previous_driver is not null and previous_driver<>d.id then update public.drivers set status='available' where id=previous_driver; end if;
 update public.trips set status='pending',driver_id=null,driver_unit_number=null,driver_name=null,offer_expires_at=null,dispatch_mode='manual',reserved_driver_id=null,reserved_driver_unit_number=null,reserved_driver_name=null,reservation_reason=null where id=t.id;
 result_trip:=public.centralgo_internal_assign_offer(t.id,d.id,'Asignación manual de operadora'); return result_trip;
end;$$;

create or replace function public.centralgo_driver_reject_trip(p_trip_id uuid,p_reason text default 'Rechazado por conductor')
returns public.trips language plpgsql security definer set search_path=public as $$
declare t public.trips%rowtype; own_driver uuid; result_trip public.trips%rowtype;
begin
 select * into t from public.trips where id=p_trip_id for update;
 if not found then raise exception 'Carrera no encontrada' using errcode='P0002'; end if;
 own_driver:=public.centralgo_driver_id_for_user(t.company_id);
 if own_driver is null or t.driver_id is distinct from own_driver then raise exception 'Esta oferta no pertenece al conductor autenticado' using errcode='42501'; end if;
 if t.status<>'assigned' then raise exception 'La oferta ya no está pendiente de respuesta' using errcode='55000'; end if;
 update public.trips set status='pending',dispatch_mode='automatic',offered_driver_ids=array_append(coalesce(offered_driver_ids,'{}'::uuid[]),own_driver),driver_id=null,driver_unit_number=null,driver_name=null,assigned_at=null,offer_expires_at=null,version=version+1,notes=concat_ws(' | ',nullif(notes,''),left(coalesce(nullif(trim(p_reason),''),'Rechazado por conductor'),240)) where id=t.id returning * into result_trip;
 update public.drivers set status='available' where id=own_driver;
 result_trip:=public.centralgo_internal_dispatch_trip(result_trip.id); return result_trip;
end;$$;

create or replace function public.centralgo_driver_transition_trip(p_trip_id uuid,p_new_status public.centralgo_trip_status)
returns public.trips language plpgsql security definer set search_path=public as $$
declare t public.trips%rowtype; own_driver uuid; result_trip public.trips%rowtype; next_trip record;
begin
 select * into t from public.trips where id=p_trip_id for update;
 if not found then raise exception 'Carrera no encontrada' using errcode='P0002'; end if;
 own_driver:=public.centralgo_driver_id_for_user(t.company_id);
 if own_driver is null or t.driver_id is distinct from own_driver then raise exception 'Esta carrera no pertenece al conductor autenticado' using errcode='42501'; end if;
 if not((t.status='assigned' and p_new_status='en_route') or(t.status='en_route' and p_new_status='arrived') or(t.status='arrived' and p_new_status='in_progress') or(t.status='in_progress' and p_new_status='completed')) then raise exception 'Transición de carrera inválida: % -> %',t.status,p_new_status using errcode='22023'; end if;
 if t.status='assigned' and p_new_status='en_route' and t.offer_expires_at is not null and t.offer_expires_at<now() then raise exception 'La oferta ya venció y será reasignada' using errcode='55000'; end if;
 update public.trips set status=p_new_status,offer_expires_at=case when p_new_status='en_route' then null else offer_expires_at end,en_route_at=case when p_new_status='en_route' then coalesce(en_route_at,now()) else en_route_at end,arrived_at=case when p_new_status='arrived' then coalesce(arrived_at,now()) else arrived_at end,started_at=case when p_new_status='in_progress' then coalesce(started_at,now()) else started_at end,completed_at=case when p_new_status='completed' then coalesce(completed_at,now()) else completed_at end,final_fare=case when p_new_status='completed' then coalesce(final_fare,estimated_fare) else final_fare end,version=version+1 where id=t.id returning * into result_trip;
 update public.drivers set status=case when p_new_status in('en_route','arrived') then 'en_route'::public.centralgo_driver_status when p_new_status='in_progress' then 'in_trip'::public.centralgo_driver_status when p_new_status='completed' then 'available'::public.centralgo_driver_status else status end,total_trips_completed=case when p_new_status='completed' then total_trips_completed+1 else total_trips_completed end,today_earnings=case when p_new_status='completed' then today_earnings+coalesce(result_trip.final_fare,result_trip.estimated_fare) else today_earnings end where id=own_driver;
 if p_new_status='completed' then select id into next_trip from public.trips where status='pending' and dispatch_mode='automatic' and reserved_driver_id=own_driver and(scheduled_for is null or scheduled_for<=now()+interval '2 minutes') order by coalesce(scheduled_for,created_at) limit 1; if found then perform public.centralgo_internal_dispatch_trip(next_trip.id); end if; end if;
 return result_trip;
end;$$;

create or replace function public.centralgo_trip_auto_dispatch_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin if new.status='pending' and new.dispatch_mode='automatic' and new.driver_id is null then perform public.centralgo_internal_dispatch_trip(new.id); end if; return new; end;$$;

drop trigger if exists centralgo_trip_auto_dispatch_after_insert on public.trips;
create trigger centralgo_trip_auto_dispatch_after_insert after insert on public.trips for each row execute function public.centralgo_trip_auto_dispatch_trigger();

revoke all on function public.centralgo_internal_assign_offer(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.centralgo_internal_dispatch_trip(uuid) from public,anon,authenticated;
revoke all on function public.centralgo_dispatch_due_work() from public,anon,authenticated;
revoke all on function public.centralgo_trip_auto_dispatch_trigger() from public,anon,authenticated;
revoke all on function public.centralgo_operator_auto_dispatch_trip(uuid) from public,anon;
grant execute on function public.centralgo_operator_auto_dispatch_trip(uuid) to authenticated;
grant execute on function public.centralgo_operator_assign_trip(uuid,uuid) to authenticated;
grant execute on function public.centralgo_driver_reject_trip(uuid,text) to authenticated;
grant execute on function public.centralgo_driver_transition_trip(uuid,public.centralgo_trip_status) to authenticated;

do $centralgo_schedule$
begin
  if to_regnamespace('cron') is not null then
    execute $sql$select cron.unschedule(jobid) from cron.job where jobname='centralgo-dispatch-loop-v1'$sql$;
    execute $sql$select cron.schedule('centralgo-dispatch-loop-v1','5 seconds','select public.centralgo_dispatch_due_work();')$sql$;
  end if;
end;
$centralgo_schedule$;
