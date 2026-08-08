import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarClock,
  Filter,
  Globe2,
  MoreHorizontal,
  Plus,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  UsersRound,
} from 'lucide-react';
import { NETWORK_CENTRALS, NetworkCentral } from '../../data/networkMockData';
import { CentralRegistrationModal } from '../network/CentralRegistrationModal';
import { runtimeConfig } from '../../config/runtime';
import { loadNetworkCentrals } from '../../lib/networkRepository';
import { CountryFlag, money, NetworkKpi, ProgressBar, StatusPill } from '../network/NetworkUi';

const filterOptions = [
  { id: 'all', label: 'Todas' },
  { id: 'active', label: 'Activas' },
  { id: 'trial', label: 'En prueba' },
  { id: 'past_due', label: 'Pago atrasado' },
  { id: 'suspended', label: 'Suspendidas' },
];

export const CentralsNetworkModule: React.FC = () => {
  const [centrals, setCentrals] = useState<NetworkCentral[]>(runtimeConfig.isDemo ? NETWORK_CENTRALS : []);
  const [loading, setLoading] = useState(runtimeConfig.isCommercial);
  const [loadError, setLoadError] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'table' | 'cards'>('table');

  const reloadCentrals = async () => {
    if (!runtimeConfig.isCommercial) return;
    setLoading(true);
    setLoadError('');
    try {
      setCentrals(await loadNetworkCentrals());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No fue posible cargar las centrales reales.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reloadCentrals(); }, []);

  const filtered = useMemo(() => {
    return centrals.filter((central) => {
      const statusMatch = filter === 'all' || central.status === filter;
      const q = query.toLowerCase().trim();
      const textMatch = !q || [central.name, central.country, central.region, central.city, central.owner, central.partner].join(' ').toLowerCase().includes(q);
      return statusMatch && textMatch;
    });
  }, [centrals, filter, query]);

  const mrr = centrals.filter((c) => c.status === 'active').reduce((sum, c) => sum + c.monthlyFee, 0);
  const vehicles = centrals.reduce((sum, c) => sum + c.vehicles, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-300 mb-2"><Globe2 className="w-3.5 h-3.5" />Red multitenant</div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Centrales de la red</h1>
          <p className="text-xs text-zinc-400 mt-1">Alta, suscripción, partner atribuido y estado operacional de cada empresa.</p>
        </div>
        <button onClick={() => setRegisterOpen(true)} className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-black text-slate-950 flex items-center justify-center gap-2 shadow-xl shadow-amber-950/40"><Plus className="w-4 h-4" />Registrar central</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <NetworkKpi label="Centrales registradas" value={String(centrals.length)} detail={runtimeConfig.isCommercial ? 'Empresas reales registradas' : 'Representadas en la maqueta'} icon={Building2} accent="blue" />
        <NetworkKpi label="Suscripciones activas" value={String(centrals.filter((c) => c.status === 'active').length)} detail={centrals.length ? `${Math.round((centrals.filter((c) => c.status === 'active').length / centrals.length) * 100)}% de la cartera` : 'Sin centrales aún'} icon={UsersRound} accent="emerald" />
        <NetworkKpi label="MRR administrado" value={money(mrr)} detail={runtimeConfig.isCommercial ? 'Equivalente mensual de suscripciones' : `${money(mrr)} visible en esta lista`} icon={CalendarClock} accent="purple" />
        <NetworkKpi label="Móviles registrados" value={String(vehicles)} detail={runtimeConfig.isCommercial ? 'Flota real cargada en la plataforma' : `${vehicles} móviles en los registros demo`} icon={ShieldAlert} accent="amber" />
      </div>

      {loadError && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{loadError}</div>}
      {loading && <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs font-bold text-blue-300">Sincronizando red comercial…</div>}

      <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex flex-wrap gap-1.5">
            {filterOptions.map((option) => (
              <button key={option.id} onClick={() => setFilter(option.id)} className={`px-3 py-2 rounded-lg text-[10px] font-extrabold transition border ${filter === option.id ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>{option.label}</button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="relative min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar central, ciudad o partner..." className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white outline-none focus:border-blue-500/50" />
            </label>
            <div className="flex gap-1 bg-zinc-950 border border-zinc-800 p-1 rounded-xl">
              <button onClick={() => setView('table')} className={`p-2 rounded-lg ${view === 'table' ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`} title="Tabla"><SlidersHorizontal className="w-4 h-4" /></button>
              <button onClick={() => setView('cards')} className={`p-2 rounded-lg ${view === 'cards' ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`} title="Tarjetas"><Filter className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {view === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-zinc-950/50"><tr>{['Central', 'Ubicación', 'Plan', 'Partner atribuido', 'Uso', 'Estado', 'Próximo cobro', ''].map((h) => <th key={h} className="text-left p-3.5 text-[9px] uppercase tracking-widest font-black text-zinc-600 border-b border-zinc-800">{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((central) => (
                  <tr key={central.id} className="border-b border-zinc-900 hover:bg-zinc-900/35 transition group">
                    <td className="p-3.5"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/10 border border-blue-500/20 flex items-center justify-center text-blue-300 font-black text-xs">{central.name.slice(0, 2).toUpperCase()}</div><div><p className="text-xs font-bold text-white">{central.name}</p><p className="text-[9px] text-zinc-500 mt-0.5">{central.owner} · {central.email}</p></div></div></td>
                    <td className="p-3.5"><div className="flex items-center gap-2"><CountryFlag code={central.countryCode} /><div><p className="text-[11px] font-bold text-zinc-300">{central.city}</p><p className="text-[9px] text-zinc-600">{central.region}, {central.country}</p></div></div></td>
                    <td className="p-3.5"><p className="text-[11px] font-black text-white">{central.plan}</p><p className="text-[9px] text-zinc-500">{money(central.monthlyFee)}/mes</p></td>
                    <td className="p-3.5"><p className="text-[10px] font-bold text-zinc-300">{central.partner}</p><p className="text-[9px] text-zinc-600">Regional: {central.regionalPartner}</p></td>
                    <td className="p-3.5 w-[150px]"><div className="flex items-center justify-between text-[9px] mb-1.5"><span className="text-zinc-500">{central.vehicles} móviles</span><span className="font-bold text-zinc-300">{central.activityScore}%</span></div><ProgressBar value={central.activityScore} tone={central.activityScore > 85 ? 'emerald' : central.activityScore > 60 ? 'blue' : 'amber'} /></td>
                    <td className="p-3.5"><StatusPill status={central.status} /></td>
                    <td className="p-3.5"><p className="text-[10px] text-zinc-300">{new Date(central.nextBillingAt).toLocaleDateString('es-CL')}</p><p className="text-[9px] text-zinc-600">Renovación mensual</p></td>
                    <td className="p-3.5"><button className="p-2 rounded-lg border border-transparent hover:border-zinc-700 hover:bg-zinc-800 text-zinc-600 hover:text-white"><MoreHorizontal className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="p-12 text-center text-xs text-zinc-500">No encontramos centrales con esos filtros.</div>}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
            {filtered.map((central) => <CentralCard key={central.id} central={central} />)}
          </div>
        )}
      </section>

      <CentralRegistrationModal open={registerOpen} onClose={() => setRegisterOpen(false)} onCreate={(central) => {
        if (runtimeConfig.isCommercial) void reloadCentrals();
        else setCentrals((prev) => [central, ...prev]);
      }} />
    </div>
  );
};

const CentralCard: React.FC<{ central: NetworkCentral }> = ({ central }) => (
  <article className="rounded-2xl bg-zinc-950/55 border border-zinc-800 p-4 hover:border-zinc-700 transition">
    <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-300 font-black">{central.name.slice(0, 2).toUpperCase()}</div><div><h3 className="text-sm font-black text-white">{central.name}</h3><p className="text-[10px] text-zinc-500 mt-0.5"><CountryFlag code={central.countryCode} /> {central.city}, {central.country}</p></div></div><StatusPill status={central.status} /></div>
    <div className="grid grid-cols-3 gap-2 mt-4">
      <SmallStat label="Plan" value={central.plan} />
      <SmallStat label="Móviles" value={String(central.vehicles)} />
      <SmallStat label="Cuota" value={money(central.monthlyFee)} />
    </div>
    <div className="mt-4"><div className="flex justify-between text-[9px] text-zinc-500 mb-1.5"><span>Actividad</span><span>{central.activityScore}%</span></div><ProgressBar value={central.activityScore} tone="blue" /></div>
    <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[10px]"><div><p className="text-zinc-600">Partner</p><p className="text-zinc-300 font-bold mt-0.5">{central.partner}</p></div><button className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold">Abrir ficha</button></div>
  </article>
);

const SmallStat: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800"><p className="text-[8px] uppercase tracking-wider text-zinc-600 font-black">{label}</p><p className="text-[11px] text-white font-black mt-1 truncate">{value}</p></div>;
