import { createClient } from 'jsr:@supabase/supabase-js@2';

const OFFICIAL_ORIGIN = 'https://central-go-one.vercel.app';
const MIN_PASSWORD_LENGTH = 8;
const ALLOWED_ROLES = new Set(['central', 'driver', 'sales_partner']);

const allowedOrigin = (origin: string | null) => {
  if (!origin) return OFFICIAL_ORIGIN;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') return OFFICIAL_ORIGIN;
    if (
      url.hostname === 'central-go-one.vercel.app' ||
      url.hostname === 'centralgo.app' ||
      url.hostname.endsWith('.centralgo.app') ||
      url.hostname.endsWith('.vercel.app') ||
      url.hostname === 'localhost'
    ) return origin;
  } catch { /* official fallback */ }
  return OFFICIAL_ORIGIN;
};

const corsHeaders = (req: Request) => ({
  'Access-Control-Allow-Origin': allowedOrigin(req.headers.get('Origin')),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});

const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
});

const normalizeEmail = (value: unknown) => String(value ?? '').trim().toLowerCase();
const validEmail = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const deriveCompatiblePassword = async (email: string, password: string) => {
  const payload = new TextEncoder().encode(`centralgo-password-v1|${email}|${password}`);
  const digest = await crypto.subtle.digest('SHA-256', payload);
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `Cg1!${hex}`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Método no permitido' }, 405);

  try {
    const body = await req.json().catch(() => null) as {
      email?: string;
      password?: string;
      role?: string;
    } | null;

    const email = normalizeEmail(body?.email);
    const password = typeof body?.password === 'string' ? body.password : '';
    const role = String(body?.role ?? '').trim();

    if (!validEmail(email)) return json(req, { error: 'Ingresa un correo válido.' }, 400);
    if (!ALLOWED_ROLES.has(role)) return json(req, { error: 'Tipo de cuenta no permitido.' }, 400);
    if (password.length < MIN_PASSWORD_LENGTH) {
      return json(req, { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` }, 400);
    }
    if (password.length > 256) return json(req, { error: 'La contraseña es demasiado larga.' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) throw new Error('Configuración de autenticación incompleta.');

    const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const internalPassword = await deriveCompatiblePassword(email, password);
    const requestedMetadata = { account_kind: role, centralgo_password_v1: true };

    const findUser = async () => {
      for (let page = 1; page <= 10; page += 1) {
        const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        const found = data.users.find((user) => user.email?.trim().toLowerCase() === email);
        if (found) return found;
        if (data.users.length < 1000) break;
      }
      return null;
    };

    const existing = await findUser();
    if (existing) {
      if (!existing.email_confirmed_at) {
        const { error: updateError } = await service.auth.admin.updateUserById(existing.id, {
          password: internalPassword,
          email_confirm: true,
          user_metadata: { ...(existing.user_metadata ?? {}), ...requestedMetadata },
        });
        if (updateError) throw updateError;
        return json(req, { ok: true, activated: true });
      }
      return json(req, { error: 'Este correo ya está registrado. Usa “Iniciar sesión”.', code: 'USER_EXISTS' }, 409);
    }

    const { error: createError } = await service.auth.admin.createUser({
      email,
      password: internalPassword,
      email_confirm: true,
      user_metadata: requestedMetadata,
    });
    if (createError) throw createError;

    return json(req, { ok: true, created: true });
  } catch (error) {
    console.error('password-signup', error instanceof Error ? error.message : 'unexpected error');
    return json(req, { error: 'No fue posible crear la cuenta. Intenta nuevamente.' }, 500);
  }
});
