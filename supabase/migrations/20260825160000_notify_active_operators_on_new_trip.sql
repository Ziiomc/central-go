create or replace function public.centralgo_notify_active_operators_on_new_trip()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.notifications(company_id,recipient_user_id,title,message,type,related_id)
  select
    new.company_id,
    cm.user_id,
    'NUEVA CARRERA',
    coalesce(new.origin_address,'Origen sin dirección') || ' → ' || coalesce(new.destination_address,'Destino a convenir'),
    'trip',
    new.id
  from public.company_memberships cm
  where cm.company_id=new.company_id
    and cm.active=true
    and cm.role in ('operator','company_admin')
    and cm.user_id is distinct from new.operator_user_id;
  return new;
end;
$$;

drop trigger if exists trg_centralgo_notify_active_operators_new_trip on public.trips;
create trigger trg_centralgo_notify_active_operators_new_trip
after insert on public.trips
for each row execute function public.centralgo_notify_active_operators_on_new_trip();
