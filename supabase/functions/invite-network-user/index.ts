import { createClient } from 'jsr:@supabase/supabase-js@2';

const OFFICIAL_APP_URL = 'https://central-go-one.vercel.app/';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const safeRedirect = (value?: string) => {
  try {
    if (value) {
      const url = new URL(value);
      const allowed = url.protocol === 'https:' && (
        url.hostname === 'central-go-one.vercel.app' ||
        url.hostname === 'centralgo.app' ||
        url.hostname.endsWith('.centralgo.app')
      );
      if (allowed) return url.toString();
    }
  } catch { /* use official fallback */ }
  return OFFICIAL_APP_URL;
};

const buildDirectActivationUrl = (redirectTo: string, tokenHash: string, type: 'recovery' | 'invite' = 'recovery') => {
  const activation = new URL(redirectTo);
  activation.searchParams.set('token_hash', tokenHash);
  activation.searchParams.set('type', type);
  activation.searchParams.set('source', 'partner_activation');
  return activation.toString();
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'Sesión requerida' }, 401);
    const body = await req.json().catch(() => null) as {
      email?: string; name?: string; kind?: 'regional' | 'sales'; code?: string; commissionPercent?: number;
      parentPartnerId?: string | null; countryCode?: string; region?: string; city?: string; redirectTo?: string;
      delivery?: 'email' | 'whatsapp';
    } | null;
    const email = body?.email?.trim().toLowerCase();
    const name = body?.name?.trim() ?? '';
    const kind = body?.kind;
    const code = body?.code?.trim().toUpperCase();
    const delivery = body?.delivery === 'whatsapp' ? 'whatsapp' : 'email';
    if (!email || !email.includes('@') || !name || !kind || !['regional','sales'].includes(kind) || !code || code.length < 2) return json({ error: 'Nombre, correo, tipo y código son obligatorios' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, detectSessionInUrl: false } });
    const { data: callerData, error: callerError } = await userClient.auth.getUser();
    if (callerError || !callerData.user) return json({ error: 'Sesión inválida' }, 401);
    const { data: callerProfile } = await service.from('profiles').select('global_role,active').eq('id', callerData.user.id).maybeSingle();
    if (!callerProfile?.active || callerProfile.global_role !== 'super_admin') return json({ error: 'Solo Superadmin puede crear partners' }, 403);

    if (kind === 'sales' && body?.parentPartnerId) {
      const { data: parent } = await service.from('partners').select('id,kind,active,archived_at').eq('id', body.parentPartnerId).maybeSingle();
      if (!parent?.active || parent.kind !== 'regional' || parent.archived_at) return json({ error: 'El responsable regional seleccionado no es válido' }, 400);
    }

    let targetUser: any = null;
    for (let page = 1; page <= 10 && !targetUser; page += 1) {
      const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      targetUser = data.users.find((item) => item.email?.toLowerCase() === email) ?? null;
      if (data.users.length < 1000) break;
    }

    const { data: codeOwner, error: codeError } = await service.from('partners').select('id,user_id').eq('code', code).is('archived_at', null).maybeSingle();
    if (codeError) throw codeError;
    if (codeOwner && (!targetUser || codeOwner.user_id !== targetUser.id)) return json({ error: `El código ${code} ya pertenece a otro Partner.` }, 409);

    // Fail before changing metadata or sending a recovery link when an existing
    // address belongs to a company account or another Superadmin.
    if (targetUser) {
      const [{ data: targetProfile }, { data: membership }, { data: driver }, { data: saas }] = await Promise.all([
        service.from('profiles').select('global_role').eq('id', targetUser.id).maybeSingle(),
        service.from('company_memberships').select('id').eq('user_id', targetUser.id).eq('active', true).limit(1).maybeSingle(),
        service.from('drivers').select('id').eq('user_id', targetUser.id).is('archived_at', null).limit(1).maybeSingle(),
        service.from('saas_accounts').select('account_kind').eq('user_id', targetUser.id).maybeSingle(),
      ]);
      if (targetProfile?.global_role === 'super_admin') return json({ error: 'Ese correo ya pertenece a un Superadmin. Usa una cuenta independiente para el Partner.' }, 409);
      if (membership || driver || ['central','driver'].includes(String(saas?.account_kind ?? ''))) return json({ error: 'Ese correo pertenece a una cuenta operativa de una central. Usa un correo independiente para el Partner.' }, 409);
    }

    let invited = false;
    let activationUrl: string | null = null;
    const redirectTo = safeRedirect(body?.redirectTo);

    if (delivery === 'whatsapp') {
      if (!targetUser) {
        const { data, error } = await service.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { name, needs_password_setup: true, activation_delivery: 'whatsapp' },
        });
        if (error) throw error;
        targetUser = data.user;
        invited = true;
      } else {
        const { data, error } = await service.auth.admin.updateUserById(targetUser.id, {
          user_metadata: { ...(targetUser.user_metadata ?? {}), name, needs_password_setup: true, activation_delivery: 'whatsapp' },
        });
        if (error) throw error;
        targetUser = data.user;
      }
    } else if (!targetUser) {
      const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
        data: { name, needs_password_setup: true },
        redirectTo,
      });
      if (error) throw error;
      targetUser = data.user;
      invited = true;
    }
    if (!targetUser) return json({ error: 'No fue posible crear el usuario del partner' }, 500);

    // Ensure the profile exists, but never assign the global role with service
    // role here. The authenticated RPC below is the single source of truth.
    const { error: profileBootstrapError } = await service.from('profiles').upsert({ id: targetUser.id, name, active: true }, { onConflict: 'id' });
    if (profileBootstrapError) throw profileBootstrapError;

    const normalizedCommission = kind === 'regional' ? 50 : 20;
    const { data: partnerId, error: partnerCreateError } = await userClient.rpc('centralgo_superadmin_create_partner', {
      p_email: email,
      p_kind: kind,
      p_code: code,
      p_commission_percent: normalizedCommission,
      p_parent_partner_id: kind === 'sales' ? (body?.parentPartnerId || null) : null,
    });
    if (partnerCreateError) {
      const status = partnerCreateError.code === '23514' ? 409 : partnerCreateError.code === '42501' ? 403 : 400;
      return json({ error: partnerCreateError.message }, status);
    }

    const { error: profileNameError } = await service.from('profiles').update({ name, updated_at: new Date().toISOString() }).eq('id', targetUser.id);
    if (profileNameError) throw profileNameError;

    const { data: partner, error: partnerError } = await service.from('partners').select('id,commission_percent').eq('id', partnerId).single();
    if (partnerError || !partner) throw partnerError ?? new Error('No fue posible cargar el Partner creado');

    if (body?.countryCode) {
      const territory = {
        partner_id: partner.id,
        country_code: body.countryCode.toUpperCase().slice(0,2),
        region: body.region?.trim() || null,
        city: body.city?.trim() || null,
        exclusive: kind === 'regional',
      };
      const territoryQuery = service.from('partner_territories').select('id').eq('partner_id', partner.id).eq('country_code', territory.country_code);
      const { data: existingTerritories, error: territoryReadError } = await territoryQuery;
      if (territoryReadError) throw territoryReadError;
      const existingTerritory = (existingTerritories ?? []).find((item: any) => true);
      if (!existingTerritory) {
        const { error: territoryError } = await service.from('partner_territories').insert(territory);
        if (territoryError) throw territoryError;
      }
    }

    if (delivery === 'whatsapp') {
      const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
      });
      if (linkError) throw linkError;
      const tokenHash = linkData?.properties?.hashed_token;
      if (!tokenHash) throw new Error('No fue posible generar el token de activación');
      activationUrl = buildDirectActivationUrl(redirectTo, tokenHash, 'recovery');
    }

    const message = delivery === 'whatsapp'
      ? 'Partner configurado. Enlace privado de activación generado directamente en Central GO.'
      : (invited ? 'Partner creado e invitación enviada' : 'Partner configurado sobre una cuenta existente');
    return json({ ok: true, partnerId: partner.id, userId: targetUser.id, invited, delivery, activationUrl, redirectTo, commissionPercent: Number(partner.commission_percent), message });
  } catch (error) {
    console.error('invite-network-user', error instanceof Error ? error.message : 'unknown');
    return json({ error: error instanceof Error ? error.message : 'No fue posible crear el partner' }, 500);
  }
});
