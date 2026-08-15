import React, { useEffect, useMemo, useState } from 'react';
import { BadgePercent, CalendarClock, CheckCircle2, Crown, Loader2, Sparkles, X } from 'lucide-react';
import { activateNetworkCentralManual, type NetworkCentralRecord } from '../../lib/networkRepository';
import { loadPlanCatalog, type CommercialPlanRecord } from '../../lib/planRepository';
import { money } from './NetworkUi';

type Mode = 'monthly' | 'annual_upfront' | 'annual_monthly';

interface ManualSubscriptionModalProps {
  open: boolean;
  central: NetworkCentralRecord | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const modeForCentral = (central: NetworkCentralRecord | null): Mode => {
  if (!central || central.billingCycle !== 'annual') return 'monthly';
  return central.paymentFrequency === 'monthly' ? 'annual_monthly' : 'annual_upfront';
};

const modeCopy: Record<Mode, { title: string; detail: string }> = {
  monthly: { title: 'Mensual', detail: 'Mes a mes · pago mensual · sin compromiso anual.' },
  annual_upfront: { title: 'Anual · pago anual', detail: '12 meses de servicio y un solo pago anual.' },
  annual_monthly: { title: 'Anual · pago mensual', detail: 'Compromiso por 12 meses, manteniendo cobros mensuales.' },
};

export const ManualSubscriptionModal: React.FC<ManualSubscriptionModalProps> = ({ open, central, onClose, onSaved }) => {
  const [plans, setPlans] = useState<CommercialPlanRecord[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [planCode, setPlanCode] = useState<'start' | 'pro' | 'enterprise'>('enterprise');
  const [mode, setMode] = useState<Mode>('monthly');
  const [specialOffer, setSpecialOffer] = useState(false);
  const [discount, setDiscount] = useState('0');
  const [offerLabel, setOfferLabel] = useState('');
  const [offerNotes, setOfferNotes] = useState('');

  useEffect(() => {
    if (!open || !central) return;
    setPlanCode(central.planCode || 'enterprise');
    setMode(modeForCentral(central));
    const hasOffer = central.discountPercent > 0 || Boolean(central.offerLabel);
    setSpecialOffer(hasOffer);
    setDiscount(String(central.discountPercent || 0));
    setOfferLabel(central.offerLabel || '');
    setOfferNotes(central.offerNotes || '');
    setError('');
  }, [open, central]);

  useEffect(() => {
    if (!open || plans.length) return;
    setLoadingPlans(true);
    loadPlanCatalog()
      .then(setPlans)
      .catch((err) => setError(err instanceof Error ? err.message : 'No fue posible cargar los planes.'))
      .finally(() => setLoadingPlans(false));
  }, [open, plans.length]);

  const selectedPlan = useMemo(() => plans.find((plan) => plan.code === planCode) ?? null, [plans, planCode]);
  const discountNumber = Math.min(100, Math.max(0, Number(discount) || 0));
  const baseAmount = useMemo(() => {
    if (!selectedPlan) return 0;
    if (mode === 'annual_upfront') return selectedPlan.annualPrice;
    if (mode === 'annual_monthly') return selectedPlan.annualMonthlyPrice;
    return selectedPlan.monthlyPrice;
  }, [selectedPlan, mode]);
  const finalAmount = Math.max(0, Math.round(baseAmount * (1 - (specialOffer ? discountNumber : 0) / 100)));
  const annualTotal = mode === 'annual_monthly' ? finalAmount * 12 : mode === 'annual_upfront' ? finalAmount : null;

  if (!open || !central) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPlan) { setError('Selecciona un plan válido.'); return; }
    if (specialOffer && (discountNumber <= 0 || discountNumber >= 100)) { setError('El descuento especial debe ser mayor a 0% y menor a 100%.'); return; }
    setSaving(true); setError('');
    try {
      const term = mode === 'monthly' ? 'monthly' : 'annual';
      const paymentFrequency = mode === 'annual_upfront' ? 'annual' : 'monthly';
      const result = await activateNetworkCentralManual({
        companyId: central.id,
        planCode,
        term,
        paymentFrequency,
        discountPercent: specialOffer ? discountNumber : 0,
        offerLabel: specialOffer ? (offerLabel.trim() || 'Oferta especial') : '',
        offerNotes: specialOffer ? offerNotes : '',
      });
      const modality = result.term === 'annual'
        ? (result.paymentFrequency === 'monthly' ? 'anual con pago mensual' : 'anual con pago anual')
        : 'mensual';
      onSaved(`${central.name}: ${result.planName} activado en modalidad ${modality}${result.discountPercent > 0 ? ` con ${result.discountPercent}% de descuento` : ''}.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible activar la suscripción.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md">
      <form onSubmit={submit} className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-zinc-700 bg-[#0d0d0f] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-zinc-800 bg-[#0d0d0f]/95 p-5 backdrop-blur-xl">
          <div>
            <div className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-amber-300"><Crown className="h-3.5 w-3.5" />Activación manual Superadmin</div>
            <h2 className="mt-2 text-xl font-black text-white">Plan y suscripción de {central.name}</h2>
            <p className="mt-1 text-xs text-zinc-500">Toda activación exige elegir plan, modalidad de contrato y forma de pago.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-zinc-800 bg-zinc-900 p-2.5 text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-6 p-5 md:p-6">
          {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{error}</div>}
          {loadingPlans ? <div className="flex items-center gap-2 text-xs font-bold text-blue-300"><Loader2 className="h-4 w-4 animate-spin" />Cargando catálogo de planes…</div> : (
            <section>
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">1. Elige el plan</p>
              <div className="grid gap-3 md:grid-cols-3">
                {plans.map((plan) => <button key={plan.id} type="button" onClick={() => setPlanCode(plan.code)} className={`rounded-2xl border p-4 text-left transition ${planCode === plan.code ? 'border-blue-400/60 bg-blue-500/10 ring-2 ring-blue-500/10' : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'}`}><div className="flex items-center justify-between"><span className="text-sm font-black text-white">{plan.name}</span>{plan.recommended && <span className="rounded-full bg-purple-500/15 px-2 py-1 text-[8px] font-black uppercase text-purple-300">Recomendado</span>}</div><p className="mt-2 text-[10px] text-zinc-500">{money(plan.monthlyPrice)}/mes</p><p className="mt-1 text-[9px] font-bold text-emerald-400">Anual: {money(plan.annualPrice)}</p></button>)}
              </div>
            </section>
          )}

          <section>
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">2. Modalidad de suscripción</p>
            <div className="grid gap-3 lg:grid-cols-3">
              {(Object.keys(modeCopy) as Mode[]).map((item) => <button key={item} type="button" onClick={() => setMode(item)} className={`rounded-2xl border p-4 text-left transition ${mode === item ? 'border-emerald-400/50 bg-emerald-500/10 ring-2 ring-emerald-500/10' : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'}`}><div className="flex items-center gap-2"><CalendarClock className={`h-4 w-4 ${mode === item ? 'text-emerald-300' : 'text-zinc-600'}`} /><span className="text-xs font-black text-white">{modeCopy[item].title}</span></div><p className="mt-2 text-[9px] leading-relaxed text-zinc-500">{modeCopy[item].detail}</p></button>)}
            </div>
            {mode === 'annual_monthly' && <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-[10px] leading-relaxed text-amber-200"><strong>Oferta anual en cuotas:</strong> Central GO mantiene el compromiso anual, pero la próxima facturación vence cada mes. El sistema conserva por separado la fecha de cobro y el fin del compromiso.</div>}
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/45 p-4">
            <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={specialOffer} onChange={(e) => setSpecialOffer(e.target.checked)} className="mt-1 h-4 w-4 accent-amber-500" /><div><div className="flex items-center gap-2 text-xs font-black text-white"><BadgePercent className="h-4 w-4 text-amber-300" />Agregar oferta especial</div><p className="mt-1 text-[9px] text-zinc-500">Aplica un descuento exclusivo a esta central sin modificar los precios oficiales del catálogo.</p></div></label>
            {specialOffer && <div className="mt-4 grid gap-3 md:grid-cols-2"><label><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-zinc-500">Descuento %</span><input type="number" min="1" max="99" step="0.5" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm font-bold text-white outline-none focus:border-amber-500/50" /></label><label><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-zinc-500">Nombre de la oferta</span><input value={offerLabel} onChange={(e) => setOfferLabel(e.target.value)} placeholder="Ej. Lanzamiento Maule" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-amber-500/50" /></label><label className="md:col-span-2"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-zinc-500">Nota interna opcional</span><textarea value={offerNotes} onChange={(e) => setOfferNotes(e.target.value)} rows={2} placeholder="Motivo o condiciones comerciales de esta excepción…" className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-amber-500/50" /></label></div>}
          </section>

          <section className="overflow-hidden rounded-2xl border border-blue-500/25 bg-blue-500/[0.05]">
            <div className="flex items-center gap-2 border-b border-blue-500/15 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-blue-300"><Sparkles className="h-4 w-4" />Resumen antes de activar</div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"><Summary label="Plan" value={selectedPlan?.name ?? '—'} /><Summary label="Modalidad" value={modeCopy[mode].title} /><Summary label="Precio base" value={money(baseAmount)} /><Summary label="Pago final" value={money(finalAmount)} strong /></div>
            {specialOffer && <div className="mx-4 mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2.5 text-[10px] text-emerald-200">Ahorro aplicado: <strong>{money(baseAmount - finalAmount)} ({discountNumber}%)</strong>{annualTotal != null && <> · Total comprometido del año: <strong>{money(annualTotal)}</strong></>}</div>}
          </section>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3 text-xs font-black text-zinc-300">Cancelar</button><button disabled={saving || loadingPlans || !selectedPlan} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-xs font-black text-zinc-950 shadow-lg shadow-emerald-950/20 disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{saving ? 'Activando…' : central.status === 'active' ? 'Guardar plan y oferta' : 'Activar suscripción'}</button></div>
        </div>
      </form>
    </div>
  );
};

const Summary: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{label}</p><p className={`mt-1 text-xs font-black ${strong ? 'text-emerald-300' : 'text-white'}`}>{value}</p></div>;
