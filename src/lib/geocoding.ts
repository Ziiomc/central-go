import { requireSupabase } from './supabase';

export interface GeocodedAddress {
  lat: number;
  lng: number;
  displayName: string;
  provider: string;
  cached: boolean;
}

export async function geocodeCommercialAddress(companyId: string, address: string): Promise<GeocodedAddress> {
  const cleanAddress = address.trim();
  if (cleanAddress.length < 3) throw new Error('La dirección es demasiado corta para ubicarla.');

  const { data, error } = await requireSupabase().functions.invoke('geocode-address', {
    body: { companyId, address: cleanAddress },
  });

  if (error) throw new Error(error.message || 'No fue posible ubicar la dirección.');
  if (data?.error) throw new Error(String(data.error));
  if (!Number.isFinite(Number(data?.lat)) || !Number.isFinite(Number(data?.lng))) {
    throw new Error('La dirección no devolvió coordenadas válidas.');
  }

  return {
    lat: Number(data.lat),
    lng: Number(data.lng),
    displayName: String(data.displayName || cleanAddress),
    provider: String(data.provider || 'geocoder'),
    cached: Boolean(data.cached),
  };
}
