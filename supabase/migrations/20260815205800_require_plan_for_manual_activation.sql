-- Central GO · impide activaciones manuales ambiguas.
-- Toda activación debe pasar por centralgo_superadmin_manual_subscription,
-- donde el Superadmin selecciona plan, modalidad, frecuencia de pago y oferta.

create or replace function public.centralgo_superadmin_set_company_status(p_company_id uuid, p_status public.centralgo_subscription_status)
returns public.centralgo_subscription_status
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.centralgo_is_super_admin() then
    raise exception 'Solo Superadmin puede cambiar el estado comercial de una central' using errcode='42501';
  end if;

  if p_status='active' then
    raise exception 'Para activar una central debes seleccionar plan y modalidad desde Planes y suscripciones' using errcode='22023';
  end if;

  update public.subscriptions
  set status=p_status,updated_at=now()
  where company_id=p_company_id;
  if not found then raise exception 'Suscripción no encontrada' using errcode='P0002'; end if;

  update public.companies
  set active=(p_status in ('trialing','past_due')),updated_at=now()
  where id=p_company_id;

  return p_status;
end;
$$;
