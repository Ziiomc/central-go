create or replace function public.centralgo_visible_commissions()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  viewer_partner uuid;
  viewer_kind public.centralgo_partner_kind;
  is_super boolean := public.centralgo_is_super_admin();
begin
  if not is_super then
    select id, kind into viewer_partner, viewer_kind
    from public.partners where user_id=auth.uid() and active limit 1;
    if viewer_partner is null then
      raise exception 'Sin permiso para visualizar comisiones' using errcode='42501';
    end if;
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', cl.id,
      'partnerId', cl.partner_id,
      'partnerName', pr.name,
      'partnerKind', p.kind::text,
      'companyId', cl.company_id,
      'companyName', c.name,
      'paymentId', cl.payment_id,
      'commissionType', cl.commission_type,
      'grossAmount', cl.gross_amount,
      'ratePercent', cl.rate_percent,
      'amount', cl.amount,
      'status', cl.status::text,
      'earnedAt', cl.earned_at,
      'availableAt', cl.available_at,
      'paidAt', cl.paid_at,
      'reversedAt', cl.reversed_at,
      'notes', cl.notes
    ) order by cl.earned_at desc), '[]'::jsonb)
    from public.commission_ledger cl
    join public.partners p on p.id=cl.partner_id
    join public.profiles pr on pr.id=p.user_id
    join public.companies c on c.id=cl.company_id
    where is_super
       or cl.partner_id=viewer_partner
       or (viewer_kind='regional' and p.parent_partner_id=viewer_partner)
  );
end;
$$;

revoke all on function public.centralgo_visible_commissions() from public,anon;
grant execute on function public.centralgo_visible_commissions() to authenticated;
