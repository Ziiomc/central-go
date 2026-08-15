import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const fallback = "https://central-go-one.vercel.app/";
const redirectWith = (base: string, status: string, detail?: string) => {
  const url = new URL(base || fallback);
  url.searchParams.set("mercadopago", status);
  if (detail) url.searchParams.set("detail", detail.slice(0, 160));
  return Response.redirect(url.toString(), 302);
};

Deno.serve(async (req: Request) => {
  let returnUrl = fallback;
  try {
    const requestUrl = new URL(req.url);
    const state = requestUrl.searchParams.get("state") || "";
    const code = requestUrl.searchParams.get("code") || "";
    const oauthError = requestUrl.searchParams.get("error") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("MERCADOPAGO_CLIENT_ID");
    const clientSecret = Deno.env.get("MERCADOPAGO_CLIENT_SECRET");
    const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    if (!state) return redirectWith(fallback, "error", "Estado OAuth inválido");
    const { data: row } = await service
      .from("mercadopago_platform_oauth_states")
      .select("state,user_id,code_verifier,return_url,expires_at")
      .eq("state", state)
      .maybeSingle();
    if (!row) return redirectWith(fallback, "error", "La autorización expiró o no existe");
    returnUrl = row.return_url || fallback;

    await service.from("mercadopago_platform_oauth_states").delete().eq("state", state);
    if (new Date(row.expires_at).getTime() < Date.now()) return redirectWith(returnUrl, "error", "La autorización expiró");
    if (oauthError) return redirectWith(returnUrl, "cancelled", oauthError);
    if (!clientId || !clientSecret) return redirectWith(returnUrl, "error", "Faltan credenciales de la aplicación Mercado Pago");
    if (!code) return redirectWith(returnUrl, "error", "Mercado Pago no devolvió el código de autorización");

    const callback = `${supabaseUrl}/functions/v1/mercadopago-oauth-callback`;
    const form = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: callback,
      state,
      code_verifier: row.code_verifier,
    });
    const response = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: form.toString(),
    });
    const token = await response.json().catch(() => ({}));
    if (!response.ok || !token?.access_token) {
      console.error("Mercado Pago OAuth exchange", response.status, token?.error || token?.message || "unknown");
      return redirectWith(returnUrl, "error", String(token?.message || token?.error || "No se pudo conectar Mercado Pago"));
    }

    const expiresIn = Math.max(60, Number(token.expires_in || 15552000));
    const { error } = await service.from("mercadopago_platform_connections").upsert({
      connection_key: "primary",
      connected_by: row.user_id,
      mp_user_id: token.user_id != null ? String(token.user_id) : null,
      public_key: token.public_key || null,
      access_token: String(token.access_token),
      refresh_token: token.refresh_token ? String(token.refresh_token) : null,
      token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      scope: token.scope ? String(token.scope) : null,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "connection_key" });
    if (error) throw error;

    return redirectWith(returnUrl, "connected");
  } catch (error) {
    console.error("mercadopago-oauth-callback", error);
    return redirectWith(returnUrl, "error", error instanceof Error ? error.message : "Error OAuth");
  }
});

