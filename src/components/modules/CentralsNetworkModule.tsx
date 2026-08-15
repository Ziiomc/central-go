import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CalendarClock, CheckCircle2, Filter, Globe2, Loader2, Plus, RefreshCw, Search, ShieldAlert, SlidersHorizontal, Sparkles, UsersRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { loadNetworkCentrals, setNetworkCentralStatus, type NetworkCentralRecord } from '../../lib/networkRepository';
import { CentralRegistrationModal } from '../network/CentralRegistrationModal';
import { ManualSubscriptionModal } from '../network/ManualSubscriptionModal';
import { CountryFlag, money, NetworkKpi, StatusPill } from '../network/NetworkUi';

const filterOptions = [
  { id: 'all', label: 'Todas' },
  { id: 'active', label: 'Activas' },
  { id: 'trial', label: 'En prueba' },
  { id: 'past_due', label: 'Pago atrasado' },
  { id: 'suspended', label: 'Suspendidas' },
];

const subscriptionLabel = (central: NetworkCentralRecord) => central.billingCycle === 'annual'
  ? (central.paymentFrequency === 'monthly' ? 'Anual · pago mensual' : 'Anual · pago anual')
  : 'Mensual';

export const CentralsNetworkModule: React.FC = () => {
  const { currentRole } = useApp();
  const isSuper = currentRole === 'super_admin';
  const canRegister = currentRole === 'sales_partner';
  const [centrals, setCentrals] = useState<NetworkCentralRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [activationCentral, setActivationCentral] = useState<NetworkCentralRecord | null>(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [changingId, setChangingId] = useState<string | null>(null);

  const reloadCentrals = async () => {
    setLoading(true); setLoadError('');
    try { setCentrals(await loadNetworkCentrals()); }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'No fue posible cargar las centrales.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void reloadCentrals(); }, []);

  const filtered = useMemo(() => centrals.filter((central) => {
    const statusMatch = filter === 'all' || central.status === filter;
    const q = query.toLowerCase().trim();
    const textMatch = !q || [central.name, central.country, central.region, central.city, central.owner, central.partner, central.plan, central.offerLabel ?? ''].join(' ').toLowerCase().includes(q);
    return statusMatch && textMatch;
  }), [centrals, filter, query]);

  const active = centrals.filter((c) => c.status === 'active').length;
  const trials = centrals.filter((c) => c.status === 'trial').length;
  const mrr = centrals.filter((c) => c.status === 'active').reduce((sum, c) => sum + c.monthlyFee, 0);
  const vehicles = centrals.reduce((sum, c) => sum + c.vehicles, 0);

  const suspendCentral = async (central: NetworkCentralRecord) => {
    if (!isSuper) return;
    setChangingId(central.id); setLoadError(''); setNotice('');
    try {
      await setNetworkCentralStatus(central.id, 'suspended');
      setNotice(`${central.name}: central suspendida.`);
      await reloadCentrals();
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'No fue posible suspender la central.'); }
    finally { setChangingId(null); }
  };

  const savedSubscription = (message: string) => {
    setNotice(message);
    void reloadCentrals();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div><div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-300 mb-2"><Globe2 className="w-3.5 h-3.5" />Red oficial sincronizada</div><h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">{isSuper ? 'Centrales de la red' : 'Mis centrales'}</h1><p className="text-xs text-zinc-400 mt-1">{isSuper ? 'Cada activación manual exige seleccionar plan, modalidad y forma de pago. También puedes crear ofertas especiales sin alterar el catálogo oficial.' : canRegister ? 'Registra y administra las centrales atribuidas automáticamente a tu código comercial.' : 'Consulta las centrales atribuidas a tu territorio.'}</p></div>
        <div className="flex gap-2"><button onClick={() => void reloadCentrals()} disabled={loading} className="px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 flex items-center gap-2 disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button>{canRegister && <button onClick={() => setRegisterOpen(true)} className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-black text-slate-950 flex items-center justify-center gap-2"><Plus className="w-4 h-4" />Registrar central</button>}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <NetworkKpi label="Centrales visibles" value={String(centrals.length)} detail={`${active} activas · ${trials} en prueba`} icon={Building2} accent="blue" />
        <NetworkKpi label="Suscripciones activas" value={String(active)} detail={centrals.length ? `${Math.round((active / centrals.length) * 100)}% de la cartera` : 'Sin centrales aún'} icon={UsersRound} accent="emerald" />
        <NetworkKpi label="MRR activo" value={money(mrr)} detail="Considera descuentos y cuotas reales" icon={CalendarClock} accent="purple" />
        <NetworkKpi label="Móviles registrados" value={String(vehicles)} detail="Flota persistida" icon={ShieldAlert} accent="amber" />
      </div>

      {loadError && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{loadError}</div>}
      {notice && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-200">{notice}</div>}
      {loading && <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs font-bold text-blue-300"><Loader2 className="h-4 w-4 animate-spin" />Sincronizando red…</div>}

      {!loading && centrals.length === 0 ? (
        <section className="rounded-3xl border border-amber-500/25 bg-amber-500/[0.05] p-10 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-300"><Building2 className="h-6 w-6" /></div><h2 className="mt-4 text-lg font-black text-white">Aún no hay centrales registradas</h2><p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-zinc-400">{isSuper ? 'Cuando un Partner Comercial registre una central aparecerá automáticamente aquí para que puedas definir su plan y activarla.' : canRegister ? 'Registra tu primera central. Quedará atribuida a tu código comercial y aparecerá inmediatamente en Superadmin.' : 'Todavía no hay centrales atribuidas a este territorio.'}</p>{canRegister && <button onClick={() => setRegisterOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-xs font-black text-zinc-950"><Plus className="h-4 w-4" />Registrar primera central</button>}</section>
      ) : (
        <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex flex-col xl:flex-row xl:items-center justify-between gap-4"><div className="flex flex-wrap gap-1.5">{filterOptions.map((option) => <button key={option.id} onClick={() => setFilter(option.id)} className={`px-3 py-2 rounded-lg text-[10px] font-extrabold transition border ${filter === option.id ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>{option.label}</button>)}</div><div className="flex flex-col sm:flex-row gap-2"><label className="relative min-w-[260px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar central, plan, oferta o partner..." className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white outline-none focus:border-blue-500/50" /></label><div className="flex gap-1 bg-zinc-950 border border-zinc-800 p-1 rounded-xl"><button onClick={() => setView('table')} className={`p-2 rounded-lg ${view === 'table' ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`} title="Tabla"><SlidersHorizontal className="w-4 h-4" /></button><button onClick={() => setView('cards')} className={`p-2 rounded-lg ${view === 'cards' ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`} title="Tarjetas"><Filter className="w-4 h-4" /></button></div></div></div>
          {view === 'table' ? <div className="overflow-x-auto"><table className="w-full min-w-[1120px]"><thead className="bg-zinc-950/50"><tr>{['Central','Ubicación','Plan / modalidad','Partner','Móviles','Estado','Próximo cobro',isSuper?'Control':''].map((h) => <th key={h} className="text-left p-3.5 text-[9px] uppercase tracking-widest font-black text-zinc-600 border-b border-zinc-800">{h}</th>)}</tr></thead><tbody>{filtered.map((central) => <tr key={central.id} className="border-b border-zinc-900 hover:bg-zinc-900/35"><td className="p-3.5"><p className="text-xs font-black text-white">{central.name}</p><p className="text-[9px] text-zinc-500 mt-0.5">{central.owner} · {central.email || 'correo pendiente'}</p></td><td className="p-3.5"><div className="flex items-center gap-2"><CountryFlag code={central.countryCode} /><span className="text-[10px] text-zinc-300">{central.city || 'Sin ciudad'}, {central.country}</span></div></td><td className="p-3.5"><div className="flex flex-wrap items-center gap-1.5"><p className="text-[11px] font-black text-white">{central.plan}</p>{central.discountPercent > 0 && <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-black text-amber-300">-{central.discountPercent}%</span>}</div><p className="mt-0.5 text-[9px] font-bold text-blue-300">{subscriptionLabel(central)}</p><p className="text-[9px] text-zinc-500">{money(central.monthlyFee)}/mes eq.{central.offerLabel ? ` · ${central.offerLabel}` : ''}</p></td><td className="p-3.5 text-[10px] text-zinc-400">{central.partner}</td><td className="p-3.5 text-[11px] font-black text-zinc-300">{central.vehicles}</td><td className="p-3.5"><StatusPill status={central.status} /></td><td className="p-3.5"><p className="text-[10px] font-bold text-zinc-300">{central.nextBillingAt}</p>{central.billingCycle === 'annual' && central.commitmentEndAt && <p className="mt-0.5 text-[8px] text-zinc-600">Compromiso hasta {central.commitmentEndAt.slice(0,10)}</p>}</td><td className="p-3.5">{isSuper && <div className="flex gap-1.5"><button onClick={() => setActivationCentral(central)} className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-2 text-[9px] font-black text-emerald-300"><CheckCircle2 className="inline h-3 w-3 mr-1" />{central.status === 'active' ? 'Plan / oferta' : 'Activar'}</button><button disabled={changingId===central.id || central.status==='suspended'} onClick={() => void suspendCentral(central)} className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-2 text-[9px] font-black text-rose-300 disabled:opacity-30">Suspender</button></div>}</td></tr>)}</tbody></table>{filtered.length===0&&<div className="p-12 text-center text-xs text-zinc-500">No encontramos centrales con esos filtros.</div>}</div> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">{filtered.map((central) => <article key={central.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-black text-white">{central.name}</h3><p className="mt-1 text-[10px] text-zinc-500"><CountryFlag code={central.countryCode} /> {central.city}, {central.country}</p></div><StatusPill status={central.status} /></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><SmallStat label="Plan" value={central.plan} /><SmallStat label="Móviles" value={String(central.vehicles)} /><SmallStat label="MRR eq." value={money(central.monthlyFee)} /></div><div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"><p className="text-[9px] font-black text-blue-300">{subscriptionLabel(central)}</p>{central.discountPercent > 0 && <p className="mt-1 text-[9px] font-bold text-amber-300"><Sparkles className="mr-1 inline h-3 w-3" />{central.offerLabel || 'Oferta especial'} · {central.discountPercent}% dto.</p>}</div>{isSuper&&<div className="mt-4 flex gap-2 border-t border-zinc-800 pt-3"><button onClick={() => setActivationCentral(central)} className="flex-1 rounded-lg bg-emerald-500/10 px-3 py-2 text-[9px] font-black text-emerald-300">{central.status === 'active' ? 'Plan / oferta' : 'Activar'}</button><button disabled={central.status==='suspended' || changingId===central.id} onClick={() => void suspendCentral(central)} className="flex-1 rounded-lg bg-rose-500/10 px-3 py-2 text-[9px] font-black text-rose-300 disabled:opacity-30">Suspender</button></div>}</article>)}</div>}
        </section>
      )}

      {canRegister && <CentralRegistrationModal open={registerOpen} onClose={() => setRegisterOpen(false)} onCreate={() => { void reloadCentrals(); }} />}
      {isSuper && <ManualSubscriptionModal open={Boolean(activationCentral)} central={activationCentral} onClose={() => setActivationCentral(null)} onSaved={savedSubscription} />}
    </div>
  );
};

const SmallStat: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-2.5"><p className="text-[8px] uppercase tracking-wider text-zinc-600 font-black">{label}</p><p className="mt-1 truncate text-[11px] font-black text-white">{value}</p></div>;
