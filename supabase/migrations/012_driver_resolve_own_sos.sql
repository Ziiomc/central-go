create or replace function public.centralgo_driver_resolve_own_sos(p_notes text default 'Alerta desactivada por el conductor')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_driver public.drivers%rowtype;
begin
  select d.* into target_driver from public.drivers d
  where d.user_id=auth.uid() order by d.updated_at desc limit 1 for update;
  if not found then raise exception 'Conductor autenticado no encontrado' using errcode='42501'; end if;

  update public.sos_events
  set resolved_at=coalesce(resolved_at,now()), resolved_by=coalesce(resolved_by,auth.uid()),
      resolution_notes=coalesce(resolution_notes,nullif(trim(coalesce(p_notes,'')),''))
  where driver_id=target_driver.id and resolved_at is null;

  update public.drivers set sos_active=false, sos_timestamp=null,
    status=case when status='sos' then 'available'::public.centralgo_driver_status else status end
  where id=target_driver.id;

  insert into public.notifications(company_id,recipient_user_id,title,message,type,related_id)
  select target_driver.company_id,m.user_id,'SOS desactivado por conductor',
         format('%s (%s) informó fin de la alerta SOS',target_driver.unit_number,target_driver.display_name),
         'info',target_driver.id
  from public.company_memberships m
  where m.company_id=target_driver.company_id and m.active and m.role in ('company_admin','operator');
end;
$$;

revoke all on function public.centralgo_driver_resolve_own_sos(text) from public,anon;
grant execute on function public.centralgo_driver_resolve_own_sos(text) to authenticated;
