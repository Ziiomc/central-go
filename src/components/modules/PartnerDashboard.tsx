import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BadgeDollarSign,
  Building2,
  Clock3,
  Loader2,
  MapPinned,
  Plus,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { loadPartnerDashboard, type PartnerDashboardData } from '../../lib/partnerRepository';
import { CentralRegistrationModal } from '../network/CentralRegistrationModal';
import { PlanComparison } from '../network/PlanComparison';
import { CountryFlag, money, NetworkKpi, StatusPill } from '../network/NetworkUi';

export const PartnerDashboard: React.FC = () => {
  const { currentRole, setActiveModule } = useApp();
  const { profile } = useAuth();
  const isRegional = currentRole === 'regional_partner';
  const canRegisterCentrals = currentRole === 'sales_partner';
  const [registerOpen, setRegisterOpen] = useState(false);
  const [data, setData] = useState<PartnerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await loadPartnerDashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar el panel del partner.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const territory = useMemo(() => {
    const item = data?.territories?.[0];
    if (!item) return 'Territorio por configurar';
    return [item.city, item.region, item.countryCode].filter(Boolean).join(' · ');
  }, [data]);

  const activeCentrals = data?.centrals.filter((central) => central.status === 'active').length ?? 0;
  const trialCentrals = data?.centrals.filter((central) => central.status === 'trial').length ?? 0;
  const name = profile?.name || 'Partner';

  if (!loading && data && !data.configured) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-amber-500/25 bg-amber-500/[0.05] p-7 md:p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-300"><MapPinned className="h-7 w-7" /></div>
          <h1 className="mt-5 text-2xl font-black text-white">Perfil comercial pendiente de configuración</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">Tu cuenta tiene rol de partner, pero todavía no existe una ficha activa en el padrón comercial. Superadmin puede revisar esta cuenta desde la red de Partners.</p>
        </section>
        <PlanComparison salesMode />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-950/35 via-[#0d0d0f] to-purple-950/25 p-6 md:p-8 shadow-2xl">
        <div className="relative flex flex-col xl:flex-row xl:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black uppercase tracking-widest text-blue-300"><MapPinned className="w-3.5 h-3.5" />{isRegional ? 'Partner regional' : 'Partner comercial'} · Producción</div>
            <h1 className="text-3xl font-black text-white mt-4">Hola, {name.split(' ')[0]}</h1>
            <p className="text-sm text-zinc-400 mt-2">{canRegisterCentrals ? 'Tu cuenta comercial es gratuita y permanente. Registra centrales libremente; todas quedarán atribuidas a tu código y visibles para Superadmin.' : 'Gestiona tu territorio, equipo comercial y cartera atribuida desde este panel.'}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-1.5 text-[10px] font-bold text-zinc-300">Código: {data?.code ?? '—'}</span>
              <span className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-1.5 text-[10px] font-bold text-zinc-300">Comisión: {data?.commissionPercent ?? 0}%</span>
              <span className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-1.5 text-[10px] font-bold text-zinc-300">{territory}</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={() => void reload()} disabled={loading} className="px-4 py-3 rounded-xl bg-zinc-950/70 hover:bg-zinc-900 border border-zinc-700 text-xs font-extrabold text-white flex items-center justify-center gap-2 disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button>
            {canRegisterCentrals && <button onClick={() => setRegisterOpen(true)} className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-black text-slate-950 flex items-center justify-center gap-2 shadow-xl shadow-amber-950/40"><Plus className="w-4 h-4" />Registrar nueva central</button>}
          </div>
        </div>
      </section>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{error}</div>}
      {loading && <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs font-bold text-blue-300"><Loader2 className="h-4 w-4 animate-spin" />Sincronizando cartera comercial…</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <NetworkKpi label="Centrales atribuidas" value={String(data?.centralCount ?? 0)} detail={`${activeCentrals} activas · ${trialCentrals} en prueba`} icon={Building2} accent="blue" />
        <NetworkKpi label="Valor mensual cartera" value={money(data?.monthlySales ?? 0)} detail="Equivalente mensual de planes activos/prueba" icon={TrendingUp} accent="emerald" />
        <NetworkKpi label="Comisión pendiente" value={money(data?.pendingCommission ?? 0)} detail="Pendiente o en confirmación" icon={Clock3} accent="purple" />
        <NetworkKpi label="Saldo disponible" value={money(data?.availableCommission ?? 0)} detail="Disponible para próxima liquidación" icon={WalletCards} accent="amber" />
      </div>

      {isRegional && (
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-4"><div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-zinc-500"><UsersRound className="h-4 w-4 text-purple-300" />Equipo comercial</div><p className="mt-3 text-2xl font-black text-white">{data?.teamCount ?? 0}</p><p className="mt-1 text-[10px] text-zinc-500">Partners comerciales activos bajo tu región</p></div>
          <div className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-4"><div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-zinc-500"><BadgeDollarSign className="h-4 w-4 text-emerald-300" />Comisión pagada</div><p className="mt-3 text-2xl font-black text-white">{money(data?.paidCommission ?? 0)}</p><p className="mt-1 text-[10px] text-zinc-500">Histórico efectivamente liquidado</p></div>
          <button onClick={() => setActiveModule('partners_network')} className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.05] p-4 text-left hover:bg-purple-500/[0.08]"><div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-purple-300"><ShieldCheck className="h-4 w-4" />Administrar región</div><p className="mt-3 text-sm font-black text-white">Partners y territorios</p><p className="mt-1 text-[10px] text-zinc-500">Revisa tu estructura comercial autorizada.</p></button>
        </div>
      )}

      <section className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div><h2 className="font-extrabold text-white">Mi cartera de centrales</h2><p className="text-[10px] text-zinc-500 mt-1">Solo empresas realmente atribuidas a tu perfil o equipo regional.</p></div>
          <button onClick={() => setActiveModule('network_centrals')} className="text-xs font-black text-blue-300 flex items-center gap-1">Ver gestión completa <ArrowUpRight className="w-3.5 h-3.5" /></button>
        </div>
        <div className="mt-5 space-y-3">
          {(data?.centrals ?? []).slice(0, 6).map((central) => (
            <div key={central.id} className="p-4 rounded-2xl bg-zinc-950/55 border border-zinc-800 hover:border-zinc-700 transition">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-300 font-black text-xs">{central.name.slice(0, 2).toUpperCase()}</div><div><p className="text-xs font-black text-white">{central.name}</p><p className="text-[9px] text-zinc-500 mt-0.5"><CountryFlag code={central.countryCode} /> {central.city || 'Ciudad pendiente'} · {central.plan} · {money(central.monthlyFee)}/mes</p></div></div>
                <StatusPill status={central.status} />
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-zinc-800 pt-3 text-[9px]"><div><p className="text-zinc-600">Propietario</p><p className="mt-0.5 font-bold text-zinc-300">{central.owner}</p></div><div><p className="text-zinc-600">Móviles</p><p className="mt-0.5 font-bold text-zinc-300">{central.vehicles}</p></div><div><p className="text-zinc-600">Próximo hito</p><p className="mt-0.5 font-bold text-zinc-300">{central.nextBillingAt}</p></div><div><p className="text-zinc-600">Estado</p><p className="mt-0.5 font-bold text-zinc-300">{central.status}</p></div></div>
            </div>
          ))}
          {!loading && (data?.centrals.length ?? 0) === 0 && <div className="p-10 text-center text-xs text-zinc-500">{canRegisterCentrals ? 'Todavía no tienes centrales atribuidas. Registra la primera desde este panel y quedará vinculada automáticamente a tu código.' : 'Todavía no hay centrales atribuidas a este territorio.'}</div>}
        </div>
      </section>

      <PlanComparison
        salesMode
        title="Valores y diferencias para vender Central GO"
        subtitle="Presenta los tres planes con total transparencia. Las X muestran lo que el cliente no tendrá en los planes menores y Enterprise queda destacado por sus capacidades adicionales."
      />

      {canRegisterCentrals && <CentralRegistrationModal open={registerOpen} onClose={() => setRegisterOpen(false)} onCreate={() => { void reload(); }} />}
    </div>
  );
};
