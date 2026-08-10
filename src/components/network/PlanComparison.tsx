import React, { useEffect, useMemo, useState } from 'react';
import { Check, Crown, Loader2, Sparkles, X, Zap } from 'lucide-react';
import { loadPlanCatalog, type CommercialPlanRecord } from '../../lib/planRepository';
import { money } from './NetworkUi';

interface PlanComparisonProps {
  title?: string;
  subtitle?: string;
  salesMode?: boolean;
}

type FeatureRow = {
  label: string;
  value: (plan: CommercialPlanRecord) => string | boolean;
  important?: boolean;
};

const featureRows: FeatureRow[] = [
  { label: 'Despacho + mapa operacional', value: (p) => p.features.dispatch_map },
  { label: 'Cantidad de móviles', value: (p) => p.maxVehicles == null ? 'Ilimitados' : `Hasta ${p.maxVehicles}` },
  { label: 'Operadoras', value: (p) => p.maxOperators == null ? 'Ilimitadas' : `Hasta ${p.maxOperators}` },
  { label: 'Historial de carreras', value: (p) => p.features.client_history },
  { label: 'App independiente para conductores', value: (p) => p.features.driver_app, important: true },
  { label: 'GPS en vivo desde el conductor', value: (p) => p.features.live_gps, important: true },
  { label: 'Reportes avanzados', value: (p) => p.features.advanced_reports },
  { label: 'Soporte prioritario', value: (p) => p.features.priority_support },
  { label: 'Múltiples sedes y ciudades', value: (p) => p.features.multi_branch, important: true },
  { label: 'API e integraciones', value: (p) => p.features.api_integrations, important: true },
  { label: 'Onboarding + SLA preferente', value: (p) => p.features.onboarding_sla },
  { label: 'Ejecutivo regional asignado', value: (p) => p.features.regional_executive },
];

