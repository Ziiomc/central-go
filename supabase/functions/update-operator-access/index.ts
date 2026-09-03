import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const deriveCompatiblePassword = async (email: string, password: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const payload = new TextEncoder().encode(`centralgo-password-v1|${normalizedEmail}|${password}`);
  const digest = await crypto.subtle.digest('SHA-256', payload);
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `Cg1!${hex}`;
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
      name?: string;
      password?: string;
    } | null;

    const companyId = body?.companyId?.trim() ?? '';
    const userId = body?.userId?.trim() ?? '';
    const name = body?.name?.trim() ?? '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!companyId || !userId) return json({ error: 'Central y operador son obligatorios.' }, 400);
    if (name.length < 2 || name.length > 120) return json({ error: 'Ingresa un nombre válido.' }, 400);
    if (password && password.length < 8) return json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' }, 400);
    if (password.length > 256) return json({ error: 'La contraseña es demasiado larga.' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) throw new Error('Configuración incompleta.');

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: callerData, error: callerError } = await userClient.auth.getUser();
    const callerId = callerData.user?.id;
    if (callerError || !callerId) return json({ error: 'Sesión inválida' }, 401);

    const { data: callerProfile, error: profileError } = await service
      .from('profiles')
      .select('global_role,active')
      .eq('id', callerId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!callerProfile?.active) return json({ error: 'Cuenta suspendida' }, 403);

    let authorized = callerProfile.global_role === 'super_admin';
    if (!authorized) {
      const { data: adminMembership, error: adminError } = await service
        .from('company_memberships')
        .select('user_id')
        .eq('company_id', companyId)
        .eq('user_id', callerId)
        .eq('role', 'company_admin')
        .eq('active', true)
        .maybeSingle();
      if (adminError) throw adminError;
      authorized = Boolean(adminMembership);
    }
    if (!authorized) return json({ error: 'Solo la administración de esta central puede editar accesos.' }, 403);

    const { data: operatorMembership, error: operatorError } = await service
      .from('company_memberships')
      .select('user_id,active')
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .eq('role', 'operator')
      .maybeSingle();
    if (operatorError) throw operatorError;
    if (!operatorMembership) return json({ error: 'El operador no pertenece a esta central.' }, 404);

    const { data: targetData, error: targetError } = await service.auth.admin.getUserById(userId);
    if (targetError || !targetData.user) return json({ error: 'No fue posible localizar la cuenta del operador.' }, 404);

    const target = targetData.user;
    const email = target.email?.trim().toLowerCase() ?? '';
    const isManualOperator = email.endsWith('.operators.centralgo.app') || target.user_metadata?.manual_operator === true || target.app_metadata?.operator_mode === 'manual';

    if (password && !isManualOperator) {
      return json({ error: 'La contraseña solo puede restablecerse en accesos creados con usuario y clave.' }, 400);
    }

    const authUpdate: Record<string, unknown> = {
      user_metadata: { ...(target.user_metadata ?? {}), name },
    };
    if (password) authUpdate.password = await deriveCompatiblePassword(email, password);

    const { error: authUpdateError } = await service.auth.admin.updateUserById(userId, authUpdate);
    if (authUpdateError) throw authUpdateError;

    const { error: profileUpdateError } = await service.from('profiles').update({ name }).eq('id', userId);
    if (profileUpdateError) throw profileUpdateError;

    return json({
      ok: true,
      passwordChanged: Boolean(password),
      message: password ? 'Nombre y contraseña actualizados.' : 'Nombre actualizado.',
    });
  } catch (error) {
    console.error('update-operator-access', error instanceof Error ? error.message : 'unexpected error');
    return json({ error: 'No fue posible actualizar el acceso del operador.' }, 500);
  }
});