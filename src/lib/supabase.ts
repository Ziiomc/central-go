import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { runtimeConfig } from '../config/runtime';

let client: SupabaseClient | null = null;

if (runtimeConfig.hasSupabaseConfig) {
  client = createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
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