export const PlanComparison: React.FC<PlanComparisonProps> = ({
  title = 'Planes para presentar al cliente',
  subtitle = 'Valores sincronizados con Central GO. Las diferencias están visibles para facilitar una venta clara.',
  salesMode = false,
}) => {
  const [plans, setPlans] = useState<CommercialPlanRecord[]>([]);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadPlanCatalog()
      .then((rows) => { if (alive) setPlans(rows); })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : 'No fue posible cargar los planes.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const ordered = useMemo(() => [...plans].sort((a, b) => a.monthlyPrice - b.monthlyPrice), [plans]);

  return (
    <section className="rounded-3xl border border-zinc-800 bg-[#0d0d0f] p-5 md:p-7 shadow-xl">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
            <Sparkles className="h-3.5 w-3.5" /> Catálogo comercial oficial
          </div>
          <h2 className="mt-3 text-xl md:text-2xl font-black text-white">{title}</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
          <button onClick={() => setBilling('monthly')} className={`rounded-lg px-4 py-2 text-[10px] font-black transition ${billing === 'monthly' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Mensual</button>
          <button onClick={() => setBilling('annual')} className={`rounded-lg px-4 py-2 text-[10px] font-black transition ${billing === 'annual' ? 'bg-emerald-400 text-zinc-950' : 'text-emerald-400 hover:text-emerald-300'}`}>Anual · recomendado</button>
        </div>
      </div>

      {loading && <div className="mt-6 flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs font-bold text-blue-300"><Loader2 className="h-4 w-4 animate-spin" />Sincronizando valores de planes…</div>}
      {error && <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{error}</div>}

      {!loading && !error && (
        <>
          <div className="mt-7 grid lg:grid-cols-3 gap-5 items-stretch">
            {ordered.map((plan) => {
              const enterprise = plan.code === 'enterprise' || plan.recommended;
              const pro = plan.code === 'pro';
              const displayed = billing === 'annual' ? plan.annualMonthlyPrice : plan.monthlyPrice;
              const discount = plan.monthlyPrice > 0 ? Math.round((1 - plan.annualMonthlyPrice / plan.monthlyPrice) * 100) : 0;
              return (
                <article key={plan.id} className={`relative flex flex-col rounded-3xl border p-5 md:p-6 ${enterprise ? 'border-purple-400/60 bg-gradient-to-b from-purple-500/15 to-purple-500/[0.04] ring-2 ring-purple-500/15 shadow-2xl shadow-purple-950/35 lg:-translate-y-2' : pro ? 'border-amber-500/35 bg-amber-500/[0.04]' : 'border-blue-500/25 bg-blue-500/[0.04]'}`}>
                  {enterprise && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-purple-500 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white">Mayor capacidad · recomendado</span>}
                  <div className="flex items-start justify-between gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${enterprise ? 'border-purple-500/25 bg-purple-500/10 text-purple-300' : pro ? 'border-amber-500/25 bg-amber-500/10 text-amber-300' : 'border-blue-500/25 bg-blue-500/10 text-blue-300'}`}>{enterprise ? <Crown className="h-5 w-5" /> : <Zap className="h-5 w-5" />}</div>
                    {enterprise && <span className="rounded-lg border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-[9px] font-black uppercase text-purple-200">Sin límite de flota</span>}
                  </div>
                  <h3 className="mt-5 text-xl font-black text-white">{plan.name}</h3>
                  <p className="mt-2 min-h-[44px] text-[11px] leading-relaxed text-zinc-400">{plan.features.description}</p>
                  <p className={`mt-4 rounded-xl border px-3 py-2.5 text-[10px] font-bold leading-relaxed ${enterprise ? 'border-purple-500/20 bg-purple-500/10 text-purple-200' : pro ? 'border-amber-500/20 bg-amber-500/10 text-amber-200' : 'border-blue-500/20 bg-blue-500/10 text-blue-200'}`}>{plan.features.sales_highlight}</p>

                  <div className="mt-5">
                    {billing === 'annual' && <p className="text-[10px] text-zinc-600 line-through">{money(plan.monthlyPrice)} / mes</p>}
                    <p className="mt-1 text-3xl font-black text-white">{money(displayed)}<span className="text-[10px] font-bold text-zinc-500"> / mes</span></p>
                    {billing === 'annual' ? (
                      <div className="mt-2">
                        <p className="text-[10px] font-black text-emerald-400">Ahorro {discount}% · facturación {money(plan.annualPrice)}/año</p>
                        <p className="mt-1 text-[9px] text-zinc-600">Equivalente mensual mostrado para facilitar la comparación.</p>
                      </div>
                    ) : <p className="mt-2 text-[9px] text-zinc-600">Pago mes a mes.</p>}
                  </div>

                  <div className="mt-5 space-y-2.5 border-t border-zinc-800/80 pt-5">
                    {featureRows.slice(0, 8).map((feature) => {
                      const value = feature.value(plan);
                      const enabled = typeof value === 'boolean' ? value : true;
                      return (
                        <div key={feature.label} className={`flex items-center gap-2 text-[10px] ${enabled ? 'text-zinc-300' : 'text-zinc-600'}`}>
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{enabled ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}</span>
                          <span className={!enabled ? 'line-through decoration-zinc-700' : ''}>{feature.label}{typeof value === 'string' ? ` · ${value}` : ''}</span>
                        </div>
                      );
                    })}
                  </div>

                  {salesMode && <div className={`mt-auto pt-6 text-[10px] font-bold ${enterprise ? 'text-purple-200' : 'text-zinc-500'}`}>{enterprise ? 'Ideal para presentar cuando el cliente quiere crecer, abrir sedes o evitar límites futuros.' : plan.code === 'pro' ? 'Ideal cuando el cliente necesita GPS y app de conductores sin operación multisede.' : 'Solo conviene cuando la central es pequeña y acepta límites claros.'}</div>}
                </article>
              );
            })}
          </div>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-zinc-800">
            <table className="w-full min-w-[780px] text-left">
              <thead className="bg-zinc-950/80">
                <tr>
                  <th className="p-3.5 text-[9px] font-black uppercase tracking-widest text-zinc-600">Función</th>
                  {ordered.map((plan) => <th key={plan.id} className={`p-3.5 text-center text-[10px] font-black ${plan.recommended ? 'text-purple-300' : 'text-zinc-300'}`}>{plan.name}{plan.recommended ? ' ★' : ''}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 bg-[#0b0b0d]">
                {featureRows.map((feature) => (
                  <tr key={feature.label} className={feature.important ? 'bg-zinc-900/25' : ''}>
                    <td className="p-3.5 text-[10px] font-bold text-zinc-400">{feature.label}</td>
                    {ordered.map((plan) => {
                      const value = feature.value(plan);
                      const bool = typeof value === 'boolean' ? value : null;
                      return (
                        <td key={plan.id} className={`p-3.5 text-center text-[10px] font-black ${plan.recommended ? 'bg-purple-500/[0.04]' : ''}`}>
                          {bool === true ? <Check className="mx-auto h-4 w-4 text-emerald-400" /> : bool === false ? <X className="mx-auto h-4 w-4 text-rose-400" /> : <span className="text-zinc-300">{value}</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};
