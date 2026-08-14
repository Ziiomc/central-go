create or replace function public.centralgo_enqueue_dispatch_routing(p_trip_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  secret_value text;
  request_id bigint;
  trip_row public.trips%rowtype;
begin
  select * into trip_row from public.trips where id=p_trip_id;
  if not found or trip_row.status in ('completed','cancelled') then return false; end if;

  select value into secret_value
  from public.centralgo_private_settings
  where key='push_internal_secret';

  if secret_value is null then
    if trip_row.status='pending' and trip_row.dispatch_mode='automatic' then
      perform public.centralgo_internal_dispatch_trip(p_trip_id);
    end if;
    return false;
  end if;

  select net.http_post(
    url := 'https://cuazdzsvgwrnpczbvrgx.supabase.co/functions/v1/route-dispatch-matrix',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-centralgo-routing-secret',secret_value
    ),
    body := jsonb_build_object('tripId',p_trip_id),
    timeout_milliseconds := 3500
  ) into request_id;
  return request_id is not null;
exception when others then
  if trip_row.status='pending' and trip_row.dispatch_mode='automatic' then
    perform public.centralgo_internal_dispatch_trip(p_trip_id);
  end if;
  return false;
end;
$$;

revoke all on function public.centralgo_enqueue_dispatch_routing(uuid) from public, anon, authenticated;
grant execute on function public.centralgo_enqueue_dispatch_routing(uuid) to service_role;

create or replace function public.centralgo_trip_auto_dispatch_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status not in ('completed','cancelled') then
    perform public.centralgo_enqueue_dispatch_routing(new.id);
  end if;
  return new;
end;
$$;
