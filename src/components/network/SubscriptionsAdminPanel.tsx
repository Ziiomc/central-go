import React, { useEffect, useMemo, useState } from 'react';
import { BadgePercent, CalendarClock, CreditCard, Loader2, RefreshCw, Search, Settings2, Sparkles } from 'lucide-react';
import { loadNetworkCentrals, type NetworkCentralRecord } from '../../lib/networkRepository';
import { ManualSubscriptionModal } from './ManualSubscriptionModal';
import { money, StatusPill } from './NetworkUi';

const modality = (central: NetworkCentralRecord) => central.billingCycle === 'annual'
  ? (central.paymentFrequency === 'monthly' ? 'Anual · pago mensual' : 'Anual · pago anual')
  : 'Mensual';

export const SubscriptionsAdminPanel: React.FC = () => {
  const [centrals, setCentrals] = useState<NetworkCentralRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<NetworkCentralRecord | null>(null);

  const reload = async () => {
    setLoading(true); setError('');
    try { setCentrals(await loadNetworkCentrals()); }
    catch (err) { setError(err instanceof Error ? err.message : 'No fue posible cargar las suscripciones.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return centrals;
    return centrals.filter((central) => [central.name, central.plan, central.owner, central.offerLabel ?? '', modality(central)].join(' ').toLowerCase().includes(q));
  }, [centrals, query]);

  const active = centrals.filter((central) => central.status === 'active');
  const annualMonthly = active.filter((central) => central.billingCycle === 'annual' && central.paymentFrequency === 'monthly').length;
  const offers = active.filter((central) => central.discountPercent > 0).length;
  const mrr = active.reduce((sum, central) => sum + central.monthlyFee, 0);

  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-[#0d0d0f] shadow-xl">
      <div className="flex flex-col gap-4 border-b border-zinc-800 p-5 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300"><CreditCard className="h-3.5 w-3.5" />Control de suscripciones</div><h2 className="mt-2 text-xl font-black text-white">Activaciones, planes y ofertas</h2><p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Una activación manual ya no puede quedar sin plan. Aquí puedes definir mensual, anual, anual con pago mensual y descuentos especiales por central.</p></div>
        <button onClick={() => void reload()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-[10px] font-black text-zinc-300 disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button>
      </div>

      <div className="grid gap-3 border-b border-zinc-800 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={CreditCard} label="Activas" value={String(active.length)} detail={`${centrals.length} centrales registradas`} />
        <Stat icon={CalendarClock} label="MRR efectivo" value={money(mrr)} detail="Ya considera ofertas" />
        <Stat icon={CalendarClock} label="Anual / pago mensual" value={String(annualMonthly)} detail="Compromiso anual en cuotas" />
        <Stat icon={BadgePercent} label="Ofertas especiales" value={String(offers)} detail="Descuento individual vigente" />
      </div>

      {error && <div className="m-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{error}</div>}
      {notice && <div className="m-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-200">{notice}</div>}
      {loading && <div className="m-4 flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs font-bold text-blue-300"><Loader2 className="h-4 w-4 animate-spin" />Cargando suscripciones…</div>}

      {!loading && <>
        <div className="flex flex-col gap-3 border-b border-zinc-800 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black text-white">Suscripciones de la red</p><p className="mt-0.5 text-[9px] text-zinc-600">El monto mensual equivalente alimenta las métricas comerciales.</p></div><label className="relative w-full sm:w-[320px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar central, plan u oferta…" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 pl-9 pr-3 text-xs text-white outline-none focus:border-blue-500/50" /></label></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1050px]"><thead className="bg-zinc-950/60"><tr>{['Central','Plan','Modalidad','Tarifa efectiva','Oferta','Estado','Próximo cobro','Acción'].map((label) => <th key={label} className="border-b border-zinc-800 p-3 text-left text-[8px] font-black uppercase tracking-widest text-zinc-600">{label}</th>)}</tr></thead><tbody>{visible.map((central) => <tr key={central.id} className="border-b border-zinc-900 hover:bg-zinc-900/30"><td className="p-3"><p className="text-[11px] font-black text-white">{central.name}</p><p className="mt-0.5 text-[8px] text-zinc-600">{central.owner}</p></td><td className="p-3 text-[10px] font-black text-white">{central.plan}</td><td className="p-3"><p className="text-[9px] font-black text-blue-300">{modality(central)}</p>{central.billingCycle === 'annual' && central.commitmentEndAt && <p className="mt-0.5 text-[8px] text-zinc-600">Compromiso: {central.commitmentEndAt.slice(0,10)}</p>}</td><td className="p-3"><p className="text-[11px] font-black text-emerald-300">{money(central.monthlyFee)}/mes</p>{central.effectiveAmount > 0 && central.paymentFrequency === 'annual' && <p className="mt-0.5 text-[8px] text-zinc-600">Cobro anual {money(central.effectiveAmount)}</p>}</td><td className="p-3">{central.discountPercent > 0 ? <div><span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[8px] font-black text-amber-300"><Sparkles className="h-3 w-3" />-{central.discountPercent}%</span><p className="mt-1 max-w-[170px] truncate text-[8px] text-zinc-600">{central.offerLabel || 'Oferta especial'}</p></div> : <span className="text-[9px] text-zinc-700">Precio catálogo</span>}</td><td className="p-3"><StatusPill status={central.status} /></td><td className="p-3 text-[9px] font-bold text-zinc-400">{central.nextBillingAt}</td><td className="p-3"><button onClick={() => setSelected(central)} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-[9px] font-black text-blue-300"><Settings2 className="h-3.5 w-3.5" />{central.status === 'active' ? 'Gestionar' : 'Activar'}</button></td></tr>)}</tbody></table>{visible.length === 0 && <div className="p-10 text-center text-xs text-zinc-500">No hay suscripciones que coincidan con la búsqueda.</div>}</div>
      </>}

      <ManualSubscriptionModal open={Boolean(selected)} central={selected} onClose={() => setSelected(null)} onSaved={(message) => { setNotice(message); void reload(); }} />
    </section>
  );
};

const Stat: React.FC<{ icon: any; label: string; value: string; detail: string }> = ({ icon: Icon, label, value, detail }) => <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-3.5"><div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-zinc-600"><Icon className="h-3.5 w-3.5" />{label}</div><p className="mt-2 text-lg font-black text-white">{value}</p><p className="mt-0.5 text-[8px] text-zinc-600">{detail}</p></div>;
