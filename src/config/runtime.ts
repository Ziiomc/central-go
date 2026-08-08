export type RuntimeMode = 'demo' | 'commercial';

const rawMode = (import.meta.env.VITE_APP_MODE ?? 'demo').toLowerCase();
const mode: RuntimeMode = rawMode === 'commercial' ? 'commercial' : 'demo';
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
const backendFlag = import.meta.env.VITE_COMMERCIAL_BACKEND_ENABLED === 'true';

// Deliberately false until the authenticated persistence layer is wired into AppContext.
// This prevents a demo data model from being mistaken for a production system.
const commercialBackendIntegrated = false;

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
