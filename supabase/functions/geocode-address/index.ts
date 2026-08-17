import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const GEOCODER_VERSION = 'street-first-v3';

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/[.,;:#]/g, ' ')
  .replace(/\s+/g, ' ');

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stripTrailingPlace = (value: string, place?: string | null) => {
  const cleanPlace = String(place || '').trim();
  if (!cleanPlace) return value.trim();
  const expression = new RegExp(`(?:[,\\s]+)${escapeRegExp(cleanPlace)}\\s*$`, 'i');
  return value.replace(expression, '').replace(/[\s,]+$/g, '').trim();
};

const haversineKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  category?: string;
  class?: string;
  type?: string;
  addresstype?: string;
  importance?: number;
  address?: Record<string, string>;
};

const roadLikeTypes = new Set([
  'road', 'residential', 'living_street', 'unclassified', 'tertiary', 'secondary',
  'primary', 'pedestrian', 'service', 'path', 'footway', 'track', 'house', 'building',
]);

const placeLikeTypes = new Set([
  'city', 'town', 'village', 'municipality', 'administrative', 'state', 'county',
  'square', 'park', 'neighbourhood', 'suburb',
]);

const resultCity = (result: NominatimResult) => String(
  result.address?.city || result.address?.town || result.address?.municipality ||
  result.address?.village || result.address?.county || '',
);

const scoreResult = (
  result: NominatimResult,
  rawAddress: string,
  streetCandidate: string,
  city: string,
  center?: { lat: number; lng: number },
) => {
  const display = normalize(result.display_name || '');
  const street = normalize(streetCandidate);
  const cityNorm = normalize(city);
  const rawTokens = normalize(rawAddress).split(' ').filter((token) => token.length > 2);
  const resultType = normalize(result.addresstype || result.type || '');
  const resultCategory = normalize(result.category || result.class || '');
  let score = 0;

  if (street && display.includes(street)) score += 70;
  for (const token of rawTokens) if (display.includes(token)) score += 6;

  if (resultCategory === 'highway' || roadLikeTypes.has(resultType)) score += 55;
  if (result.address?.road || result.address?.pedestrian || result.address?.house_number) score += 30;

  const foundCity = normalize(resultCity(result));
  if (cityNorm && foundCity && (foundCity.includes(cityNorm) || cityNorm.includes(foundCity))) score += 28;
  if (cityNorm && display.includes(cityNorm)) score += 16;

  if (placeLikeTypes.has(resultType)) score -= 45;
  if (resultType === 'square' || /\bplaza\b/.test(display)) score -= 80;

  if (center) {
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const distance = haversineKm(center.lat, center.lng, lat, lng);
      score += Math.max(-20, 24 - distance * 1.5);
    }
  }

  score += Math.min(12, Number(result.importance || 0) * 12);
  return score;
};

