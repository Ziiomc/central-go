import { createClient } from 'jsr:@supabase/supabase-js@2';

const OFFICIAL_DRIVER_URL = 'https://central-go-one.vercel.app/driver';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const isEmailRateLimit = (error: unknown) => {
  const value = error as { message?: string; code?: string; status?: number } | null;
  const text = `${value?.message ?? ''} ${value?.code ?? ''}`;
  return value?.status === 429 || /email rate limit|over_email_send_rate_limit|too many requests/i.test(text);
};

const buildCentralGoLink = (generated: any, fallbackType: 'invite' | 'recovery') => {
  const properties = generated?.properties ?? {};
  const tokenHash = typeof properties.hashed_token === 'string' ? properties.hashed_token : '';
  const verificationType = typeof properties.verification_type === 'string' ? properties.verification_type : fallbackType;

  if (!tokenHash) {
    const actionLink = typeof properties.action_link === 'string' ? properties.action_link : '';
    if (!actionLink) throw new Error('Supabase no devolvió un token de activación válido.');
    return actionLink;
  }

  const url = new URL(OFFICIAL_DRIVER_URL);
  url.searchParams.set('token_hash', tokenHash);
  url.searchParams.set('type', verificationType);
  return url.toString();
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'Sesión requerida' }, 401);

    const body = await req.json().catch(() => null) as {
      companyId?: string;
      userId?: string;
      action?: 'status' | 'send' | 'link';
    } | null;

    const companyId = body?.companyId?.trim();
    const userId = body?.userId?.trim();
    const action = body?.action ?? 'send';
    if (!companyId || !userId) return json({ error: 'Central y conductor son obligatorios' }, 400);
    if (!['status', 'send', 'link'].includes(action)) return json({ error: 'Acción inválida' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: callerData, error: callerError } = await userClient.auth.getUser();
    const callerId = callerData.user?.id;
    if (callerError || !callerId) return json({ error: 'Sesión inválida' }, 401);

    const { data: profile, error: profileError } = await service
      .from('profiles')
      .select('global_role,active')
      .eq('id', callerId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.active) return json({ error: 'Cuenta suspendida' }, 403);

    let authorized = profile.global_role === 'super_admin';
    if (!authorized) {
      const { data: adminMembership, error: adminError } = await service
        .from('company_memberships')
        .select('id')
        .eq('company_id', companyId)
        .eq('user_id', callerId)
        .eq('role', 'company_admin')
        .eq('active', true)
        .maybeSingle();
      if (adminError) throw adminError;
      authorized = Boolean(adminMembership);
    }
    if (!authorized) return json({ error: 'No tienes permiso para administrar accesos de esta central' }, 403);

    const { data: driverMembership, error: membershipError } = await service
      .from('company_memberships')
      .select('id,active')
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .eq('role', 'driver')
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!driverMembership?.active) return json({ error: 'El conductor no tiene un acceso activo en esta central' }, 404);

    const { data: authResult, error: authError } = await service.auth.admin.getUserById(userId);
    if (authError) throw authError;
    const targetUser = authResult.user;
    const email = targetUser.email?.trim().toLowerCase();
    if (!email) return json({ error: 'El conductor no tiene un correo asociado' }, 400);

    const emailConfirmed = Boolean(targetUser.email_confirmed_at);
    const needsSetup = targetUser.user_metadata?.needs_password_setup === true || !emailConfirmed;
    const active = !needsSetup;

    if (action === 'status') {
      return json({
        ok: true,
        email,
        active,
        sent: false,
        emailPending: false,
        needsSetup,
        emailConfirmed,
        message: active
          ? 'Cuenta activada y lista para iniciar sesión.'
          : emailConfirmed
            ? 'Correo confirmado. Falta que el conductor cree su contraseña.'
            : 'Cuenta pendiente de activación y creación de contraseña.',
      });
    }

    const metadata = targetUser.user_metadata ?? {};

    if (action === 'link') {
      const linkType: 'invite' | 'recovery' = emailConfirmed ? 'recovery' : 'invite';
      const { data: generated, error: generateError } = await service.auth.admin.generateLink({
        type: linkType,
        email,
        options: {
          data: needsSetup ? { ...metadata, needs_password_setup: true } : metadata,
        },
      });
      if (generateError) throw generateError;

      return json({
        ok: true,
        email,
        active,
        sent: false,
        emailPending: false,
        needsSetup,
        emailConfirmed,
        actionLink: buildCentralGoLink(generated, linkType),
        message: active
          ? 'Generamos un enlace seguro de recuperación directamente en Central GO.'
          : emailConfirmed
            ? 'Generamos un enlace seguro para crear la contraseña directamente en Central GO.'
            : 'Generamos un enlace seguro de activación directamente en Central GO.',
      });
    }

    if (!needsSetup) {
      return json({
        ok: true,
        email,
        active: true,
        sent: false,
        emailPending: false,
        needsSetup: false,
        emailConfirmed,
        message: 'La cuenta del conductor ya está activada y lista para iniciar sesión.',
      });
    }

    if (metadata.needs_password_setup !== true) {
      const { error: metadataError } = await service.auth.admin.updateUserById(userId, {
        user_metadata: { ...metadata, needs_password_setup: true },
      });
      if (metadataError) throw metadataError;
    }

    const { error: sendError } = await service.auth.resetPasswordForEmail(email, {
      redirectTo: OFFICIAL_DRIVER_URL,
    });

    if (!sendError) {
      return json({
        ok: true,
        email,
        active: false,
        sent: true,
        emailPending: false,
        needsSetup: true,
        emailConfirmed,
        message: `Enviamos un nuevo acceso a ${email}. Debe abrir el correo más reciente para crear su contraseña.`,
      });
    }

    if (!isEmailRateLimit(sendError)) throw sendError;

    const linkType: 'invite' | 'recovery' = emailConfirmed ? 'recovery' : 'invite';
    const { data: generated, error: generateError } = await service.auth.admin.generateLink({
      type: linkType,
      email,
      options: {
        data: { ...metadata, needs_password_setup: true },
      },
    });
    if (generateError) throw generateError;

    return json({
      ok: true,
      email,
      active: false,
      sent: false,
      emailPending: true,
      needsSetup: true,
      emailConfirmed,
      actionLink: buildCentralGoLink(generated, linkType),
      message: 'El correo está temporalmente limitado. Generamos un enlace seguro que abre directamente Central GO para crear la contraseña.',
    });
  } catch (error) {
    console.error('driver-access', error);
    return json({ error: error instanceof Error ? error.message : 'No fue posible administrar el acceso del conductor' }, 500);
  }
});