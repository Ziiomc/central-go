import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const expectedSecret = Deno.env.get("CENTRALGO_INTERNAL_SECRET");
  const suppliedSecret = req.headers.get("x-centralgo-internal-secret");
  if (!expectedSecret || suppliedSecret !== expectedSecret) return json({ error: "No autorizado" }, 401);

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const now = new Date().toISOString();

    const { error: releaseError } = await db
      .from("commission_ledger")
      .update({ status: "available" })
      .eq("status", "confirmed")
      .lte("available_at", now);
    if (releaseError) throw releaseError;

    const { data: accounts, error: accountError } = await db
      .from("partner_payout_accounts")
      .select("partner_id,provider,external_account_id,status,auto_payout")
      .eq("status", "verified")
      .eq("auto_payout", true);
    if (accountError) throw accountError;

    const { data: linkedItems, error: itemsError } = await db.from("partner_payout_items").select("commission_id");
    if (itemsError) throw itemsError;
    const alreadyQueued = new Set((linkedItems ?? []).map((item: any) => item.commission_id));

    const created: Array<{ payoutId: string; partnerId: string; provider: string; amount: number; commissionCount: number }> = [];
    for (const account of accounts ?? []) {
      if (!account.external_account_id && account.provider !== "manual") continue;
      const { data: commissions, error: commissionError } = await db
        .from("commission_ledger")
        .select("id,amount")
        .eq("partner_id", account.partner_id)
        .eq("status", "available")
        .gt("amount", 0);
      if (commissionError) throw commissionError;
      const pending = (commissions ?? []).filter((item: any) => !alreadyQueued.has(item.id));
      if (!pending.length) continue;
      const amount = pending.reduce((sum: number, item: any) => sum + Number(item.amount ?? 0), 0);
      if (!(amount > 0)) continue;

      const { data: payout, error: payoutError } = await db.from("partner_payouts").insert({
        partner_id: account.partner_id,
        currency: "CLP",
        amount,
        status: "pending",
        provider: account.provider,
        requested_at: now,
        notes: "Liquidación automática preparada por Central GO. Pendiente de confirmación del proveedor de pagos.",
      }).select("id").single();
      if (payoutError || !payout) throw payoutError ?? new Error("No fue posible crear la liquidación");

      const { error: linkError } = await db.from("partner_payout_items").insert(pending.map((item: any) => ({
        payout_id: payout.id,
        commission_id: item.id,
        amount: item.amount,
      })));
      if (linkError) throw linkError;
      pending.forEach((item: any) => alreadyQueued.add(item.id));
      created.push({ payoutId: payout.id, partnerId: account.partner_id, provider: account.provider, amount, commissionCount: pending.length });
    }

    return json({ ok: true, createdCount: created.length, payouts: created });
  } catch (error) {
    console.error("partner-payout-processor", error);
    return json({ error: "No fue posible preparar las liquidaciones" }, 500);
  }
});
