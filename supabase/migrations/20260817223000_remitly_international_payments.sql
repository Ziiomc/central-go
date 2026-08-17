-- Central GO · Remitly international payments.
-- Remitly is handled as a manual verification payment method because there is no
-- public checkout/webhook integration equivalent to Mercado Pago for this flow.

create table if not exists public.platform_manual_payment_methods (
  id text primary key,
  enabled boolean not null default false,
  display_name text not null,
  recipient_name text,
  pay_tag text,
  destination_label text,
  payment_url text,
  website_url text,
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists platform_manual_payment_methods_touch on public.platform_manual_payment_methods;
create trigger platform_manual_payment_methods_touch
before update on public.platform_manual_payment_methods
for each row execute function public.centralgo_touch_updated_at();

insert into public.platform_manual_payment_methods(
  id,enabled,display_name,recipient_name,pay_tag,destination_label,payment_url,website_url,instructions
) values (
  'remitly',true,'Remitly','Nevenka Marin','@nevenkam2361','BancoEstado •••• 6218',null,
  'https://www.remitly.com/cl/es/receive-money',
  'Realiza el pago en Remitly por el monto indicado y luego adjunta el comprobante en Central GO. La activación ocurre únicamente después de la revisión del Administrador Global.'
)
on conflict(id) do update set
  display_name=excluded.display_name,
  recipient_name=coalesce(public.platform_manual_payment_methods.recipient_name,excluded.recipient_name),
  pay_tag=coalesce(public.platform_manual_payment_methods.pay_tag,excluded.pay_tag),
  destination_label=coalesce(public.platform_manual_payment_methods.destination_label,excluded.destination_label),
  website_url=coalesce(public.platform_manual_payment_methods.website_url,excluded.website_url),
  instructions=coalesce(public.platform_manual_payment_methods.instructions,excluded.instructions),
  updated_at=now();

create table if not exists public.manual_payment_requests (
  id uuid primary key default gen_random_uuid(),
  invoice_code text not null unique,
  user_id uuid not null references public.profiles(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  plan_code text not null,
  billing_cycle public.centralgo_billing_cycle not null,
  amount_clp integer not null check (amount_clp > 0),
  currency text not null default 'CLP' check (currency='CLP'),
  payment_method text not null default 'remitly' check (payment_method='remitly'),
  status text not null default 'pending' check (status in ('pending','payment_sent','approved','rejected','cancelled')),
  sender_reference text,
  proof_path text,
  customer_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manual_payment_requests_company_status_idx
  on public.manual_payment_requests(company_id,status,created_at desc);
create index if not exists manual_payment_requests_review_queue_idx
  on public.manual_payment_requests(status,submitted_at desc)
  where status='payment_sent';
create index if not exists manual_payment_requests_user_idx
  on public.manual_payment_requests(user_id,created_at desc);

drop trigger if exists manual_payment_requests_touch on public.manual_payment_requests;
create trigger manual_payment_requests_touch
before update on public.manual_payment_requests
for each row execute function public.centralgo_touch_updated_at();

alter table public.platform_manual_payment_methods enable row level security;
alter table public.manual_payment_requests enable row level security;

drop policy if exists manual_payment_requests_read_own on public.manual_payment_requests;
create policy manual_payment_requests_read_own
on public.manual_payment_requests for select to authenticated
using (user_id=(select auth.uid()) or (select public.centralgo_is_super_admin()));

revoke all on table public.platform_manual_payment_methods from public,anon,authenticated;
revoke all on table public.manual_payment_requests from public,anon,authenticated;
grant select on table public.manual_payment_requests to authenticated;

-- Private bucket for payment evidence. Uploads are restricted to the user's own folder.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'remitly-payment-proofs','remitly-payment-proofs',false,6291456,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists remitly_payment_proofs_insert_own on storage.objects;
create policy remitly_payment_proofs_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id='remitly-payment-proofs'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

drop policy if exists remitly_payment_proofs_read_authorized on storage.objects;
create policy remitly_payment_proofs_read_authorized
on storage.objects for select to authenticated
using (
  bucket_id='remitly-payment-proofs'
  and (
    owner_id=(select auth.uid())::text
    or (select public.centralgo_is_super_admin())
  )
);

create or replace function public.centralgo_remitly_payment_config()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  cfg public.platform_manual_payment_methods%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión' using errcode='42501';
  end if;

  select * into cfg from public.platform_manual_payment_methods where id='remitly';
  if not found then
    return jsonb_build_object('enabled',false,'displayName','Remitly');
  end if;

  return jsonb_build_object(
    'enabled',cfg.enabled,
    'displayName',cfg.display_name,
    'recipientName',cfg.recipient_name,
    'payTag',cfg.pay_tag,
    'destinationLabel',cfg.destination_label,
    'paymentUrl',cfg.payment_url,
    'websiteUrl',cfg.website_url,
    'instructions',cfg.instructions
  );
end;
$$;

create or replace function public.centralgo_superadmin_set_remitly_payment_config(
  p_enabled boolean,
  p_recipient_name text,
  p_pay_tag text,
  p_destination_label text,
  p_payment_url text default null,
  p_instructions text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  url text := nullif(trim(coalesce(p_payment_url,'')),'');
begin
  if auth.uid() is null or not public.centralgo_is_super_admin() then
    raise exception 'Solo Superadmin puede configurar Remitly' using errcode='42501';
  end if;
  if length(trim(coalesce(p_recipient_name,'')))<2 then raise exception 'Nombre del receptor inválido' using errcode='22023'; end if;
  if length(trim(coalesce(p_pay_tag,'')))<2 then raise exception 'Pay Tag inválido' using errcode='22023'; end if;
  if url is not null and url !~* '^https://' then raise exception 'El enlace Remitly debe usar HTTPS' using errcode='22023'; end if;

  insert into public.platform_manual_payment_methods(
    id,enabled,display_name,recipient_name,pay_tag,destination_label,payment_url,website_url,instructions
  ) values (
    'remitly',coalesce(p_enabled,false),'Remitly',trim(p_recipient_name),trim(p_pay_tag),
    nullif(trim(coalesce(p_destination_label,'')),''),url,'https://www.remitly.com/cl/es/receive-money',
    nullif(trim(coalesce(p_instructions,'')),'')
  )
  on conflict(id) do update set
    enabled=excluded.enabled,
    recipient_name=excluded.recipient_name,
    pay_tag=excluded.pay_tag,
    destination_label=excluded.destination_label,
    payment_url=excluded.payment_url,
    website_url=excluded.website_url,
    instructions=excluded.instructions,
    updated_at=now();

  return public.centralgo_remitly_payment_config();
end;
$$;

create or replace function public.centralgo_create_remitly_payment_request(
  p_company_id uuid,
  p_plan_code text,
  p_billing_cycle public.centralgo_billing_cycle
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  cfg public.platform_manual_payment_methods%rowtype;
  plan public.subscription_plans%rowtype;
  req public.manual_payment_requests%rowtype;
  amount integer;
  code text;
begin
  if uid is null then raise exception 'Debes iniciar sesión' using errcode='42501'; end if;
  if not public.centralgo_is_super_admin() and not exists(
    select 1 from public.company_memberships m
    where m.company_id=p_company_id and m.user_id=uid and m.role='company_admin' and m.active
  ) then
    raise exception 'Solo la administración de la central puede iniciar este pago' using errcode='42501';
  end if;

  select * into cfg from public.platform_manual_payment_methods where id='remitly';
  if not found or not cfg.enabled then raise exception 'Remitly no está habilitado como método de pago' using errcode='55000'; end if;

  select * into plan from public.subscription_plans
  where code=lower(trim(coalesce(p_plan_code,''))) and active limit 1;
  if not found then raise exception 'Plan no disponible' using errcode='P0002'; end if;

  amount := case when p_billing_cycle='annual' then plan.annual_price_clp else plan.monthly_price_clp end;
  if amount is null or amount<=0 then raise exception 'El plan no tiene un valor válido' using errcode='22023'; end if;

  select * into req
  from public.manual_payment_requests r
  where r.company_id=p_company_id and r.payment_method='remitly' and r.status in ('pending','payment_sent')
  order by r.created_at desc limit 1 for update;

  if found and req.status='payment_sent' then
    return jsonb_build_object(
      'requestId',req.id,'invoiceCode',req.invoice_code,'status',req.status,'companyId',req.company_id,
      'planCode',req.plan_code,'billingCycle',req.billing_cycle::text,'amountClp',req.amount_clp,'currency',req.currency,
      'senderReference',req.sender_reference,'proofPath',req.proof_path,'createdAt',req.created_at,'submittedAt',req.submitted_at,
      'config',public.centralgo_remitly_payment_config()
    );
  end if;

  if found and req.plan_code=plan.code and req.billing_cycle=p_billing_cycle then
    return jsonb_build_object(
      'requestId',req.id,'invoiceCode',req.invoice_code,'status',req.status,'companyId',req.company_id,
      'planCode',req.plan_code,'billingCycle',req.billing_cycle::text,'amountClp',req.amount_clp,'currency',req.currency,
      'senderReference',req.sender_reference,'proofPath',req.proof_path,'createdAt',req.created_at,'submittedAt',req.submitted_at,
      'config',public.centralgo_remitly_payment_config()
    );
  elsif found then
    update public.manual_payment_requests set status='cancelled',updated_at=now() where id=req.id;
  end if;

  loop
    code := 'CG-RM-' || to_char(now(),'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    exit when not exists(select 1 from public.manual_payment_requests r where r.invoice_code=code);
  end loop;

  insert into public.manual_payment_requests(
    invoice_code,user_id,company_id,plan_id,plan_code,billing_cycle,amount_clp,currency,payment_method,status
  ) values (
    code,uid,p_company_id,plan.id,plan.code,p_billing_cycle,amount,'CLP','remitly','pending'
  ) returning * into req;

  perform public.centralgo_write_audit(
    p_company_id,'SOLICITUD_PAGO_REMITLY',format('Solicitud internacional %s creada para plan %s',req.invoice_code,plan.name)
  );

  return jsonb_build_object(
    'requestId',req.id,'invoiceCode',req.invoice_code,'status',req.status,'companyId',req.company_id,
    'planCode',req.plan_code,'planName',plan.name,'billingCycle',req.billing_cycle::text,'amountClp',req.amount_clp,
    'currency',req.currency,'createdAt',req.created_at,'config',public.centralgo_remitly_payment_config()
  );
end;
$$;

create or replace function public.centralgo_submit_remitly_payment_request(
  p_request_id uuid,
  p_sender_reference text,
  p_proof_path text,
  p_customer_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  req public.manual_payment_requests%rowtype;
  proof text := trim(coalesce(p_proof_path,''));
  reference text := trim(coalesce(p_sender_reference,''));
begin
  if uid is null then raise exception 'Debes iniciar sesión' using errcode='42501'; end if;
  select * into req from public.manual_payment_requests where id=p_request_id for update;
  if not found or req.user_id<>uid then raise exception 'Solicitud no disponible' using errcode='P0002'; end if;
  if req.status<>'pending' then raise exception 'Esta solicitud ya fue enviada o revisada' using errcode='55000'; end if;
  if length(reference)<3 then raise exception 'Ingresa la referencia o identificador de la transferencia' using errcode='22023'; end if;
  if proof='' or position(uid::text || '/' || req.id::text || '/' in proof)<>1 then
    raise exception 'Adjunta un comprobante válido' using errcode='22023';
  end if;
  if not exists(
    select 1 from storage.objects o
    where o.bucket_id='remitly-payment-proofs' and o.name=proof and o.owner_id=uid::text
  ) then
    raise exception 'No encontramos el comprobante cargado' using errcode='P0002';
  end if;

  update public.manual_payment_requests
  set status='payment_sent',sender_reference=left(reference,160),proof_path=proof,
      customer_notes=left(nullif(trim(coalesce(p_customer_notes,'')),''),500),submitted_at=now(),updated_at=now()
  where id=req.id
  returning * into req;

  perform public.centralgo_write_audit(
    req.company_id,'PAGO_REMITLY_ENVIADO',format('Comprobante recibido para %s; pendiente de validación global',req.invoice_code)
  );

  return jsonb_build_object('requestId',req.id,'invoiceCode',req.invoice_code,'status',req.status,'submittedAt',req.submitted_at);
end;
$$;

create or replace function public.centralgo_visible_remitly_payment_requests()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if auth.uid() is null or not public.centralgo_is_super_admin() then
    raise exception 'Solo Superadmin puede revisar pagos internacionales' using errcode='42501';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',r.id,'invoiceCode',r.invoice_code,'status',r.status,'companyId',r.company_id,'companyName',c.name,
      'companyCode',c.code,'userId',r.user_id,'userName',pr.name,'userEmail',au.email,'planCode',r.plan_code,
      'planName',sp.name,'billingCycle',r.billing_cycle::text,'amountClp',r.amount_clp,'currency',r.currency,
      'senderReference',r.sender_reference,'proofPath',r.proof_path,'customerNotes',r.customer_notes,
      'createdAt',r.created_at,'submittedAt',r.submitted_at,'reviewedAt',r.reviewed_at,'reviewNotes',r.review_notes
    ) order by case when r.status='payment_sent' then 0 else 1 end,coalesce(r.submitted_at,r.created_at) desc),'[]'::jsonb)
    from public.manual_payment_requests r
    join public.companies c on c.id=r.company_id
    join public.subscription_plans sp on sp.id=r.plan_id
    join public.profiles pr on pr.id=r.user_id
    left join auth.users au on au.id=r.user_id
    where r.payment_method='remitly' and r.status<>'cancelled'
  );
end;
$$;

create or replace function public.centralgo_superadmin_review_remitly_payment(
  p_request_id uuid,
  p_approve boolean,
  p_review_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  req public.manual_payment_requests%rowtype;
  activation jsonb;
  notes text := left(nullif(trim(coalesce(p_review_notes,'')),''),500);
begin
  if auth.uid() is null or not public.centralgo_is_super_admin() then
    raise exception 'Solo Superadmin puede validar pagos internacionales' using errcode='42501';
  end if;
  select * into req from public.manual_payment_requests where id=p_request_id for update;
  if not found or req.status<>'payment_sent' then raise exception 'Pago no disponible para revisión' using errcode='P0002'; end if;

  if not p_approve then
    update public.manual_payment_requests
    set status='rejected',reviewed_at=now(),reviewed_by=auth.uid(),review_notes=notes,updated_at=now()
    where id=req.id;
    perform public.centralgo_write_audit(req.company_id,'PAGO_REMITLY_RECHAZADO',format('Pago %s rechazado por Administrador Global',req.invoice_code));
    return jsonb_build_object('approved',false,'requestId',req.id,'invoiceCode',req.invoice_code,'status','rejected');
  end if;

  activation := public.centralgo_superadmin_manual_subscription(
    req.company_id,req.plan_code,req.billing_cycle,req.billing_cycle,0,
    'Pago internacional Remitly',
    concat('Factura ',req.invoice_code,' · referencia ',coalesce(req.sender_reference,'sin referencia'))
  );

  update public.manual_payment_requests
  set status='approved',reviewed_at=now(),reviewed_by=auth.uid(),review_notes=notes,updated_at=now()
  where id=req.id;

  perform public.centralgo_write_audit(req.company_id,'PAGO_REMITLY_APROBADO',format('Pago %s aprobado y suscripción activada',req.invoice_code));

  return jsonb_build_object(
    'approved',true,'requestId',req.id,'invoiceCode',req.invoice_code,'status','approved','activation',activation
  );
end;
$$;

revoke all on function public.centralgo_remitly_payment_config() from public,anon;
revoke all on function public.centralgo_superadmin_set_remitly_payment_config(boolean,text,text,text,text,text) from public,anon;
revoke all on function public.centralgo_create_remitly_payment_request(uuid,text,public.centralgo_billing_cycle) from public,anon;
revoke all on function public.centralgo_submit_remitly_payment_request(uuid,text,text,text) from public,anon;
revoke all on function public.centralgo_visible_remitly_payment_requests() from public,anon;
revoke all on function public.centralgo_superadmin_review_remitly_payment(uuid,boolean,text) from public,anon;

grant execute on function public.centralgo_remitly_payment_config() to authenticated;
grant execute on function public.centralgo_superadmin_set_remitly_payment_config(boolean,text,text,text,text,text) to authenticated;
grant execute on function public.centralgo_create_remitly_payment_request(uuid,text,public.centralgo_billing_cycle) to authenticated;
grant execute on function public.centralgo_submit_remitly_payment_request(uuid,text,text,text) to authenticated;
grant execute on function public.centralgo_visible_remitly_payment_requests() to authenticated;
grant execute on function public.centralgo_superadmin_review_remitly_payment(uuid,boolean,text) to authenticated;
