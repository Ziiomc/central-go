-- Preserve the production rule in source control: 20% commission and a
-- suggested (not blocking) three-hour review window for the primary admin.

alter table public.partner_applications
  add column if not exists referred_by_partner_id uuid
  references public.partners(id) on delete set null;

create index if not exists partner_applications_referred_by_partner_idx
  on public.partner_applications(referred_by_partner_id);

create or replace function public.centralgo_superadmin_review_partner_application(
  p_application_id uuid,
  p_approve boolean,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  application_row public.partner_applications%rowtype;
  generated_code text;
  new_partner_id uuid;
  parent_regional_id uuid;
  is_primary_approver boolean:=false;
begin
  select exists(
    select 1
    from auth.users u
    join public.profiles p on p.id=u.id
    where u.id=auth.uid()
      and lower(u.email)=lower('ziiomc3@gmail.com')
      and p.active
      and p.global_role='super_admin'
  ) into is_primary_approver;

  if auth.uid() is null or not is_primary_approver then
    raise exception 'Solo ziiomc3@gmail.com puede revisar socios comerciales' using errcode='42501';
  end if;

  select * into application_row
  from public.partner_applications
  where id=p_application_id
  for update;
  if not found then raise exception 'Solicitud no encontrada' using errcode='P0002'; end if;
  if application_row.status<>'pending' then
    raise exception 'Esta solicitud ya fue revisada' using errcode='55000';
  end if;

  if not p_approve then
    update public.partner_applications
    set status='rejected',
        rejection_reason=left(nullif(trim(coalesce(p_rejection_reason,'')),''),240),
        reviewed_by=auth.uid(),
        reviewed_at=now()
    where id=application_row.id;
    update public.saas_accounts
    set status='cancelled',updated_at=now()
    where user_id=application_row.user_id and account_kind='sales_partner';
    return jsonb_build_object('status','rejected','applicationId',application_row.id);
  end if;

  select p.id into parent_regional_id
  from public.partners p
  where p.id=application_row.referred_by_partner_id and p.kind='regional' and p.active
  limit 1;

  loop
    generated_code:='CGP-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    exit when not exists(select 1 from public.partners p where p.code=generated_code);
  end loop;

  update public.profiles set global_role='sales_partner',updated_at=now()
  where id=application_row.user_id;

  insert into public.partners(user_id,kind,code,commission_percent,parent_partner_id,active)
  values(application_row.user_id,'sales',generated_code,20,parent_regional_id,true)
  on conflict(user_id) do update
  set kind='sales',commission_percent=20,parent_partner_id=excluded.parent_partner_id,active=true,updated_at=now()
  returning id into new_partner_id;

  update public.saas_accounts
  set status='active',activated_at=now(),current_period_end=null,updated_at=now()
  where user_id=application_row.user_id and account_kind='sales_partner';

  update public.partner_applications
  set status='approved',rejection_reason=null,reviewed_by=auth.uid(),reviewed_at=now(),partner_id=new_partner_id
  where id=application_row.id;

  return jsonb_build_object(
    'status','approved','applicationId',application_row.id,'partnerId',new_partner_id,
    'partnerCode',(select code from public.partners where id=new_partner_id),
    'commissionPercent',20,'regionalPartnerId',parent_regional_id,
    'approvedBy','ziiomc3@gmail.com',
    'approvedBeforeSuggestedWait',now()<application_row.eligible_review_at,
    'suggestedReviewAt',application_row.eligible_review_at
  );
end;
$function$;

revoke all on function public.centralgo_superadmin_review_partner_application(uuid,boolean,text)
  from public,anon,authenticated;
grant execute on function public.centralgo_superadmin_review_partner_application(uuid,boolean,text)
  to authenticated,service_role;
