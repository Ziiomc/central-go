import { createClient } from 'jsr:@supabase/supabase-js@2';

const OFFICIAL_APP_URL = 'https://central-go-one.vercel.app/';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const allowedRole = (value: string): value is 'company_admin' | 'operator' | 'driver' => ['company_admin', 'operator', 'driver'].includes(value);

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'Sesión requerida' }, 401);
    const body = await req.json().catch(() => null) as {
      companyId?: string;
      email?: string;
      role?: string;
      name?: string;
      redirectTo?: string;
      password?: string;
    } | null;
    const companyId = body?.companyId?.trim();
    const email = body?.email?.trim().toLowerCase();
    const role = body?.role?.trim() ?? '';
    const name = body?.name?.trim() ?? '';
    const password = body?.password ?? '';
    if (!companyId || !email || !email.includes('@') || !allowedRole(role)) return json({ error: 'Central, correo y rol válidos son obligatorios' }, 400);
    if (password && password.length < 10) return json({ error: 'La contraseña inicial debe tener al menos 10 caracteres' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    const callerId = userData.user?.id;
    if (userError || !callerId) return json({ error: 'Sesión inválida' }, 401);

    const { data: profile } = await service.from('profiles').select('global_role,active').eq('id', callerId).maybeSingle();
    if (!profile?.active) return json({ error: 'Cuenta suspendida' }, 403);
    const isSuper = profile.global_role === 'super_admin';
    let authorized = isSuper;

    if (!authorized && role !== 'company_admin') {
      const { data: membership } = await service.from('company_memberships').select('id').eq('company_id', companyId).eq('user_id', callerId).eq('role', 'company_admin').eq('active', true).maybeSingle();
      authorized = Boolean(membership);
    }
    if (!authorized && role === 'company_admin') {
      const { data: ownPartner } = await service.from('partners').select('id,kind').eq('user_id', callerId).eq('active', true).maybeSingle();
      if (ownPartner) {
        const { data: referral } = await service.from('referrals').select('partner_id').eq('company_id', companyId).eq('active', true).maybeSingle();
        if (referral?.partner_id === ownPartner.id) authorized = true;
        if (!authorized && ownPartner.kind === 'regional' && referral?.partner_id) {
          const { data: child } = await service.from('partners').select('id').eq('id', referral.partner_id).eq('parent_partner_id', ownPartner.id).eq('active', true).maybeSingle();
          authorized = Boolean(child);
        }
      }
    }
    if (!authorized) return json({ error: 'No tienes permiso para administrar este acceso' }, 403);
    if (password && (!isSuper || role !== 'company_admin')) return json({ error: 'Solo Superadmin puede definir la contraseña inicial del administrador' }, 403);

    let targetUser: any = null;
    for (let page = 1; page <= 10 && !targetUser; page += 1) {
      const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      targetUser = data.users.find((item) => item.email?.toLowerCase() === email) ?? null;
      if (data.users.length < 1000) break;
    }

    let invited = false;
    let passwordReady = false;
    let passwordUpdated = false;

    if (!targetUser) {
      if (password) {
        const { data, error } = await service.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { ...(name ? { name } : {}), needs_password_setup: false },
        });
        if (error) throw error;
        targetUser = data.user;
        passwordReady = true;
      } else {
        const redirectTo = safeRedirect(body?.redirectTo);
        const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
          data: { ...(name ? { name } : {}), needs_password_setup: true },
          redirectTo,
        });
        if (error) throw error;
        targetUser = data.user;
        invited = true;
      }
    } else if (password && isSuper && role === 'company_admin') {
      const metadata = targetUser.user_metadata ?? {};
      if (metadata.needs_password_setup === true) {
        const { data, error } = await service.auth.admin.updateUserById(targetUser.id, {
          password,
          email_confirm: true,
          user_metadata: { ...metadata, ...(name ? { name } : {}), needs_password_setup: false },
        });
        if (error) throw error;
        targetUser = data.user;
        passwordReady = true;
        passwordUpdated = true;
      }
    }
    if (!targetUser) return json({ error: 'No fue posible crear o localizar el usuario' }, 500);

    const { error: membershipError } = await service.from('company_memberships').upsert({ company_id: companyId, user_id: targetUser.id, role, active: true }, { onConflict: 'company_id,user_id,role' });
    if (membershipError) throw membershipError;

    const message = passwordReady
      ? (passwordUpdated ? 'Contraseña inicial definida y administrador vinculado' : 'Administrador creado con contraseña y vinculado')
      : invited
        ? 'Invitación enviada por correo'
        : password
          ? 'Usuario existente vinculado; su contraseña previa no fue reemplazada por seguridad'
          : 'Usuario existente vinculado a la central';

    return json({ ok: true, userId: targetUser.id, email, role, invited, passwordReady, passwordUpdated, message });
  } catch (error) {
    console.error('invite-company-user', error);
    return json({ error: error instanceof Error ? error.message : 'No fue posible administrar el usuario' }, 500);
  }
});
