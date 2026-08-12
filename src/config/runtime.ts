const OFFICIAL_SUPABASE_URL = 'https://cuazdzsvgwrnpczbvrgx.supabase.co';
const OFFICIAL_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ICfwSIQkutbSwAcHQdjBhA_aRPvM0lG';
const OFFICIAL_APP_URL = 'https://go-one.vercel.app';

const envSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const envSupabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
const envBackendFlag = import.meta.env.VITE_COMMERCIAL_BACKEND_ENABLED === 'true';
const envPublicAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL ?? '').trim();
const production = import.meta.env.PROD;

// En producción Central GO siempre debe hablar con el proyecto oficial.
// Esto evita que una variable antigua de Vercel pueda apuntar el bundle a otro backend.
const supabaseUrl = production ? OFFICIAL_SUPABASE_URL : (envSupabaseUrl || OFFICIAL_SUPABASE_URL);
const supabasePublishableKey = production
  ? OFFICIAL_SUPABASE_PUBLISHABLE_KEY
  : (envSupabasePublishableKey || OFFICIAL_SUPABASE_PUBLISHABLE_KEY);
const backendFlag = production ? true : envBackendFlag;
// go-one.vercel.app es el origen canónico actual. Los enlaces de Auth y PWA
// deben volver siempre al mismo origen para no separar sesiones/localStorage.
const officialAppUrl = (production ? OFFICIAL_APP_URL : (envPublicAppUrl || OFFICIAL_APP_URL)).replace(/\/$/, '');

// Central GO 2.0 opera exclusivamente contra el backend autenticado.
// isDemo se conserva en false solo como compatibilidad con código legado no montado.
const commercialBackendIntegrated = true;

export const runtimeConfig = Object.freeze({
  mode: 'official' as const,
  isDemo: false as const,
  isCommercial: true as const,
  supabaseUrl,
  supabasePublishableKey,
  officialSupabaseUrl: OFFICIAL_SUPABASE_URL,
  officialAppUrl,
  hasSupabaseConfig: Boolean(supabaseUrl && supabasePublishableKey),
  backendFlag,
  commercialBackendIntegrated,
  commercialReady:
    backendFlag &&
    commercialBackendIntegrated &&
    Boolean(supabaseUrl && supabasePublishableKey),
});

export const commercialBlockers = [
  !runtimeConfig.hasSupabaseConfig ? 'Falta configurar Supabase para persistencia y autenticación.' : null,
  !runtimeConfig.backendFlag ? 'Falta habilitar explícitamente el backend oficial.' : null,
  !runtimeConfig.commercialBackendIntegrated ? 'La capa de datos autenticada todavía no está integrada.' : null,
].filter((item): item is string => Boolean(item));
