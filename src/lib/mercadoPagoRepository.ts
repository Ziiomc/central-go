import { requireSupabase } from './supabase';

export interface MercadoPagoPlatformStatus {
  connected: boolean;
  mpUserId: string | null;
  connectedAt: string | null;
  tokenExpiresAt: string | null;
  connectedByName: string | null;
}

export async function loadMercadoPagoPlatformStatus(): Promise<MercadoPagoPlatformStatus> {
  const { data, error } = await requireSupabase().rpc('get_platform_mercadopago_status');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    connected: Boolean(row?.connected),
    mpUserId: row?.mp_user_id ? String(row.mp_user_id) : null,
    connectedAt: row?.connected_at ?? null,
    tokenExpiresAt: row?.token_expires_at ?? null,
    connectedByName: row?.connected_by_name ?? null,
  };
}

export async function startMercadoPagoConnection(): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('mercadopago-connect-start', {
    body: { returnUrl: `${window.location.origin}/` },
  });
  if (error || !data?.authorizationUrl) {
    const message = data?.message || error?.message || 'No se pudo iniciar la vinculación con Mercado Pago.';
    throw new Error(message);
  }
  return String(data.authorizationUrl);
}

export async function disconnectMercadoPagoPlatform(): Promise<void> {
  const { error } = await requireSupabase().rpc('disconnect_platform_mercadopago');
  if (error) throw error;
}

