-- Prevent iOS PWA suspension/restart from immediately releasing a driver offer.
-- The UI countdown remains informational; the backend is the source of truth and
-- now allows a recovery window before the dispatch engine rotates the offer.

create or replace function public.centralgo_internal_assign_offer(
  p_trip_id uuid,
  p_driver_id uuid,
  p_reason text default 'Despacho automático'
)
returns public.trips
language plpgsql
security definer
set search_path=public
as $$
declare
  t public.trips%rowtype;
  d public.drivers%rowtype;
  result_trip public.trips%rowtype;
begin
  select * into t from public.trips where id=p_trip_id for update;
  if not found or t.status<>'pending' then return t; end if;
  if t.scheduled_for is not null and t.scheduled_for>now()+interval '2 minutes' then return t; end if;

  select * into d from public.drivers where id=p_driver_id for update;
  if not found or d.company_id<>t.company_id or d.status<>'available' or d.sos_active then return t; end if;
  if d.id=any(coalesce(t.offered_driver_ids,'{}'::uuid[])) then return t; end if;
  if exists(
    select 1 from public.trips x
    where x.driver_id=d.id and x.id<>t.id and x.status in ('assigned','en_route','arrived','in_progress')
  ) then return t; end if;

  update public.trips
  set driver_id=d.id,
      driver_unit_number=d.unit_number,
      driver_name=d.display_name,
      reserved_driver_id=null,
      reserved_driver_unit_number=null,
      reserved_driver_name=null,
      reservation_reason=null,
      status='assigned',
      assigned_at=now(),
      offer_expires_at=now()+interval '2 minutes',
      offer_attempt=offer_attempt+1,
      en_route_at=null,
      arrived_at=null,
      started_at=null,
      version=version+1
  where id=t.id
  returning * into result_trip;

  update public.drivers set status='en_route' where id=d.id;

  if d.user_id is not null then
    insert into public.notifications(company_id,recipient_user_id,title,message,type,read,related_id)
    values(
      t.company_id,
      d.user_id,
      'NUEVA CARRERA',
      concat('Retiro: ',t.origin_address,' → ',t.destination_address,'. Confirma la carrera. Si iPhone suspende la app, la oferta se conservará durante el margen de recuperación.'),
      'trip',
      false,
      t.id
    );
  end if;

  return result_trip;
end;
$$;

update public.trips
set offer_expires_at = now() + interval '2 minutes'
where status='assigned'
  and offer_expires_at is not null
  and offer_expires_at < now() + interval '2 minutes';
