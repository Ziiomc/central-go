import { requireSupabase } from './supabase';

const normalizeAddress = (value: string) => value.trim().toLocaleLowerCase('es-CL').replace(/\s+/g, ' ');

export async function rememberClientAddress(
  companyId: string,
  clientId: string,
  address: { label?: string; address: string; lat: number; lng: number },
): Promise<boolean> {
  const cleanAddress = address.address.trim();
  if (!companyId || !clientId || cleanAddress.length < 3) return false;
  const db = requireSupabase();
  const { data: existing, error: readError } = await db
    .from('client_addresses')
    .select('id,address')
    .eq('company_id', companyId)
    .eq('client_id', clientId);
  if (readError) throw readError;
  const normalized = normalizeAddress(cleanAddress);
  if ((existing ?? []).some((item: { address: string }) => normalizeAddress(item.address) === normalized)) return false;
  const { error } = await db.from('client_addresses').insert({
    company_id: companyId,
    client_id: clientId,
    label: address.label?.trim() || `Dirección ${(existing?.length ?? 0) + 1}`,
    address: cleanAddress,
    lat: address.lat,
    lng: address.lng,
  });
  if (error) throw error;
  return true;
}
