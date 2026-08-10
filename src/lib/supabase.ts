import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { runtimeConfig } from '../config/runtime';

let client: SupabaseClient | null = null;

const shouldRetryThroughProxy = (error: unknown, url: string) => {
  if (typeof window === 'undefined') return false;
  if (!(error instanceof TypeError)) return false;
  return url.startsWith(runtimeConfig.supabaseUrl);
};

const resilientFetch: typeof fetch = async (input, init) => {
  const sourceUrl = input instanceof Request ? input.url : input instanceof URL ? input.toString() : String(input);
  const fallbackRequest = input instanceof Request ? input.clone() : null;

  try {
    return await fetch(input, init);
  } catch (error) {
    if (!shouldRetryThroughProxy(error, sourceUrl)) throw error;

    const upstream = new URL(sourceUrl);
    const proxyUrl = `${window.location.origin}/__supabase${upstream.pathname}${upstream.search}`;

    if (fallbackRequest) {
      const proxied = new Request(proxyUrl, fallbackRequest);
      return fetch(proxied, init);
    }

    return fetch(proxyUrl, init);
  }
};

if (runtimeConfig.hasSupabaseConfig) {
  client = createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    global: {
      fetch: resilientFetch,
    },
    realtime: {
      params: { eventsPerSecond: 12 },
    },
  });
}

export const supabase = client;

export const requireSupabase = (): SupabaseClient => {
  if (!supabase) {
    throw new Error('Supabase no está configurado para este entorno.');
  }
  return supabase;
};
