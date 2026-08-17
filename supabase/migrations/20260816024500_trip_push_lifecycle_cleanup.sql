-- Central GO: clean up driver Push notifications when an offer is accepted,
-- withdrawn, reassigned, expires, or is cancelled.
create or replace function public.centralgo_notify_driver_push()
returns trigger
language plpgsql
security definer
set search_path=public,extensions
as $function$
declare
  secret_value text;
  function_url text := 'https://cuazdzsvgwrnpczbvrgx.supabase.co/functions/v1/push-driver-trip';
  old_driver uuid;
  new_driver uuid;
begin
  select value into secret_value
  from public.centralgo_private_settings
  where key='push_internal_secret';
  if secret_value is null then return new; end if;

  if tg_op='INSERT' then
    if new.driver_id is null or new.status<>'assigned' then return new; end if;
    perform net.http_post(
      url:=function_url,
      headers:=jsonb_build_object('Content-Type','application/json','x-centralgo-push-secret',secret_value),
      body:=jsonb_build_object('tripId',new.id,'driverId',new.driver_id),
      timeout_milliseconds:=5000
    );
    return new;
  end if;

  old_driver:=old.driver_id;
  new_driver:=new.driver_id;

  -- Clear the old driver's persistent notification whenever an unanswered offer
  -- leaves assigned state or is reassigned to another driver.
  if old_driver is not null
     and old.status='assigned'
     and (new.status<>'assigned' or new_driver is distinct from old_driver) then
    perform net.http_post(
      url:=function_url,
      headers:=jsonb_build_object('Content-Type','application/json','x-centralgo-push-secret',secret_value),
      body:=jsonb_build_object('tripId',new.id,'driverId',old_driver),
      timeout_milliseconds:=5000
    );
  end if;

  -- A cancellation can happen after the driver already accepted the trip, so it
  -- also needs an explicit silent cancellation Push to the assigned driver.
  if new.status='cancelled'
     and old.status is distinct from 'cancelled'
     and new_driver is not null
     and not (old.status='assigned' and old_driver is not null) then
    perform net.http_post(
      url:=function_url,
      headers:=jsonb_build_object('Content-Type','application/json','x-centralgo-push-secret',secret_value),
      body:=jsonb_build_object('tripId',new.id,'driverId',new_driver),
      timeout_milliseconds:=5000
    );
  end if;

  -- New or reassigned offers must notify only the new driver.
  if new.status='assigned'
     and new_driver is not null
     and (old.status is distinct from 'assigned' or new_driver is distinct from old_driver) then
    perform net.http_post(
      url:=function_url,
      headers:=jsonb_build_object('Content-Type','application/json','x-centralgo-push-secret',secret_value),
      body:=jsonb_build_object('tripId',new.id,'driverId',new_driver),
      timeout_milliseconds:=5000
    );
  end if;

  return new;
exception when others then
  raise warning 'Central GO push lifecycle failed to queue for trip %: %',new.id,sqlerrm;
  return new;
end;
$function$;

revoke all on function public.centralgo_notify_driver_push() from public,anon,authenticated;
