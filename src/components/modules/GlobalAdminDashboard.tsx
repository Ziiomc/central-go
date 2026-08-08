import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeDollarSign,
  Building2,
  CircleDollarSign,
  Clock3,
  Globe2,
  Headphones,
  Plus,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { COUNTRY_ACTIVITY, MONTHLY_NETWORK_REVENUE, NETWORK_CENTRALS, NETWORK_PARTNERS, NetworkCentral } from '../../data/networkMockData';
import { CentralRegistrationModal } from '../network/CentralRegistrationModal';
import { CountryFlag, MiniAction, money, NetworkKpi, ProgressBar, SectionTitle, StatusPill } from '../network/NetworkUi';
import { useApp } from '../../context/AppContext';

export const GlobalAdminDashboard: React.FC = () => {
  const { setActiveModule } = useApp();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [centrals, setCentrals] = useState<NetworkCentral[]>(NETWORK_CENTRALS);

  const totals = useMemo(() => {
    const active = centrals.filter((c) => c.status === 'active').length;
    const trials = centrals.filter((c) => c.status === 'trial').length;
    const vehicles = centrals.reduce((sum, c) => sum + c.vehicles, 0);
    const representedMrr = centrals.filter((c) => c.status === 'active').reduce((sum, c) => sum + c.monthlyFee, 0);
    return { active, trials, vehicles, representedMrr };
  }, [centrals]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-950/45 via-[#0d0d0f] to-blue-950/35 p-6 md:p-8 shadow-2xl">
        <div className="absolute -top-24 -right-20 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col xl:flex-row xl:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/25 bg-purple-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-purple-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Superadmin · Red Global
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight text-white">
              Central<span className="text-amber-400">GO</span> Network
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Controla las centrales, partners, suscripciones y comisiones desde una sola plataforma internacional. Esta vista es una maqueta navegable del nuevo modelo comercial.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-1.5 text-[10px] font-bold text-zinc-300">🌎 6 países activos</span>
              <span className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-1.5 text-[10px] font-bold text-zinc-300">🤝 18 partners</span>
              <span className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-1.5 text-[10px] font-bold text-zinc-300">⚡ 99.97% disponibilidad</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={() => setActiveModule('partners_network')} className="px-4 py-3 rounded-xl bg-zinc-950/70 hover:bg-zinc-900 border border-zinc-700 text-xs font-extrabold text-white flex items-center justify-center gap-2">
              <UserPlus className="w-4 h-4 text-purple-300" /> Invitar partner
            </button>
            <button onClick={() => setRegisterOpen(true)} className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-black text-slate-950 flex items-center justify-center gap-2 shadow-xl shadow-amber-950/40">
              <Plus className="w-4 h-4" /> Registrar central
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <NetworkKpi label="Centrales activas" value="38" detail={`${totals.active} visibles en esta demo · 4 nuevas este mes`} icon={Building2} accent="blue" />
        <NetworkKpi label="MRR global" value={money(4036000)} detail={`+16,6% vs. julio · demo: ${money(totals.representedMrr)}`} icon={CircleDollarSign} accent="emerald" />
        <NetworkKpi label="Flota conectada" value="1.284" detail={`${totals.vehicles} móviles representados · 91% en línea`} icon={Globe2} accent="purple" />
        <NetworkKpi label="Comisiones del mes" value={money(1009000)} detail="25% distribuido a la red comercial" icon={BadgeDollarSign} accent="amber" />
      </div>

      <div className="grid xl:grid-cols-[1.45fr_.8fr] gap-5">
        <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-5 shadow-xl">
          <SectionTitle title="Crecimiento de la red" description="Ingresos recurrentes, comisiones y centrales activas" action="Ver reportes" onAction={() => setActiveModule('commissions_network')} />
          <div className="h-[285px] mt-5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MONTHLY_NETWORK_REVENUE}>
                <defs>
                  <linearGradient id="networkRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                  <linearGradient id="networkCommission" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="month" stroke="#71717a" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#71717a" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000000)}M`} />
                <Tooltip contentStyle={{ background: '#09090b', border: '1px solid #3f3f46', borderRadius: 12, fontSize: 11 }} formatter={(value: number) => money(value)} />
                <Area type="monotone" dataKey="revenue" name="Facturación" stroke="#60a5fa" fill="url(#networkRevenue)" strokeWidth={2.5} />
                <Area type="monotone" dataKey="commissions" name="Comisiones" stroke="#fbbf24" fill="url(#networkCommission)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 mt-3 pt-4 border-t border-zinc-800">
            <ChartSummary label="Crecimiento mensual" value="+16,6%" detail="Sobre facturación" tone="text-emerald-300" />
            <ChartSummary label="Ticket promedio" value={money(106211)} detail="Por central activa" tone="text-blue-300" />
            <ChartSummary label="Retención" value="96,8%" detail="Últimos 90 días" tone="text-purple-300" />
          </div>
        </section>

        <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-5 shadow-xl">
          <SectionTitle title="Actividad por país" description="Mercados con mayor tracción" action="Ver mapa global" />
          <div className="mt-5 space-y-4">
            {COUNTRY_ACTIVITY.map((item, index) => (
              <div key={item.code}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 text-center font-black text-[10px] text-zinc-600">0{index + 1}</span>
                    <CountryFlag code={item.code} className="text-lg" />
                    <div className="min-w-0"><p className="text-xs font-bold text-zinc-200">{item.country}</p><p className="text-[9px] text-zinc-500">{item.centrals} centrales · {item.partners} partners</p></div>
                  </div>
                  <div className="text-right"><p className="text-xs font-black text-white">{money(item.mrr)}</p><p className="text-[9px] text-emerald-400">+{item.growth}%</p></div>
                </div>
                <ProgressBar value={Math.min(100, (item.mrr / 1400000) * 100)} tone={index === 0 ? 'amber' : index === 1 ? 'blue' : index === 2 ? 'purple' : 'emerald'} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid xl:grid-cols-[1.25fr_.75fr] gap-5">
        <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-5 shadow-xl overflow-hidden">
          <SectionTitle title="Altas y renovaciones recientes" description="Seguimiento rápido de las cuentas más relevantes" action="Gestionar centrales" onAction={() => setActiveModule('network_centrals')} />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead><tr className="text-left border-b border-zinc-800">{['Central', 'Mercado', 'Plan', 'Partner', 'Estado', 'Próximo cobro'].map((h) => <th key={h} className="pb-3 px-2 text-[9px] uppercase tracking-widest text-zinc-600 font-black">{h}</th>)}</tr></thead>
              <tbody>
                {centrals.slice(0, 5).map((central) => (
                  <tr key={central.id} className="border-b border-zinc-900 hover:bg-zinc-900/35 transition">
                    <td className="py-3 px-2"><p className="text-xs font-bold text-white">{central.name}</p><p className="text-[9px] text-zinc-500">{central.vehicles} móviles · {central.owner}</p></td>
                    <td className="py-3 px-2"><div className="flex items-center gap-2 text-[11px] text-zinc-300"><CountryFlag code={central.countryCode} />{central.city}</div></td>
                    <td className="py-3 px-2"><p className="text-[11px] font-bold text-zinc-200">{central.plan}</p><p className="text-[9px] text-zinc-500">{money(central.monthlyFee)}/mes</p></td>
                    <td className="py-3 px-2 text-[10px] text-zinc-400">{central.partner}</td>
                    <td className="py-3 px-2"><StatusPill status={central.status} /></td>
                    <td className="py-3 px-2 text-[10px] text-zinc-400">{new Date(central.nextBillingAt).toLocaleDateString('es-CL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-5">
          <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-5 shadow-xl">
            <SectionTitle title="Acciones rápidas" description="Operación comercial de la red" />
            <div className="mt-4 space-y-2.5">
              <MiniAction label="Registrar nueva central" detail="Crear prueba y atribuir partner" icon={Building2} onClick={() => setRegisterOpen(true)} tone="text-amber-300 bg-amber-500/10 border-amber-500/20" />
              <MiniAction label="Aprobar un partner" detail="3 solicitudes esperando revisión" icon={UserPlus} onClick={() => setActiveModule('partners_network')} tone="text-purple-300 bg-purple-500/10 border-purple-500/20" />
              <MiniAction label="Liberar comisiones" detail={`${money(286400)} listos para pago`} icon={WalletCards} onClick={() => setActiveModule('commissions_network')} tone="text-emerald-300 bg-emerald-500/10 border-emerald-500/20" />
              <MiniAction label="Revisar soporte regional" detail="7 tickets requieren asignación" icon={Headphones} onClick={() => setActiveModule('network_support')} />
            </div>
          </section>

          <section className="bg-gradient-to-br from-amber-500/10 to-purple-500/5 border border-amber-500/20 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between"><div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-300"><TrendingUp className="w-5 h-5" /></div><span className="text-[9px] font-black uppercase text-amber-300 tracking-wider">Objetivo agosto</span></div>
            <p className="text-2xl font-black text-white mt-4">38 / 42</p>
            <p className="text-xs text-zinc-400 mt-1">Centrales activas comprometidas</p>
            <div className="mt-4"><ProgressBar value={90.5} tone="amber" /></div>
            <button onClick={() => setActiveModule('network_centrals')} className="mt-4 text-xs font-black text-amber-300 flex items-center gap-1.5">Ver pipeline comercial <ArrowRight className="w-3.5 h-3.5" /></button>
          </section>
        </div>
      </div>

      <CentralRegistrationModal open={registerOpen} onClose={() => setRegisterOpen(false)} onCreate={(central) => setCentrals((prev) => [central, ...prev])} />
    </div>
  );
};

const ChartSummary: React.FC<{ label: string; value: string; detail: string; tone: string }> = ({ label, value, detail, tone }) => (
  <div><p className="text-[9px] uppercase tracking-wider font-black text-zinc-600">{label}</p><p className={`text-sm font-black mt-1 ${tone}`}>{value}</p><p className="text-[9px] text-zinc-600 mt-0.5">{detail}</p></div>
);