const fetchNominatim = async (params: URLSearchParams) => {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'es',
      'User-Agent': 'CentralGO/2.0 (street-first dispatch geocoding)',
    },
    signal: AbortSignal.timeout(6500),
  });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  return await response.json() as NominatimResult[];
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'Sesión requerida' }, 401);

    const body = await req.json().catch(() => null) as { companyId?: string; address?: string } | null;
    const companyId = body?.companyId?.trim();
    const address = body?.address?.trim();
    if (!companyId || !address || address.length < 3 || address.length > 240) {
      return json({ error: 'Central y dirección válidas son obligatorias' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: company, error: companyError } = await userClient
      .from('companies')
      .select('id,name,city,country_code,center_lat,center_lng')
      .eq('id', companyId)
      .single();
    if (companyError || !company) return json({ error: 'Sin acceso a esta central' }, 403);

    const city = String(company.city || '').trim();
    const centerLat = Number(company.center_lat);
    const centerLng = Number(company.center_lng);
    const hasCenter = Number.isFinite(centerLat) && Number.isFinite(centerLng);
    const center = hasCenter ? { lat: centerLat, lng: centerLng } : undefined;
    const countryLabel = company.country_code === 'CL' ? 'Chile' : String(company.country_code || '').trim();

    // Si el operador escribe "Hualqui Arica" y la central está en Arica,
    // interpretamos Hualqui como la vía y Arica como contexto de ciudad.
    let streetCandidate = stripTrailingPlace(address, countryLabel);
    streetCandidate = stripTrailingPlace(streetCandidate, city);
    if (streetCandidate.length < 2) streetCandidate = address;

    const queryText = [streetCandidate, city, countryLabel].filter(Boolean).join(', ');
    const queryKey = await sha256(`${GEOCODER_VERSION}|${companyId}|${normalize(queryText)}`);

    const { data: cached } = await serviceClient.from('geocoding_cache')
      .select('display_name,lat,lng,provider,expires_at')
      .eq('query_key', queryKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (cached) {
      return json({
        lat: cached.lat,
        lng: cached.lng,
        displayName: cached.display_name,
        provider: cached.provider,
        cached: true,
        approximate: false,
      });
    }

    const fallbackToCompanyCenter = (reason: string) => {
      if (!hasCenter) return null;
      return json({
        lat: centerLat,
        lng: centerLng,
        displayName: address,
        provider: 'company-center-fallback',
        cached: false,
        approximate: true,
        warning: reason,
      });
    };

    const commonParams = new URLSearchParams({
      format: 'jsonv2',
      limit: '8',
      addressdetails: '1',
      namedetails: '1',
      dedupe: '1',
    });
    if (company.country_code) commonParams.set('countrycodes', String(company.country_code).toLowerCase());
    if (hasCenter) {
      // Viewbox is now a preference, not a hard fence. This prevents valid streets near
      // the edge of a city from disappearing and avoids forcing a city-center fallback.
      commonParams.set('viewbox', `${centerLng - 0.35},${centerLat + 0.35},${centerLng + 0.35},${centerLat - 0.35}`);
    }

    let results: NominatimResult[] = [];
    let provider = 'nominatim-freeform';

    try {
      // Structured street search is much better for inputs such as "Hualqui Arica",
      // "Pasaje Las Rosas" or a street without a house number.
      if (city && streetCandidate.length >= 3) {
        const structured = new URLSearchParams(commonParams);
        structured.set('street', streetCandidate);
        structured.set('city', city);
        if (countryLabel) structured.set('country', countryLabel);
        results = await fetchNominatim(structured);
        provider = 'nominatim-street';
      }

      // POIs, unusual local names, or streets missing from the structured index get one
      // free-form retry with explicit comma-separated city/country context.
      if (!results.length) {
        const freeForm = new URLSearchParams(commonParams);
        freeForm.set('q', queryText);
        results = await fetchNominatim(freeForm);
        provider = 'nominatim-freeform';
      }
    } catch {
      const fallback = fallbackToCompanyCenter('No pudimos consultar el mapa en este momento. La carrera puede despacharse usando la dirección escrita.');
      return fallback ?? json({ error: 'Servicio de geocodificación temporalmente no disponible' }, 503);
    }

    if (!results.length) {
      const fallback = fallbackToCompanyCenter('No encontramos esa dirección con precisión. Conservaremos la dirección escrita como referencia para el conductor.');
      return fallback ?? json({ error: 'No encontramos esa dirección. Agrega calle o pasaje y ciudad.' }, 404);
    }

    const ranked = results
      .map((result) => ({ result, score: scoreResult(result, address, streetCandidate, city, center) }))
      .sort((a, b) => b.score - a.score);

    let chosen = ranked[0]?.result;

    // If the structured search only returned a locality/square, retry free-form once and
    // compare both sets. A road match must beat a plaza or city-center match.
    const chosenType = normalize(chosen?.addresstype || chosen?.type || '');
    const chosenDisplay = normalize(chosen?.display_name || '');
    if (chosen && city && (placeLikeTypes.has(chosenType) || /\bplaza\b/.test(chosenDisplay))) {
      try {
        const freeForm = new URLSearchParams(commonParams);
        freeForm.set('q', queryText);
        const extra = await fetchNominatim(freeForm);
        const combined = [...results, ...extra];
        const dedup = new Map<string, NominatimResult>();
        for (const item of combined) dedup.set(`${item.lat}|${item.lon}|${item.display_name}`, item);
        chosen = [...dedup.values()]
          .map((result) => ({ result, score: scoreResult(result, address, streetCandidate, city, center) }))
          .sort((a, b) => b.score - a.score)[0]?.result;
        provider = 'nominatim-ranked';
      } catch {
        // Keep the best structured result if the optional retry fails.
      }
    }

    if (!chosen) {
      const fallback = fallbackToCompanyCenter('No encontramos esa dirección con precisión. Conservaremos la dirección escrita como referencia.');
      return fallback ?? json({ error: 'No encontramos esa dirección.' }, 404);
    }

    const lat = Number(chosen.lat);
    const lng = Number(chosen.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const fallback = fallbackToCompanyCenter('El mapa devolvió una ubicación inválida. Se conservará la dirección escrita como referencia.');
      return fallback ?? json({ error: 'Respuesta geográfica inválida' }, 502);
    }

    await serviceClient.from('geocoding_cache').upsert({
      query_key: queryKey,
      company_id: companyId,
      query_text: queryText,
      display_name: chosen.display_name,
      lat,
      lng,
      provider,
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    });

    return json({
      lat,
      lng,
      displayName: chosen.display_name,
      provider,
      cached: false,
      approximate: false,
      matchType: chosen.addresstype || chosen.type || null,
    });
  } catch (error) {
    console.error('geocode-address', error);
    return json({ error: 'No fue posible geocodificar la dirección' }, 500);
  }
});
