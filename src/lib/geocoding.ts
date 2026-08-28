import { requireSupabase } from './supabase';

export interface GeocodedAddress {
  lat: number;
  lng: number;
  displayName: string;
  provider: string;
  cached: boolean;
}

const addressCache = new Map<string, GeocodedAddress>();
const suggestionCache = new Map<string, GeocodedAddress[]>();
const cacheKey = (companyId: string, address: string) => `${companyId}|${address.trim().toLocaleLowerCase('es-CL')}`;

export async function geocodeCommercialAddress(companyId: string, address: string): Promise<GeocodedAddress> {
  const cleanAddress = address.trim();
  if (cleanAddress.length < 3) throw new Error('La dirección es demasiado corta para ubicarla.');

  const key = cacheKey(companyId, cleanAddress);
  const remembered = addressCache.get(key);
  if (remembered) return { ...remembered, cached: true };

  const { data, error } = await requireSupabase().functions.invoke('geocode-address', {
    body: { companyId, address: cleanAddress, mode: 'geocode' },
  });

  if (error) throw new Error(error.message || 'No fue posible ubicar la dirección.');
  if (data?.error) throw new Error(String(data.error));
  if (!Number.isFinite(Number(data?.lat)) || !Number.isFinite(Number(data?.lng))) {
    throw new Error('La dirección no devolvió coordenadas válidas.');
  }

  const result = {
    lat: Number(data.lat),
    lng: Number(data.lng),
    displayName: String(data.displayName || cleanAddress),
    provider: String(data.provider || 'geocoder'),
    cached: Boolean(data.cached),
  };
  addressCache.set(key, result);
  return result;
}

export async function suggestCommercialAddresses(companyId: string, address: string): Promise<GeocodedAddress[]> {
  const cleanAddress = address.trim();
  if (cleanAddress.length < 3) return [];
  const key = cacheKey(companyId, cleanAddress);
  const remembered = suggestionCache.get(key);
  if (remembered) return remembered;

  const { data, error } = await requireSupabase().functions.invoke('geocode-address', {
    body: { companyId, address: cleanAddress, mode: 'suggest' },
  });
  if (error) throw new Error(error.message || 'No fue posible buscar sugerencias.');
  if (data?.error) throw new Error(String(data.error));

  const suggestions = (Array.isArray(data?.suggestions) ? data.suggestions : [])
    .map((item: unknown) => item as Partial<GeocodedAddress>)
    .filter((item: Partial<GeocodedAddress>) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)) && Boolean(item.displayName))
    .slice(0, 6)
    .map((item: Partial<GeocodedAddress>) => ({
      lat: Number(item.lat),
      lng: Number(item.lng),
      displayName: String(item.displayName),
      provider: String(item.provider || 'photon-suggest'),
      cached: Boolean(item.cached),
    }));

  suggestionCache.set(key, suggestions);
  for (const suggestion of suggestions) addressCache.set(cacheKey(companyId, suggestion.displayName), suggestion);
  return suggestions;
}
