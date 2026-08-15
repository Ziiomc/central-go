const TOKEN_ENDPOINT = "https://api.mercadopago.com/oauth/token";

type ConnectionRow = {
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
};

const freshForAtLeast = (expiresAt: string | null, milliseconds: number) => {
  if (!expiresAt) return true;
  const timestamp = new Date(expiresAt).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now() + milliseconds;
};

export async function resolveMercadoPagoAccessToken(db: any): Promise<string | null> {
  const { data } = await db
    .from("mercadopago_platform_connections")
    .select("access_token,refresh_token,token_expires_at")
    .eq("connection_key", "primary")
    .maybeSingle() as { data: ConnectionRow | null };

  if (!data?.access_token) return Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || null;
  if (freshForAtLeast(data.token_expires_at, 5 * 60 * 1000)) return data.access_token;

  const clientId = Deno.env.get("MERCADOPAGO_CLIENT_ID");
  const clientSecret = Deno.env.get("MERCADOPAGO_CLIENT_SECRET");
  if (!data.refresh_token || !clientId || !clientSecret) return null;

  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: data.refresh_token,
  });
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form.toString(),
  });
  const token = await response.json().catch(() => ({}));
  if (!response.ok || !token?.access_token) {
    console.error("Mercado Pago token refresh failed", response.status, token?.error || token?.message || "unknown");
    return null;
  }

  const expiresIn = Math.max(60, Number(token.expires_in || 15552000));
  const nextAccessToken = String(token.access_token);
  await db.from("mercadopago_platform_connections").update({
    access_token: nextAccessToken,
    refresh_token: token.refresh_token ? String(token.refresh_token) : data.refresh_token,
    public_key: token.public_key || null,
    scope: token.scope ? String(token.scope) : null,
    token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("connection_key", "primary");

  return nextAccessToken;
}

