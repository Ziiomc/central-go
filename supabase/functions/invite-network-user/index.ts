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
    const commission = Number(body?.commissionPercent ?? (kind === 'regional' ? 5 : 25));
    if (!email || !email.includes('@') || !name || !kind || !['regional','sales'].includes(kind) || !code || code.length < 2) return json({ error: 'Nombre, correo, tipo y código son obligatorios' }, 400);
    if (!Number.isFinite(commission) || commission < 0 || commission > 50) return json({ error: 'Porcentaje de comisión inválido' }, 400);

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
      const { data: parent } = await service.from('partners').select('id,kind,active').eq('id', body.parentPartnerId).maybeSingle();
      if (!parent?.active || parent.kind !== 'regional') return json({ error: 'El responsable regional seleccionado no es válido' }, 400);
    }

    let targetUser: any = null;
    for (let page = 1; page <= 10 && !targetUser; page += 1) {
      const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      targetUser = data.users.find((item) => item.email?.toLowerCase() === email) ?? null;
      if (data.users.length < 1000) break;
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

      // Generate the one-time recovery token, but DO NOT send partners through the
      // hosted Supabase /auth/v1/verify URL. Central GO consumes token_hash itself.
      // This removes the failure mode where a malformed/rewritten Supabase path
      // ends in {"error":"requested path is invalid"} before the app opens.
      const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
      });
      if (linkError) throw linkError;
      const tokenHash = linkData?.properties?.hashed_token;
      if (!tokenHash) throw new Error('No fue posible generar el token de activación');
      activationUrl = buildDirectActivationUrl(redirectTo, tokenHash, 'recovery');
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

    const globalRole = kind === 'regional' ? 'regional_partner' : 'sales_partner';
    const { error: profileError } = await service.from('profiles').upsert({ id: targetUser.id, name, global_role: globalRole, active: true }, { onConflict: 'id' });
    if (profileError) throw profileError;

    const { data: partner, error: partnerError } = await service.from('partners').upsert({
      user_id: targetUser.id,
      kind,
      code,
      commission_percent: commission,
      parent_partner_id: kind === 'sales' ? (body?.parentPartnerId || null) : null,
      active: true,
    }, { onConflict: 'user_id' }).select('id').single();
    if (partnerError) throw partnerError;

    if (body?.countryCode) {
      const territory = {
        partner_id: partner.id,
        country_code: body.countryCode.toUpperCase().slice(0,2),
        region: body.region?.trim() || null,
        city: body.city?.trim() || null,
        exclusive: kind === 'regional',
      };
      const { data: existingTerritory } = await service.from('partner_territories').select('id').eq('partner_id', partner.id).eq('country_code', territory.country_code).eq('region', territory.region).eq('city', territory.city).maybeSingle();
      if (!existingTerritory) {
        const { error: territoryError } = await service.from('partner_territories').insert(territory);
        if (territoryError) throw territoryError;
      }
    }

    const message = delivery === 'whatsapp'
      ? 'Partner configurado. Enlace privado de activación generado directamente en Central GO.'
      : (invited ? 'Partner creado e invitación enviada' : 'Partner configurado sobre una cuenta existente');
    return json({ ok: true, partnerId: partner.id, userId: targetUser.id, invited, delivery, activationUrl, redirectTo, message });
  } catch (error) {
    console.error('invite-network-user', error instanceof Error ? error.message : 'unknown');
    return json({ error: error instanceof Error ? error.message : 'No fue posible crear el partner' }, 500);
  }
});
