import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock3,
  Copy,
  Headphones,
  Link2,
  MapPinned,
  Plus,
  Target,
  TrendingUp,
  UserPlus,
  WalletCards,
} from 'lucide-react';
import { NETWORK_CENTRALS, NETWORK_PARTNERS, NetworkCentral } from '../../data/networkMockData';
import { useApp } from '../../context/AppContext';
import { CentralRegistrationModal } from '../network/CentralRegistrationModal';
import { CountryFlag, MiniAction, money, NetworkKpi, ProgressBar, StatusPill } from '../network/NetworkUi';

export const PartnerDashboard: React.FC = () => {
  const { currentRole, setActiveModule } = useApp();
  const isRegional = currentRole === 'regional_partner';
  const partnerName = isRegional ? 'María Paz Herrera' : 'Ignacio Varas';
  const territory = isRegional ? 'Chile Centro-Sur' : 'Maule, Chile';
  const partner = NETWORK_PARTNERS.find((p) => p.name === partnerName) || NETWORK_PARTNERS[0];
  const [registerOpen, setRegisterOpen] = useState(false);
  const [centrals, setCentrals] = useState<NetworkCentral[]>(NETWORK_CENTRALS);
  const [copied, setCopied] = useState(false);

  const attributed = useMemo(() => centrals.filter((c) => isRegional ? c.regionalPartner === partnerName : c.partner === partnerName), [centrals, isRegional, partnerName]);
  const referralLink = `centralgo.app/registro?partner=${isRegional ? 'MPH-CHILE' : 'IGNACIO-MAULE'}`;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(`https://${referralLink}`); } catch { /* demo */ }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-950/40 via-[#0d0d0f] to-purple-950/35 p-6 md:p-8 shadow-2xl">
        <div className="absolute -right-20 -top-24 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative flex flex-col xl:flex-row xl:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black uppercase tracking-widest text-blue-300"><MapPinned className="w-3.5 h-3.5" />{isRegional ? 'Partner regional' : 'Partner comercial'} · {territory}</div>
            <h1 className="text-3xl font-black text-white mt-4">Hola, {partnerName.split(' ')[0]}</h1>
            <p className="text-sm text-zinc-400 mt-2 max-w-xl">Este será tu espacio para registrar centrales, seguir oportunidades, atender clientes y controlar tus comisiones recurrentes.</p>
          </div>
          <button onClick={() => setRegisterOpen(true)} className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-black text-slate-950 flex items-center justify-center gap-2 shadow-xl shadow-amber-950/40"><Plus className="w-4 h-4" />Registrar nueva central</button>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <NetworkKpi label="Centrales atribuidas" value={String(partner.centrals)} detail={`${partner.activeCentrals} activas · ${Math.max(0, partner.centrals - partner.activeCentrals)} en seguimiento`} icon={Building2} accent="blue" />
        <NetworkKpi label="Ventas mensuales" value={money(partner.monthlySales)} detail="Suscripciones activas de tu cartera" icon={TrendingUp} accent="emerald" />
        <NetworkKpi label="Comisión pendiente" value={money(partner.pendingCommission)} detail="En período de garantía" icon={Clock3} accent="purple" />
        <NetworkKpi label="Saldo disponible" value={money(partner.availableCommission)} detail="Próximo pago: 15 de agosto" icon={WalletCards} accent="amber" />
      </div>

      <div className="grid xl:grid-cols-[1.15fr_.85fr] gap-5">
        <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="font-extrabold text-white">Mi cartera de centrales</h2><p className="text-[10px] text-zinc-500 mt-1">Estado comercial, uso y próxima acción.</p></div><button onClick={() => setActiveModule('network_centrals')} className="text-xs font-black text-blue-300 flex items-center gap-1">Ver todas <ArrowUpRight className="w-3.5 h-3.5" /></button></div>
          <div className="space-y-3 mt-5">
            {attributed.slice(0, 5).map((central) => (
              <div key={central.id} className="p-4 rounded-2xl bg-zinc-950/55 border border-zinc-800 hover:border-zinc-700 transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-300 font-black text-xs">{central.name.slice(0, 2).toUpperCase()}</div><div><p className="text-xs font-black text-white">{central.name}</p><p className="text-[9px] text-zinc-500 mt-0.5"><CountryFlag code={central.countryCode} /> {central.city} · {central.plan} · {money(central.monthlyFee)}</p></div></div>
                  <StatusPill status={central.status} />
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-4 items-center mt-3 pt-3 border-t border-zinc-800"><div><div className="flex justify-between text-[9px] text-zinc-600 mb-1.5"><span>Adopción de plataforma</span><span>{central.activityScore}%</span></div><ProgressBar value={central.activityScore} tone={central.activityScore > 80 ? 'emerald' : 'blue'} /></div><button className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[9px] font-black text-zinc-300">Abrir cliente</button></div>
              </div>
            ))}
            {attributed.length === 0 && <div className="p-10 text-center text-xs text-zinc-500">Todavía no hay centrales atribuidas a este perfil de demostración.</div>}
          </div>
        </section>

        <div className="space-y-5">
          <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between"><div><h2 className="font-extrabold text-white">Mi enlace comercial</h2><p className="text-[10px] text-zinc-500 mt-1">Las altas quedan atribuidas automáticamente.</p></div><div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300"><Link2 className="w-5 h-5" /></div></div>
            <div className="mt-4 p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center gap-2"><span className="text-[10px] font-mono text-zinc-400 truncate flex-1">{referralLink}</span><button onClick={copyLink} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-blue-300">{copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}</button></div>
            <p className="text-[9px] text-zinc-600 mt-2">Compártelo por WhatsApp, correo o redes. No se paga por invitar partners, solo por suscripciones reales.</p>
          </section>

          <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between"><div><h2 className="font-extrabold text-white">Meta del mes</h2><p className="text-[10px] text-zinc-500 mt-1">Conversión de nuevas centrales.</p></div><Target className="w-5 h-5 text-amber-300" /></div>
            <div className="flex items-end justify-between mt-5"><div><p className="text-3xl font-black text-white">3 <span className="text-sm text-zinc-600">/ 5</span></p><p className="text-[10px] text-zinc-500">centrales activadas</p></div><span className="text-xs font-black text-emerald-300">60%</span></div>
            <div className="mt-3"><ProgressBar value={60} tone="amber" /></div>
            <p className="mt-4 text-[10px] text-zinc-400">Faltan dos activaciones para desbloquear el bono comercial del mes.</p>
          </section>

          <section className="bg-gradient-to-br from-purple-500/10 to-blue-500/5 border border-purple-500/20 rounded-2xl p-5 shadow-xl">
            <p className="text-[9px] font-black uppercase tracking-widest text-purple-300">Centro de partner</p>
            <div className="space-y-2.5 mt-4">
              <MiniAction label="Agregar oportunidad" detail="Registrar un prospecto antes de la demo" icon={UserPlus} />
              <MiniAction label="Solicitar apoyo comercial" detail="Coordinar presentación con el equipo global" icon={Headphones} />
            </div>
          </section>
        </div>
      </div>

      <CentralRegistrationModal open={registerOpen} onClose={() => setRegisterOpen(false)} onCreate={(central) => setCentrals((prev) => [{ ...central, partner: isRegional ? central.partner : partnerName, regionalPartner: isRegional ? partnerName : central.regionalPartner }, ...prev])} />
    </div>
  );
};
