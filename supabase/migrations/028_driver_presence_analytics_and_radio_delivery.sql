create table if not exists public.driver_presence_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint driver_presence_time_order check (ended_at is null or ended_at >= started_at)
);

create index if not exists idx_driver_presence_driver_started on public.driver_presence_sessions(driver_id, started_at desc);
create index if not exists idx_driver_presence_company_active on public.driver_presence_sessions(company_id, ended_at, last_seen_at desc);

alter table public.driver_presence_sessions enable row level security;
revoke all on public.driver_presence_sessions from anon, authenticated;

drop policy if exists driver_presence_read_own_or_ops on public.driver_presence_sessions;
create policy driver_presence_read_own_or_ops
on public.driver_presence_sessions
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.centralgo_has_company_role(company_id, array['company_admin'::public.centralgo_company_role, 'operator'::public.centralgo_company_role])
  or public.centralgo_is_super_admin()
);

grant select on public.driver_presence_sessions to authenticated;

create or replace function public.centralgo_driver_presence_ping(target_company uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  own_driver uuid;
  session_id uuid;
begin
  own_driver := public.centralgo_driver_id_for_user(target_company);
  if own_driver is null then
    raise exception 'Conductor no vinculado a esta central' using errcode = '42501';
  end if;

  update public.driver_presence_sessions
  set ended_at = last_seen_at
  where driver_id = own_driver
    and ended_at is null
    and last_seen_at < now() - interval '4 minutes';

  select id into session_id
  from public.driver_presence_sessions
  where driver_id = own_driver
    and ended_at is null
  order by started_at desc
  limit 1
  for update;

  if session_id is null then
    insert into public.driver_presence_sessions(company_id, driver_id, user_id)
    values (target_company, own_driver, auth.uid())
    returning id into session_id;
  else
    update public.driver_presence_sessions
    set last_seen_at = now()
    where id = session_id;
  end if;

  return session_id;
end;
$function$;

create or replace function public.centralgo_driver_presence_end(target_company uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  own_driver uuid;
begin
  own_driver := public.centralgo_driver_id_for_user(target_company);
  if own_driver is null then return; end if;

  update public.driver_presence_sessions
  set last_seen_at = now(), ended_at = now()
  where driver_id = own_driver and ended_at is null;
end;
$function$;

create or replace function public.centralgo_driver_analytics(
  target_company uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  own_driver uuid;
  connected_seconds numeric := 0;
  driving_seconds numeric := 0;
  km_service numeric := 0;
  trips_completed integer := 0;
  earnings numeric := 0;
  avg_trip_seconds numeric := 0;
begin
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'Rango de analítica inválido' using errcode = '22023';
  end if;

  own_driver := public.centralgo_driver_id_for_user(target_company);
  if own_driver is null then
    raise exception 'Conductor no vinculado a esta central' using errcode = '42501';
  end if;

  select coalesce(sum(greatest(0, extract(epoch from (
    least(
      coalesce(s.ended_at,
        case when s.last_seen_at > now() - interval '4 minutes' then now() else s.last_seen_at end),
      p_to
    ) - greatest(s.started_at, p_from)
  )))),0)
  into connected_seconds
  from public.driver_presence_sessions s
  where s.driver_id = own_driver
    and s.started_at < p_to
    and coalesce(s.ended_at, s.last_seen_at) > p_from;

  select
    coalesce(sum(greatest(0, extract(epoch from (
      least(coalesce(t.completed_at, t.cancelled_at, now()), p_to) - greatest(t.started_at, p_from)
    )))),0),
    coalesce(sum(case when t.completed_at >= p_from and t.completed_at < p_to then t.estimated_distance_km else 0 end),0),
    count(*) filter (where t.completed_at >= p_from and t.completed_at < p_to),
    coalesce(sum(case when t.completed_at >= p_from and t.completed_at < p_to then coalesce(t.final_fare, t.estimated_fare, 0) else 0 end),0),
    coalesce(avg(extract(epoch from (t.completed_at - t.started_at))) filter (where t.completed_at >= p_from and t.completed_at < p_to and t.started_at is not null),0)
  into driving_seconds, km_service, trips_completed, earnings, avg_trip_seconds
  from public.trips t
  where t.driver_id = own_driver
    and t.started_at is not null
    and t.started_at < p_to
    and coalesce(t.completed_at, t.cancelled_at, now()) > p_from;

  return jsonb_build_object(
    'driver_id', own_driver,
    'from', p_from,
    'to', p_to,
    'connected_seconds', round(connected_seconds),
    'driving_seconds', round(driving_seconds),
    'service_km', round(km_service, 1),
    'trips_completed', trips_completed,
    'earnings', round(earnings),
    'avg_trip_seconds', round(avg_trip_seconds),
    'distance_source', 'completed_trip_estimates'
  );
end;
$function$;

revoke all on function public.centralgo_driver_presence_ping(uuid) from public;
revoke all on function public.centralgo_driver_presence_end(uuid) from public;
revoke all on function public.centralgo_driver_analytics(uuid,timestamptz,timestamptz) from public;
grant execute on function public.centralgo_driver_presence_ping(uuid) to authenticated;
grant execute on function public.centralgo_driver_presence_end(uuid) to authenticated;
grant execute on function public.centralgo_driver_analytics(uuid,timestamptz,timestamptz) to authenticated;
