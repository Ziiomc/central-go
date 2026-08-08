export type RuntimeMode = 'demo' | 'commercial';

const rawMode = (import.meta.env.VITE_APP_MODE ?? 'demo').toLowerCase();
const mode: RuntimeMode = rawMode === 'commercial' ? 'commercial' : 'demo';
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
const backendFlag = import.meta.env.VITE_COMMERCIAL_BACKEND_ENABLED === 'true';

// La capa autenticada/persistente ya está integrada y protegida por CI.
// El entorno comercial sigue necesitando las variables explícitas para activarse.
const commercialBackendIntegrated = true;

export const runtimeConfig = Object.freeze({
  mode,
  isDemo: mode === 'demo',
  isCommercial: mode === 'commercial',
  supabaseUrl,
  supabasePublishableKey,
  hasSupabaseConfig: Boolean(supabaseUrl && supabasePublishableKey),
  backendFlag,
  commercialBackendIntegrated,
  commercialReady:
    mode === 'commercial' &&
    backendFlag &&
    commercialBackendIntegrated &&
    Boolean(supabaseUrl && supabasePublishableKey),
});

export const commercialBlockers = [
  !runtimeConfig.hasSupabaseConfig ? 'Falta configurar Supabase para persistencia y autenticación.' : null,
  !runtimeConfig.backendFlag ? 'Falta habilitar explícitamente el backend comercial.' : null,
  !runtimeConfig.commercialBackendIntegrated ? 'La capa de datos autenticada todavía no está integrada al contexto operativo.' : null,
].filter((item): item is string => Boolean(item));
