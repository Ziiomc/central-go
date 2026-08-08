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

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
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

    const queryText = [address, company.city, company.country_code === 'CL' ? 'Chile' : company.country_code].filter(Boolean).join(', ');
    const queryKey = await sha256(`${companyId}|${normalize(queryText)}`);
    const { data: cached } = await serviceClient.from('geocoding_cache')
      .select('display_name,lat,lng,provider,expires_at')
      .eq('query_key', queryKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (cached) return json({ lat: cached.lat, lng: cached.lng, displayName: cached.display_name, provider: cached.provider, cached: true });

    const params = new URLSearchParams({ format: 'jsonv2', limit: '3', addressdetails: '1', q: queryText });
    if (company.country_code) params.set('countrycodes', String(company.country_code).toLowerCase());
    if (company.center_lat != null && company.center_lng != null) {
      const lat = Number(company.center_lat);
      const lng = Number(company.center_lng);
      params.set('viewbox', `${lng - 0.18},${lat + 0.18},${lng + 0.18},${lat - 0.18}`);
      params.set('bounded', '0');
    }

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { Accept: 'application/json', 'Accept-Language': 'es', 'User-Agent': 'CentralGO-Pilot/0.1' },
    });
    if (!response.ok) return json({ error: 'Servicio de geocodificación temporalmente no disponible' }, 503);

    const results = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
    const result = results[0];
    if (!result) return json({ error: 'No encontramos esa dirección. Agrega calle, número y ciudad.' }, 404);
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return json({ error: 'Respuesta geográfica inválida' }, 502);

    await serviceClient.from('geocoding_cache').upsert({
      query_key: queryKey,
      company_id: companyId,
      query_text: queryText,
      display_name: result.display_name,
      lat,
      lng,
      provider: 'nominatim',
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    });
    return json({ lat, lng, displayName: result.display_name, provider: 'nominatim', cached: false });
  } catch (error) {
    console.error('geocode-address', error);
    return json({ error: 'No fue posible geocodificar la dirección' }, 500);
  }
});
