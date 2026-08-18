import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { resolveMercadoPagoAccessToken } from "../_shared/mercadopago.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Sesión requerida" }, 401);

    const webhookSecret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
    if (!webhookSecret) {
      return json({ code: "MERCADOPAGO_WEBHOOK_NOT_CONFIGURED", error: "Falta configurar la firma privada del webhook de Mercado Pago." }, 503);
    }

    const body = await req.json().catch(() => ({})) as { companyId?: string; planCode?: string; billingCycle?: "monthly" | "annual" };
    const companyId = body.companyId?.trim();
    const planCode = body.planCode?.trim().toLowerCase();
    const billingCycle = body.billingCycle === "annual" ? "annual" : "monthly";
    if (!companyId || !["start", "pro", "enterprise"].includes(planCode ?? "")) return json({ error: "Central y plan válidos son obligatorios" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Sesión inválida" }, 401);
    const user = userData.user;

    const [{ data: profile }, { data: membership }, { data: plan, error: planError }] = await Promise.all([
      service.from("profiles").select("global_role").eq("id", user.id).maybeSingle(),
      service.from("company_memberships").select("role,active").eq("company_id", companyId).eq("user_id", user.id).eq("active", true).maybeSingle(),
      service.from("subscription_plans").select("id,code,name,monthly_price_clp,annual_price_clp,active").eq("code", planCode).eq("active", true).single(),
    ]);
    const allowed = profile?.global_role === "super_admin" || membership?.role === "company_admin";
    if (!allowed) return json({ error: "Solo el administrador de la central puede contratar un plan" }, 403);
    if (planError || !plan) return json({ error: "Plan no disponible" }, 404);

    // Validar antes de generar la preferencia evita cobrar un plan que no puede
    // alojar la flota, operadoras o accesos de conductor actuales de la central.
    const { error: fitError } = await service.rpc("centralgo_assert_plan_capacity", {
      p_company_id: companyId,
      p_plan_id: plan.id,
    });
    if (fitError) {
      return json({ code: "PLAN_CAPACITY_MISMATCH", error: fitError.message }, 409);
    }

    const accessToken = await resolveMercadoPagoAccessToken(service);
    if (!accessToken) {
      return json({ code: "MERCADOPAGO_ACCOUNT_NOT_CONNECTED", error: "La cuenta de Mercado Pago todavía no está vinculada o necesita renovarse." }, 503);
    }

    const amount = billingCycle === "annual" ? Number(plan.annual_price_clp) : Number(plan.monthly_price_clp);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: "Valor de plan inválido" }, 500);
    const publicUrl = (Deno.env.get("CENTRALGO_PUBLIC_URL") || "https://central-go-one.vercel.app").replace(/\/$/, "");
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;
    const externalReference = `centralgo|${companyId}|${plan.id}|${billingCycle}`;

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: plan.id, title: `Central GO ${plan.name} · ${billingCycle === "annual" ? "Plan anual" : "Plan mensual"}`, quantity: 1, currency_id: "CLP", unit_price: amount }],
        payer: { email: user.email },
        external_reference: externalReference,
        metadata: { company_id: companyId, plan_id: plan.id, plan_code: plan.code, billing_cycle: billingCycle, centralgo_user_id: user.id },
        back_urls: {
          success: `${publicUrl}/?payment=success`,
          pending: `${publicUrl}/?payment=pending`,
          failure: `${publicUrl}/?payment=failure`,
        },
        auto_return: "approved",
        notification_url: webhookUrl,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Mercado Pago preference", response.status, result);
      return json({ error: "Mercado Pago rechazó la creación del checkout", detail: result?.message ?? null }, 502);
    }
    return json({ preferenceId: result.id, checkoutUrl: result.init_point, sandboxUrl: result.sandbox_init_point ?? null, plan: plan.code, billingCycle, amount });
  } catch (error) {
    console.error("mercadopago-create-checkout", error);
    return json({ error: "No fue posible iniciar el pago" }, 500);
  }
});
