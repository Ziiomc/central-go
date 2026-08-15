import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Building2, CircleDollarSign, Globe2, MapPinned, RefreshCw, ShieldCheck, UsersRound, WalletCards } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import type { NetworkCentral } from '../../data/networkMockData';
import { loadNetworkCentrals } from '../../lib/networkRepository';
import { CountryFlag, money, NetworkKpi, StatusPill } from '../network/NetworkUi';

export const CommercialGlobalAdminDashboard: React.FC = () => {
  const { companies, setCurrentCompany, setActiveModule } = useApp();
  const { refreshIdentity } = useAuth();
  const [centrals, setCentrals] = useState<NetworkCentral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      setCentrals(await loadNetworkCentrals());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar la red comercial.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const totals = useMemo(() => {
    const active = centrals.filter((central) => central.status === 'active').length;
    const trials = centrals.filter((central) => central.status === 'trial').length;
    const vehicles = centrals.reduce((sum, central) => sum + central.vehicles, 0);
    const mrr = centrals.filter((central) => central.status === 'active').reduce((sum, central) => sum + central.monthlyFee, 0);
    return { active, trials, vehicles, mrr };
  }, [centrals]);

  const openCentral = (centralId: string) => {
    const company = companies.find((item) => item.id === centralId);
    if (!company) {
      setError('La central acaba de ser registrada. Actualiza la identidad y vuelve a intentarlo.');
      void refreshIdentity();
      return;
    }
    setCurrentCompany(company);
    setActiveModule('live_map');
  };

  return (
    <div className="space-y-6">
      <section className="cg-dashboard-hero rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-950/35 via-[#0d0d0f] to-cyan-950/25 p-6 md:p-8 shadow-2xl">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Superadmin · Producción
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight text-white">Central<span className="text-blue-300">GO</span> Network</h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">Superadmin controla la red. Las nuevas centrales se registran exclusivamente desde cuentas Partner Comercial y aparecen automáticamente aquí para revisión, activación o suspensión.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={() => void reload()} disabled={loading} className="px-4 py-3 rounded-xl bg-zinc-950/70 hover:bg-zinc-900 border border-zinc-700 text-xs font-extrabold text-white flex items-center justify-center gap-2 disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button>
            <button onClick={() => setActiveModule('partners_network')} className="px-4 py-3 rounded-xl border border-blue-500/25 bg-blue-500/10 text-xs font-black text-blue-300">Ver Partners</button>
            <button onClick={() => setActiveModule('payments')} className="cg-mp-shortcut"><WalletCards className="h-4 w-4" />Pagos<ArrowUpRight className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </section>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <NetworkKpi label="Centrales reales" value={String(centrals.length)} detail={loading ? 'Sincronizando…' : `${totals.active} activas · ${totals.trials} en prueba`} icon={Building2} accent="blue" />
        <NetworkKpi label="MRR activo" value={money(totals.mrr)} detail="Solo suscripciones activas" icon={CircleDollarSign} accent="emerald" />
        <NetworkKpi label="Móviles registrados" value={String(totals.vehicles)} detail="Flota persistida en Supabase" icon={Globe2} accent="purple" />
        <NetworkKpi label="Cuentas operativas" value={String(totals.active + totals.trials)} detail="Activas o en periodo de prueba" icon={UsersRound} accent="amber" />
      </div>

      {!loading && centrals.length === 0 ? (
        <section className="rounded-3xl border border-amber-500/25 bg-amber-500/[0.06] px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-300"><Building2 className="h-7 w-7" /></div>
          <h2 className="mt-5 text-xl font-black text-white">Esperando la primera central</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">Cuando un Partner Comercial registre una central aparecerá aquí automáticamente. Superadmin no necesita crearla: desde esta cuenta decides qué hacer con cada alta.</p>
          <button onClick={() => setActiveModule('partners_network')} className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/10 px-5 py-3 text-sm font-black text-amber-300">Revisar Partners Comerciales</button>
        </section>
      ) : centrals.length > 0 ? (
        <section className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] overflow-hidden shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 p-4">
            <div><h2 className="text-sm font-black text-white">Centrales de producción</h2><p className="mt-1 text-xs text-zinc-500">Todas las altas realizadas por Partners Comerciales aparecen en esta red.</p></div>
            <button onClick={() => setActiveModule('network_centrals')} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-300 hover:text-white">Administrar red</button>
          </div>
          <div className="divide-y divide-zinc-900">
            {centrals.slice(0, 8).map((central) => (
              <div key={central.id} className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 hover:bg-zinc-900/30">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-xs font-black text-blue-300">{central.name.slice(0, 2).toUpperCase()}</div>
                  <div className="min-w-0"><p className="truncate text-sm font-black text-white">{central.name}</p><p className="mt-0.5 text-[10px] text-zinc-500"><CountryFlag code={central.countryCode} /> {central.city || 'Ciudad pendiente'}, {central.country} · {central.vehicles} móviles · Partner: {central.partner}</p></div>
                </div>
                <div className="flex items-center gap-3"><StatusPill status={central.status} /><span className="min-w-[100px] text-right text-xs font-black text-zinc-200">{money(central.monthlyFee)}/mes</span></div>
                <button onClick={() => openCentral(central.id)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-2.5 text-xs font-black text-blue-300 hover:bg-blue-500/15"><MapPinned className="h-4 w-4" />Ver operación</button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};
