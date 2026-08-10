const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
const backendFlag = import.meta.env.VITE_COMMERCIAL_BACKEND_ENABLED === 'true';

// Central GO 2.0 opera exclusivamente contra el backend autenticado.
// isDemo se conserva en false solo como compatibilidad con código legado no montado.
const commercialBackendIntegrated = true;

export const runtimeConfig = Object.freeze({
  mode: 'official' as const,
  isDemo: false as const,
  isCommercial: true as const,
  supabaseUrl,
  supabasePublishableKey,
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
