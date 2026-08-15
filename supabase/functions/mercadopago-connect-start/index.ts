import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});
const base64url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};
const allowedReturn = (value: unknown) => {
  try {
    const url = new URL(String(value || "https://central-go-one.vercel.app/"));
    if (url.protocol === "https:" && url.hostname === "central-go-one.vercel.app") {
      return `${url.origin}${url.pathname}`;
    }
  } catch { /* Use the canonical application URL. */ }
  return "https://central-go-one.vercel.app/";
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, message: "Método no permitido" }, 405);

  try {
    const clientId = Deno.env.get("MERCADOPAGO_CLIENT_ID");
    const clientSecret = Deno.env.get("MERCADOPAGO_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return json({
        ok: false,
        code: "MERCADOPAGO_APP_NOT_CONFIGURED",
        message: "La aplicación Mercado Pago de Central GO aún necesita su Client ID y Client Secret.",
      }, 503);
    }

    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ ok: false, message: "Sesión requerida." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: auth, error: authError } = await service.auth.getUser(jwt);
    if (authError || !auth.user) return json({ ok: false, message: "Sesión inválida." }, 401);

    const { data: profile } = await service
      .from("profiles")
      .select("global_role,active")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (!profile?.active || profile.global_role !== "super_admin") {
      return json({ ok: false, message: "Solo un administrador global puede vincular la cuenta de cobro." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)));
    const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    const state = crypto.randomUUID();
    const callback = `${supabaseUrl}/functions/v1/mercadopago-oauth-callback`;

    await service.from("mercadopago_platform_oauth_states").delete().lt("expires_at", new Date().toISOString());
    const { error: stateError } = await service.from("mercadopago_platform_oauth_states").insert({
      state,
      user_id: auth.user.id,
      code_verifier: verifier,
      return_url: allowedReturn(body?.returnUrl),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (stateError) throw stateError;

    const url = new URL("https://auth.mercadopago.cl/authorization");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("platform_id", "mp");
    url.searchParams.set("state", state);
    url.searchParams.set("redirect_uri", callback);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");

    return json({ ok: true, authorizationUrl: url.toString() });
  } catch (error) {
    console.error("mercadopago-connect-start", error);
    return json({ ok: false, message: error instanceof Error ? error.message : "No se pudo iniciar Mercado Pago." }, 500);
  }
});

