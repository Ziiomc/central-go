import React, { useMemo, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  ChevronDown,
  Globe2,
  Link2,
  Mail,
  MapPinned,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { NETWORK_PARTNERS, NetworkPartner } from '../../data/networkMockData';
import { CountryFlag, money, NetworkKpi, ProgressBar, StatusPill } from '../network/NetworkUi';

export const PartnersNetworkModule: React.FC = () => {
  const [partners, setPartners] = useState<NetworkPartner[]>(NETWORK_PARTNERS);
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<'all' | 'regional' | 'commercial'>('all');
  const [inviteOpen, setInviteOpen] = useState(false);

  const filtered = useMemo(() => partners.filter((partner) => {
    const matchesTier = tier === 'all' || partner.tier === tier;
    const q = query.toLowerCase().trim();
    const matchesQuery = !q || [partner.name, partner.territory, partner.email].join(' ').toLowerCase().includes(q);
    return matchesTier && matchesQuery;
  }), [partners, query, tier]);

  const directSales = partners.reduce((sum, partner) => sum + partner.monthlySales, 0);
  const activeCentrals = partners.reduce((sum, partner) => sum + partner.activeCentrals, 0);

  const handleInvite = (name: string, territory: string, type: 'regional' | 'commercial') => {
    if (!name.trim()) return;
    setPartners((prev) => [{
      id: `par-demo-${Date.now()}`,
      name,
      tier: type,
      territory: territory || 'Territorio por asignar',
      countryCode: 'CL',
      email: 'invitacion@centralgo.network',
      phone: 'Pendiente',
      centrals: 0,
      activeCentrals: 0,
      monthlySales: 0,
      pendingCommission: 0,
      availableCommission: 0,
      status: 'onboarding',
      conversionRate: 0,
      satisfaction: 100,
    }, ...prev]);
    setInviteOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-purple-300 mb-2"><UsersRound className="w-3.5 h-3.5" />Canal de distribución</div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Partners y territorios</h1>
          <p className="text-xs text-zinc-400 mt-1">Representantes regionales, vendedores directos y atribución de sus centrales.</p>
        </div>
        <button onClick={() => setInviteOpen(true)} className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-black text-white flex items-center justify-center gap-2 shadow-xl shadow-purple-950/40"><UserPlus className="w-4 h-4" />Invitar partner</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <NetworkKpi label="Partners activos" value="18" detail={`${partners.filter((p) => p.status === 'active').length} representados en esta vista`} icon={UsersRound} accent="purple" />
        <NetworkKpi label="Centrales atribuidas" value="38" detail={`${activeCentrals} activas en la maqueta`} icon={Building2} accent="blue" />
        <NetworkKpi label="Ventas generadas" value={money(4036000)} detail={`${money(directSales)} en partners visibles`} icon={TrendingUp} accent="emerald" />
        <NetworkKpi label="Saldo disponible" value={money(768600)} detail="Pago global programado el día 15" icon={WalletCards} accent="amber" />
      </div>

      <div className="grid xl:grid-cols-[.75fr_1.25fr] gap-5">
        <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-extrabold text-white">Estructura territorial</h2><p className="text-[10px] text-zinc-500 mt-1">Dos niveles comerciales, sin pago por reclutamiento.</p></div>
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300"><Globe2 className="w-5 h-5" /></div>
          </div>
          <div className="mt-5 relative">
            <div className="absolute left-[18px] top-9 bottom-5 w-px bg-zinc-800" />
            <TreeNode icon={ShieldCheck} color="purple" title="Central GO Global" detail="Gobierno, marca, planes y producto" badge="Propietario" />
            <div className="ml-9 mt-3 space-y-3">
              {partners.filter((p) => p.tier === 'regional').slice(0, 4).map((regional) => (
                <div key={regional.id}>
                  <TreeNode icon={MapPinned} color="blue" title={regional.name} detail={regional.territory} badge={`${regional.activeCentrals} activas`} compact />
                  <div className="ml-9 mt-2 border-l border-dashed border-zinc-800 pl-4 space-y-2">
                    {partners.filter((p) => p.tier === 'commercial' && p.countryCode === regional.countryCode).slice(0, 2).map((sales) => (
                      <div key={sales.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
                        <div className="flex items-center gap-2 min-w-0"><div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-300"><UserPlus className="w-3 h-3" /></div><div className="min-w-0"><p className="text-[10px] font-bold text-zinc-300 truncate">{sales.name}</p><p className="text-[8px] text-zinc-600 truncate">{sales.territory}</p></div></div><span className="text-[9px] font-black text-amber-300">{sales.centrals} centrales</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-[10px] text-emerald-200/80 leading-relaxed">
            La comisión nace solo cuando una central paga su suscripción. El partner directo recibe 20% y el responsable regional 5%.
          </div>
        </section>

        <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex gap-1.5">
              {[['all', 'Todos'], ['regional', 'Regionales'], ['commercial', 'Comerciales']].map(([id, label]) => (
                <button key={id} onClick={() => setTier(id as typeof tier)} className={`px-3 py-2 rounded-lg text-[10px] font-extrabold border ${tier === id ? 'bg-purple-500/10 border-purple-500/30 text-purple-300' : 'border-zinc-800 bg-zinc-950 text-zinc-500'}`}>{label}</button>
              ))}
            </div>
            <label className="relative min-w-[250px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar partner o territorio..." className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white outline-none focus:border-purple-500/50" /></label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead className="bg-zinc-950/50"><tr>{['Partner', 'Nivel / Territorio', 'Centrales', 'Conversión', 'Ventas mensuales', 'Comisiones', 'Estado', ''].map((h) => <th key={h} className="p-3 text-left text-[9px] font-black uppercase tracking-widest text-zinc-600 border-b border-zinc-800">{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((partner) => (
                  <tr key={partner.id} className="border-b border-zinc-900 hover:bg-zinc-900/35 transition">
                    <td className="p-3"><div className="flex items-center gap-3"><div className={`w-9 h-9 rounded-full border flex items-center justify-center text-xs font-black ${partner.tier === 'regional' ? 'bg-purple-500/10 border-purple-500/25 text-purple-300' : 'bg-amber-500/10 border-amber-500/25 text-amber-300'}`}>{partner.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</div><div><p className="text-xs font-bold text-white flex items-center gap-1.5">{partner.name}{partner.status === 'active' && <BadgeCheck className="w-3.5 h-3.5 text-blue-400" />}</p><p className="text-[9px] text-zinc-600">{partner.email}</p></div></div></td>
                    <td className="p-3"><p className="text-[10px] font-bold text-zinc-300 flex items-center gap-1.5"><CountryFlag code={partner.countryCode} />{partner.tier === 'regional' ? 'Partner regional' : 'Partner comercial'}</p><p className="text-[9px] text-zinc-600 mt-0.5">{partner.territory}</p></td>
                    <td className="p-3"><p className="text-sm font-black text-white">{partner.activeCentrals}<span className="text-[9px] text-zinc-600 font-bold">/{partner.centrals}</span></p><p className="text-[9px] text-zinc-600">activas</p></td>
                    <td className="p-3 w-[120px]"><div className="flex justify-between text-[9px] mb-1.5"><span className="text-zinc-600">Leads</span><span className="font-bold text-zinc-300">{partner.conversionRate}%</span></div><ProgressBar value={partner.conversionRate * 2} tone={partner.conversionRate >= 40 ? 'emerald' : 'blue'} /></td>
                    <td className="p-3"><p className="text-[11px] font-black text-white">{money(partner.monthlySales)}</p><p className="text-[9px] text-emerald-400">Satisfacción {partner.satisfaction}%</p></td>
                    <td className="p-3"><p className="text-[10px] font-black text-amber-300">{money(partner.availableCommission)}</p><p className="text-[9px] text-zinc-600">+ {money(partner.pendingCommission)} pendiente</p></td>
                    <td className="p-3"><StatusPill status={partner.status} /></td>
                    <td className="p-3"><button className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-600"><MoreHorizontal className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="grid md:grid-cols-3 gap-4">
        <PartnerFeature icon={Link2} title="Enlace de atribución" detail="Cada partner tendrá una URL única para registrar prospectos y conservar el origen de la venta." />
        <PartnerFeature icon={Mail} title="Invitación y onboarding" detail="Flujo guiado para aceptar contrato, elegir territorio y aprender a presentar Central GO." />
        <PartnerFeature icon={WalletCards} title="Billetera de comisiones" detail="Saldo pendiente, disponible y pagado con trazabilidad por central y período." />
      </section>

      <InvitePartnerModal open={inviteOpen} onClose={() => setInviteOpen(false)} onInvite={handleInvite} />
    </div>
  );
};

const TreeNode: React.FC<{ icon: any; color: 'purple' | 'blue'; title: string; detail: string; badge: string; compact?: boolean }> = ({ icon: Icon, color, title, detail, badge, compact }) => (
  <div className={`relative flex items-center justify-between gap-3 rounded-xl border p-3 ${compact ? 'bg-zinc-950/65 border-zinc-800' : 'bg-purple-500/5 border-purple-500/20'}`}>
    <div className="flex items-center gap-3 min-w-0"><div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${color === 'purple' ? 'text-purple-300 bg-purple-500/10 border-purple-500/25' : 'text-blue-300 bg-blue-500/10 border-blue-500/25'}`}><Icon className="w-4 h-4" /></div><div className="min-w-0"><p className="text-xs font-black text-white truncate">{title}</p><p className="text-[9px] text-zinc-500 truncate">{detail}</p></div></div><span className="text-[9px] font-black text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-lg whitespace-nowrap">{badge}</span>
  </div>
);

const PartnerFeature: React.FC<{ icon: any; title: string; detail: string }> = ({ icon: Icon, title, detail }) => (
  <div className="p-4 rounded-2xl bg-[#0d0d0f] border border-zinc-800 flex items-start gap-3"><div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300"><Icon className="w-4 h-4" /></div><div><p className="text-xs font-black text-white">{title}</p><p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{detail}</p></div></div>
);

const InvitePartnerModal: React.FC<{ open: boolean; onClose: () => void; onInvite: (name: string, territory: string, type: 'regional' | 'commercial') => void }> = ({ open, onClose, onInvite }) => {
  const [name, setName] = useState('');
  const [territory, setTerritory] = useState('');
  const [type, setType] = useState<'regional' | 'commercial'>('commercial');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl bg-[#0d0d0f] border border-zinc-700 shadow-2xl p-6">
        <div className="flex items-start justify-between gap-3"><div><div className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-black text-purple-300"><UserPlus className="w-3 h-3" />Programa de partners</div><h2 className="text-xl font-black text-white mt-2">Invitar nuevo partner</h2><p className="text-xs text-zinc-500 mt-1">Diseño preliminar del proceso de incorporación.</p></div><button onClick={onClose} className="text-zinc-500 hover:text-white"><ChevronDown className="w-5 h-5 rotate-180" /></button></div>
        <div className="space-y-4 mt-6">
          <label className="block"><span className="text-[9px] uppercase tracking-widest font-black text-zinc-500">Nombre completo</span><input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-3 text-xs text-white outline-none focus:border-purple-500/50" placeholder="Nombre del representante" /></label>
          <label className="block"><span className="text-[9px] uppercase tracking-widest font-black text-zinc-500">Territorio</span><input value={territory} onChange={(e) => setTerritory(e.target.value)} className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-3 text-xs text-white outline-none focus:border-purple-500/50" placeholder="Ej. Maule, Chile" /></label>
          <div><span className="text-[9px] uppercase tracking-widest font-black text-zinc-500">Nivel</span><div className="grid grid-cols-2 gap-3 mt-1.5">{([['commercial', 'Partner comercial', '20% por venta directa'], ['regional', 'Partner regional', '5% por territorio']] as const).map(([id, title, detail]) => <button key={id} onClick={() => setType(id)} className={`p-3.5 rounded-xl border text-left ${type === id ? 'bg-purple-500/10 border-purple-500/35' : 'bg-zinc-950 border-zinc-800'}`}><p className="text-xs font-black text-white">{title}</p><p className="text-[9px] text-zinc-500 mt-1">{detail}</p></button>)}</div></div>
        </div>
        <div className="flex justify-end gap-2 mt-6 pt-5 border-t border-zinc-800"><button onClick={onClose} className="px-4 py-2.5 text-xs font-bold text-zinc-400">Cancelar</button><button onClick={() => onInvite(name, territory, type)} className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-black text-white">Enviar invitación</button></div>
      </div>
    </div>
  );
};
