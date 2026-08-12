import { createClient } from 'jsr:@supabase/supabase-js@2';

const OFFICIAL_APP_URL = 'https://central-go-one.vercel.app/';
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

const isEmailRateLimit = (error: unknown) => {
  const value = error as { message?: string; code?: string; status?: number } | null;
  const text = `${value?.message ?? ''} ${value?.code ?? ''}`;
  return value?.status === 429 || /email rate limit|over_email_send_rate_limit|too many requests/i.test(text);
};

const roleLabel = (role?: string | null) => {
  if (role === 'regional_partner') return 'Partner Regional';
  if (role === 'sales_partner') return 'Partner Comercial';
  if (role === 'super_admin') return 'Superadmin';
  return role || 'cuenta global';
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

    if (!companyId || !email || !email.includes('@') || !allowedRole(role)) {
      return json({ error: 'Central, correo y rol válidos son obligatorios' }, 400);
    }
    if (password && password.length < 10) return json({ error: 'La contraseña inicial debe tener al menos 10 caracteres' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
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

    const findUser = async () => {
      for (let page = 1; page <= 10; page += 1) {
        const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        const found = data.users.find((item) => item.email?.toLowerCase() === email);
        if (found) return found;
        if (data.users.length < 1000) break;
      }
      return null;
    };

    const redirectTo = role === 'driver' ? OFFICIAL_DRIVER_URL : safeRedirect(body?.redirectTo);
    const requestedMetadata = { ...(name ? { name } : {}), needs_password_setup: !password };
    let targetUser: any = await findUser();
    let invited = false;
    let emailPending = false;
    let passwordReady = false;
    let passwordUpdated = false;

    if (targetUser && role !== 'company_admin') {
      const { data: targetProfile, error: targetProfileError } = await service.from('profiles').select('name,global_role').eq('id', targetUser.id).maybeSingle();
      if (targetProfileError) throw targetProfileError;
      if (targetProfile?.global_role) return json({ error: `El correo ${email} ya pertenece a ${roleLabel(targetProfile.global_role)}${targetProfile.name ? ` (${targetProfile.name})` : ''}. Usa un correo personal distinto para el conductor para no alterar esa cuenta.`, code: 'EMAIL_RESERVED_GLOBAL_ROLE' }, 409);
      if (role === 'driver') {
        const { data: existingDriver, error: existingDriverError } = await service.from('drivers').select('id,company_id,display_name,unit_number').eq('user_id', targetUser.id).limit(1).maybeSingle();
        if (existingDriverError) throw existingDriverError;
        if (existingDriver) return json({ error: `Ese correo ya está vinculado al conductor ${existingDriver.display_name} (${existingDriver.unit_number}). Edita ese conductor o usa otro correo.`, code: 'EMAIL_ALREADY_DRIVER' }, 409);
      }
    }

    if (!targetUser) {
      if (password) {
        const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: requestedMetadata });
        if (error) throw error;
        targetUser = data.user;
        passwordReady = true;
      } else {
        const { data, error } = await service.auth.admin.inviteUserByEmail(email, { data: requestedMetadata, redirectTo });
        if (!error) {
          targetUser = data.user;
          invited = true;
        } else if (isEmailRateLimit(error)) {
          targetUser = await findUser();
          if (!targetUser) {
            const { data: generated, error: generateError } = await service.auth.admin.generateLink({ type: 'invite', email, options: { data: requestedMetadata, redirectTo } });
            if (generateError) throw generateError;
            targetUser = generated.user;
          }
          emailPending = true;
        } else throw error;
      }
    } else if (password && isSuper && role === 'company_admin') {
      const metadata = targetUser.user_metadata ?? {};
      if (metadata.needs_password_setup === true) {
        const { data, error } = await service.auth.admin.updateUserById(targetUser.id, { password, email_confirm: true, user_metadata: { ...metadata, ...(name ? { name } : {}), needs_password_setup: false } });
        if (error) throw error;
        targetUser = data.user;
        passwordReady = true;
        passwordUpdated = true;
      }
    } else if (!password && targetUser.user_metadata?.needs_password_setup === true) {
      const metadata = targetUser.user_metadata ?? {};
      const { data: updated, error: updateError } = await service.auth.admin.updateUserById(targetUser.id, { user_metadata: { ...metadata, ...(name ? { name } : {}), needs_password_setup: true } });
      if (updateError) throw updateError;
      targetUser = updated.user;
      const { error: recoveryError } = await service.auth.resetPasswordForEmail(email, { redirectTo });
      if (!recoveryError) invited = true;
      else if (isEmailRateLimit(recoveryError)) emailPending = true;
      else throw recoveryError;
    }

    if (!targetUser) return json({ error: 'No fue posible crear o localizar el usuario' }, 500);

    const { error: membershipError } = await service.from('company_memberships').upsert({ company_id: companyId, user_id: targetUser.id, role, active: true }, { onConflict: 'company_id,user_id,role' });
    if (membershipError) throw membershipError;

    const roleName = role === 'driver' ? 'conductor' : role === 'operator' ? 'operadora' : 'administrador';
    const message = passwordReady
      ? (passwordUpdated ? 'Contraseña inicial definida y administrador vinculado' : 'Administrador creado con contraseña y vinculado')
      : emailPending
        ? `Cuenta de ${roleName} creada y vinculada. El correo quedó pendiente porque Supabase alcanzó temporalmente su límite de envío. Reenvía la invitación más tarde.`
        : invited
          ? `Invitación de ${roleName} enviada por correo`
          : `Usuario existente vinculado como ${roleName}`;

    return json({ ok: true, userId: targetUser.id, email, role, invited, emailPending, passwordReady, passwordUpdated, needsPasswordSetup: targetUser.user_metadata?.needs_password_setup === true, message });
  } catch (error) {
    console.error('invite-company-user', error);
    return json({ error: error instanceof Error ? error.message : 'No fue posible administrar el usuario' }, 500);
  }
});
