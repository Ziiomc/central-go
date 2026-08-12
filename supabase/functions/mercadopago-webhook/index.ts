import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};
const hmacSha256 = async (secret: string, value: string) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: true });
  try {
    const secret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!secret || !accessToken) return json({ error: "Mercado Pago webhook no configurado" }, 503);

    const url = new URL(req.url);
    const body = await req.json().catch(() => ({})) as any;
    const topic = (url.searchParams.get("type") || body?.type || "").toLowerCase();
    const dataId = String(url.searchParams.get("data.id") || body?.data?.id || "");
    if (topic && topic !== "payment") return json({ ok: true, ignored: topic });
    if (!dataId) return json({ error: "Falta data.id" }, 400);

    const signature = req.headers.get("x-signature") || "";
    const requestId = req.headers.get("x-request-id") || "";
    const parts = new Map(signature.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    }));
    const ts = parts.get("ts") || "";
    const v1 = parts.get("v1") || "";
    if (!ts || !v1) return json({ error: "Firma incompleta" }, 401);

    const manifest = [dataId ? `id:${dataId};` : "", requestId ? `request-id:${requestId};` : "", ts ? `ts:${ts};` : ""].join("");
    const calculated = await hmacSha256(secret, manifest);
    if (!safeEqual(calculated.toLowerCase(), v1.toLowerCase())) return json({ error: "Firma inválida" }, 401);

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    });
    const payment = await paymentRes.json().catch(() => ({}));
    if (!paymentRes.ok) return json({ error: "No fue posible verificar el pago" }, 502);

    const companyId = String(payment?.metadata?.company_id || "");
    const planId = String(payment?.metadata?.plan_id || "");
    const billingCycle = payment?.metadata?.billing_cycle === "annual" ? "annual" : "monthly";
    if (!companyId || !planId) return json({ error: "Pago sin metadata de Central GO" }, 422);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const [{ data: plan, error: planError }, { data: subscription, error: subReadError }] = await Promise.all([
      db.from("subscription_plans").select("id,code,name,monthly_price_clp,annual_price_clp,active").eq("id", planId).eq("active", true).single(),
      db.from("subscriptions").select("id,company_id").eq("company_id", companyId).maybeSingle(),
    ]);
    if (planError || !plan) return json({ error: "Plan de Central GO no válido" }, 422);
    if (subReadError) throw subReadError;

    const expectedAmount = billingCycle === "annual" ? Number(plan.annual_price_clp) : Number(plan.monthly_price_clp);
    const paidAmount = Number(payment?.transaction_amount ?? -1);
    const currency = String(payment?.currency_id || "").toUpperCase();
    const expectedReference = `centralgo|${companyId}|${planId}|${billingCycle}`;
    if (currency !== "CLP" || !Number.isFinite(paidAmount) || Math.abs(paidAmount - expectedAmount) > 0.01 || String(payment?.external_reference || "") !== expectedReference) {
      return json({ error: "El pago no coincide con la contratación esperada" }, 422);
    }

    const mpStatus = String(payment?.status || "");
    const localPaymentStatus = mpStatus === "approved" ? "paid" : ["rejected", "cancelled"].includes(mpStatus) ? "failed" : "pending";
    const paymentId = String(payment?.id ?? dataId);
    const paidAt = payment?.date_approved || null;
    const subscriptionId = subscription?.id ?? null;

    const { error: paymentError } = await db.from("payments").upsert({
      company_id: companyId,
      subscription_id: subscriptionId,
      provider: "mercadopago",
      external_payment_id: paymentId,
      currency: "CLP",
      gross_amount: paidAmount,
      status: localPaymentStatus,
      paid_at: paidAt,
      metadata: { mercado_pago_status: mpStatus, status_detail: payment?.status_detail ?? null, plan_id: planId, plan_code: plan.code, billing_cycle: billingCycle, payer_id: payment?.payer?.id ?? null },
    }, { onConflict: "provider,external_payment_id" });
    if (paymentError) throw paymentError;

    if (mpStatus === "approved") {
      const now = new Date();
      const periodEnd = new Date(now);
      if (billingCycle === "annual") periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1);
      else periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

      const { data: savedSubscription, error: subscriptionError } = await db.from("subscriptions").upsert({
        company_id: companyId,
        plan_id: planId,
        billing_cycle: billingCycle,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        external_customer_id: payment?.payer?.id ? String(payment.payer.id) : null,
        updated_at: now.toISOString(),
      }, { onConflict: "company_id" }).select("id").single();
      if (subscriptionError) throw subscriptionError;

      await db.from("payments").update({ subscription_id: savedSubscription.id }).eq("provider", "mercadopago").eq("external_payment_id", paymentId);
      const { error: saasError } = await db.from("saas_accounts").update({ status: "active", activated_at: now.toISOString(), current_period_end: periodEnd.toISOString(), updated_at: now.toISOString() }).eq("company_id", companyId);
      if (saasError) throw saasError;
    }

    return json({ ok: true, paymentId, status: mpStatus, localStatus: localPaymentStatus });
  } catch (error) {
    console.error("mercadopago-webhook", error);
    return json({ error: "No fue posible procesar la notificación" }, 500);
  }
});
