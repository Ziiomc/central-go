import React, { useEffect, useMemo, useState } from 'react';
import { Check, Crown, Loader2, ShieldCheck, Sparkles, WalletCards, X, Zap } from 'lucide-react';
import { requireSupabase } from '../../lib/supabase';
import { loadPlanCatalog, type CommercialPlanRecord } from '../../lib/planRepository';
import { createRemitlyPaymentRequest, type RemitlyPaymentRequest } from '../../lib/remitlyPaymentRepository';
import { readEdgeFunctionError } from '../../lib/edgeFunctionError';
import { RemitlyPaymentPanel } from './RemitlyPaymentPanel';

const money = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

export const UpgradePlanModal: React.FC<{ companyId: string; onClose: () => void }> = ({ companyId, onClose }) => {
  const [plans, setPlans] = useState<CommercialPlanRecord[]>([]);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [remitlyRequest, setRemitlyRequest] = useState<RemitlyPaymentRequest | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    loadPlanCatalog()
      .then((rows) => { if (alive) setPlans(rows); })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : 'No pudimos cargar los planes.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const ordered = useMemo(() => [...plans].sort((a, b) => a.monthlyPrice - b.monthlyPrice), [plans]);

  const checkout = async (plan: CommercialPlanRecord) => {
    setPaying(`mp:${plan.code}`);
    setError('');
    try {
      const { data, error: invokeError } = await requireSupabase().functions.invoke('mercadopago-create-checkout', {
        body: { companyId, planCode: plan.code, billingCycle: billing },
      });
      if (invokeError) throw invokeError;
      if (!data?.checkoutUrl) {
        if (data?.code === 'MERCADOPAGO_NOT_CONFIGURED') throw new Error('Mercado Pago está listo en Central GO, pero todavía faltan las credenciales privadas del comercio.');
        throw new Error(data?.error || 'No pudimos iniciar el checkout.');
      }
      window.location.assign(String(data.checkoutUrl));
    } catch (err) {
      setError(await readEdgeFunctionError(err, 'No pudimos iniciar el pago.'));
      setPaying(null);
    }
  };

  const openRemitly = async (plan: CommercialPlanRecord) => {
    setPaying(`rm:${plan.code}`);
    setError('');
    try {
      const request = await createRemitlyPaymentRequest({ companyId, planCode: plan.code, billingCycle: billing });
      setRemitlyRequest(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos preparar el pago internacional.');
    } finally { setPaying(null); }
  };

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/85 p-3 backdrop-blur-xl" role="dialog" aria-modal="true">
      <div className="mx-auto my-5 w-full max-w-5xl rounded-3xl border border-zinc-700 bg-[#0b0b0e] shadow-2xl shadow-black/70">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-800 p-5 md:p-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-300"><Sparkles className="h-3.5 w-3.5"/> Activa Central GO</div>
            <h2 className="mt-3 text-2xl font-black text-white md:text-3xl">Activar modo Pro</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-400">Elige el nivel que necesita tu central. Tus datos, conductores e historial permanecen intactos al cambiar de plan.</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-400 hover:text-white" aria-label="Cerrar"><X className="h-5 w-5"/></button>
        </header>

        <div className="p-5 md:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-[10px] font-bold text-emerald-300"><ShieldCheck className="h-4 w-4"/> Mercado Pago automático · Remitly internacional</div>
            <div className="flex rounded-xl border border-zinc-800 bg-zinc-950 p-1">
              <button onClick={() => setBilling('monthly')} className={`rounded-lg px-4 py-2 text-[10px] font-black ${billing === 'monthly' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>Mensual</button>
              <button onClick={() => setBilling('annual')} className={`rounded-lg px-4 py-2 text-[10px] font-black ${billing === 'annual' ? 'bg-emerald-400 text-zinc-950' : 'text-emerald-400'}`}>Anual · ahorra</button>
            </div>
          </div>

          {loading && <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs font-bold text-blue-300"><Loader2 className="h-4 w-4 animate-spin"/> Cargando planes oficiales…</div>}
          {error && <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs font-semibold leading-relaxed text-amber-100">{error}</div>}

          {!loading && (
            <div className="grid gap-4 lg:grid-cols-3">
              {ordered.map((plan) => {
                const enterprise = plan.code === 'enterprise';
                const pro = plan.code === 'pro';
                const amount = billing === 'annual' ? plan.annualPrice : plan.monthlyPrice;
                const monthlyEquivalent = billing === 'annual' ? plan.annualMonthlyPrice : plan.monthlyPrice;
                const bullets = [
                  plan.maxVehicles == null ? 'Móviles ilimitados' : `Hasta ${plan.maxVehicles} móviles`,
                  plan.driverAppEnabled ? 'App profesional de conductores' : 'Despacho web para la central',
                  plan.features.live_gps ? 'GPS en vivo' : `${plan.historyDays ?? 0} días de historial`,
                  plan.features.advanced_reports ? 'Analítica y reportes avanzados' : 'Operación esencial',
                ];
                const mpBusy = paying === `mp:${plan.code}`;
                const rmBusy = paying === `rm:${plan.code}`;
                return (
                  <article key={plan.id} className={`relative flex flex-col rounded-3xl border p-5 ${enterprise ? 'border-purple-400/50 bg-purple-500/[0.08] shadow-xl shadow-purple-950/20' : pro ? 'border-amber-400/50 bg-amber-500/[0.07] ring-1 ring-amber-500/10' : 'border-zinc-800 bg-[#111114]'}`}>
                    {pro && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-zinc-950">Modo Pro · recomendado para operar</span>}
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${enterprise ? 'border-purple-500/30 bg-purple-500/10 text-purple-300' : pro ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-blue-500/30 bg-blue-500/10 text-blue-300'}`}>{enterprise ? <Crown className="h-5 w-5"/> : <Zap className="h-5 w-5"/>}</div>
                    <h3 className="mt-4 text-xl font-black text-white">{plan.name}</h3>
                    <p className="mt-1 min-h-10 text-[11px] leading-relaxed text-zinc-500">{plan.features.description}</p>
                    <div className="mt-4"><p className="text-3xl font-black text-white">{money(monthlyEquivalent)}<span className="text-[10px] text-zinc-500"> / mes</span></p>{billing === 'annual' && <p className="mt-1 text-[9px] font-bold text-emerald-400">Cobro anual: {money(amount)}</p>}</div>
                    <div className="my-5 space-y-2 border-t border-zinc-800 pt-4">{bullets.map((bullet) => <div key={bullet} className="flex items-center gap-2 text-[10px] font-semibold text-zinc-300"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400"><Check className="h-3 w-3"/></span>{bullet}</div>)}</div>
                    <div className="mt-auto space-y-2">
                      <button disabled={Boolean(paying)} onClick={() => void checkout(plan)} className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black disabled:opacity-50 ${pro ? 'bg-amber-400 text-zinc-950' : enterprise ? 'bg-purple-500 text-white' : 'bg-blue-600 text-white'}`}>{mpBusy ? <Loader2 className="h-4 w-4 animate-spin"/> : null}{mpBusy ? 'Abriendo Mercado Pago…' : 'Pagar con Mercado Pago'}</button>
                      <button disabled={Boolean(paying)} onClick={() => void openRemitly(plan)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-[10px] font-black text-blue-200 disabled:opacity-50">{rmBusy ? <Loader2 className="h-4 w-4 animate-spin"/> : <WalletCards className="h-4 w-4"/>}{rmBusy ? 'Preparando factura…' : 'Pago internacional · Remitly'}</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <p className="mt-5 text-center text-[9px] leading-relaxed text-zinc-600">Mercado Pago activa mediante confirmación automática del proveedor. Los pagos Remitly requieren comprobante y confirmación manual del Administrador Global antes de habilitar la suscripción.</p>
        </div>
      </div>
      {remitlyRequest && <RemitlyPaymentPanel request={remitlyRequest} onClose={() => setRemitlyRequest(null)} onSubmitted={() => setError('Pago Remitly enviado correctamente. Quedó pendiente de validación global.')} />}
    </div>
  );
};
