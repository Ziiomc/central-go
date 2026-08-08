import React, { useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  Calculator,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Download,
  Filter,
  ReceiptText,
  RotateCcw,
  Search,
  WalletCards,
} from 'lucide-react';
import { NETWORK_COMMISSIONS } from '../../data/networkMockData';
import { money, NetworkKpi, StatusPill } from '../network/NetworkUi';

export const CommissionsNetworkModule: React.FC = () => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [simulatedPrice, setSimulatedPrice] = useState(149000);
  const [directRate, setDirectRate] = useState(20);
  const [regionalRate, setRegionalRate] = useState(5);

  const filtered = useMemo(() => NETWORK_COMMISSIONS.filter((item) => {
    const matchesStatus = status === 'all' || item.status === status;
    const q = query.toLowerCase().trim();
    const matchesQuery = !q || [item.central, item.partner, item.regionalPartner, item.id].join(' ').toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  }), [query, status]);

  const pending = NETWORK_COMMISSIONS.filter((c) => c.status === 'pending').reduce((sum, c) => sum + c.directAmount + c.regionalAmount, 0);
  const available = NETWORK_COMMISSIONS.filter((c) => c.status === 'available').reduce((sum, c) => sum + c.directAmount + c.regionalAmount, 0);
  const paid = NETWORK_COMMISSIONS.filter((c) => c.status === 'paid').reduce((sum, c) => sum + c.directAmount + c.regionalAmount, 0);

  const directAmount = simulatedPrice * (directRate / 100);
  const regionalAmount = simulatedPrice * (regionalRate / 100);
  const platformAmount = simulatedPrice - directAmount - regionalAmount;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-300 mb-2"><BadgeDollarSign className="w-3.5 h-3.5" />Libro de comisiones</div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Comisiones y liquidaciones</h1>
          <p className="text-xs text-zinc-400 mt-1">Trazabilidad por central, partner, territorio, período y estado del pago.</p>
        </div>
        <button className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-200 flex items-center justify-center gap-2"><Download className="w-4 h-4 text-blue-300" />Exportar liquidación</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <NetworkKpi label="Generadas este mes" value={money(1009000)} detail="Sobre pagos reales de suscripciones" icon={CircleDollarSign} accent="amber" />
        <NetworkKpi label="Pendientes de garantía" value={money(pending)} detail="Liberación automática en 7 días" icon={Clock3} accent="purple" />
        <NetworkKpi label="Disponibles para pago" value={money(available + 286400)} detail="Próxima liquidación: 15 de agosto" icon={WalletCards} accent="blue" />
        <NetworkKpi label="Pagadas" value={money(paid + 421600)} detail="5 transferencias completadas" icon={CheckCircle2} accent="emerald" />
      </div>

      <div className="grid xl:grid-cols-[1.35fr_.65fr] gap-5">
        <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {[['all', 'Todas'], ['pending', 'Pendientes'], ['available', 'Disponibles'], ['paid', 'Pagadas'], ['reversed', 'Revertidas']].map(([id, label]) => (
                <button key={id} onClick={() => setStatus(id)} className={`px-3 py-2 rounded-lg text-[10px] font-extrabold border ${status === id ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-zinc-950 border-zinc-800 text-zinc-500'}`}>{label}</button>
              ))}
            </div>
            <label className="relative min-w-[250px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar central o partner..." className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white outline-none focus:border-amber-500/50" /></label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="bg-zinc-950/50"><tr>{['Comisión', 'Central / período', 'Partner directo', 'Regional', 'Pago central', 'Distribución', 'Disponible', 'Estado'].map((h) => <th key={h} className="p-3 text-left text-[9px] font-black uppercase tracking-widest text-zinc-600 border-b border-zinc-800">{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-900 hover:bg-zinc-900/35 transition">
                    <td className="p-3"><p className="text-[10px] font-black text-zinc-300 font-mono">{item.id}</p></td>
                    <td className="p-3"><p className="text-xs font-bold text-white">{item.central}</p><p className="text-[9px] text-zinc-600 mt-0.5">{item.period}</p></td>
                    <td className="p-3"><p className="text-[10px] font-bold text-zinc-300">{item.partner}</p><p className="text-[9px] text-amber-400">{item.directRate}% · {money(item.directAmount)}</p></td>
                    <td className="p-3"><p className="text-[10px] font-bold text-zinc-300">{item.regionalPartner}</p><p className="text-[9px] text-purple-400">{item.regionalRate}% · {money(item.regionalAmount)}</p></td>
                    <td className="p-3"><p className="text-[11px] font-black text-white">{money(item.paymentAmount)}</p></td>
                    <td className="p-3"><p className="text-[11px] font-black text-emerald-300">{money(item.directAmount + item.regionalAmount)}</p><p className="text-[9px] text-zinc-600">Total red</p></td>
                    <td className="p-3"><p className="text-[10px] text-zinc-300">{new Date(item.availableAt).toLocaleDateString('es-CL')}</p></td>
                    <td className="p-3"><StatusPill status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-5">
          <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between"><div><h2 className="font-extrabold text-white">Simulador de reparto</h2><p className="text-[10px] text-zinc-500 mt-1">Prueba precios y porcentajes.</p></div><div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300"><Calculator className="w-5 h-5" /></div></div>
            <div className="space-y-4 mt-5">
              <RangeField label="Suscripción mensual" value={simulatedPrice} min={59000} max={299000} step={10000} onChange={setSimulatedPrice} formatter={money} />
              <RangeField label="Partner directo" value={directRate} min={0} max={30} step={1} onChange={setDirectRate} formatter={(v) => `${v}%`} />
              <RangeField label="Responsable regional" value={regionalRate} min={0} max={15} step={1} onChange={setRegionalRate} formatter={(v) => `${v}%`} />
            </div>
            <div className="mt-5 space-y-2.5 p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
              <Distribution label="Partner directo" amount={directAmount} tone="text-amber-300" />
              <Distribution label="Responsable regional" amount={regionalAmount} tone="text-purple-300" />
              <div className="border-t border-zinc-800 pt-2.5"><Distribution label="Central GO" amount={platformAmount} tone="text-emerald-300" /></div>
            </div>
            <p className="mt-3 text-[9px] text-zinc-600 leading-relaxed">Este simulador es visual. Los porcentajes definitivos se configurarán por contrato, país y plan.</p>
          </section>

          <section className="bg-gradient-to-br from-blue-500/10 to-purple-500/5 border border-blue-500/20 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center gap-3"><div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300"><ReceiptText className="w-5 h-5" /></div><div><p className="text-xs font-black text-white">Próximo lote de pagos</p><p className="text-[10px] text-zinc-500">15 de agosto de 2026</p></div></div>
            <div className="grid grid-cols-2 gap-3 mt-4"><Small label="Partners" value="12" /><Small label="Monto" value={money(768600)} /></div>
            <button className="w-full mt-4 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black text-white">Revisar y aprobar lote</button>
          </section>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <InfoCard icon={CalendarDays} title="Período de garantía" detail="Las comisiones permanecen pendientes durante 7 días para cubrir devoluciones o contracargos." />
        <InfoCard icon={RotateCcw} title="Reversión automática" detail="Si el pago de la central se anula, la comisión asociada pasa a estado revertido." />
        <InfoCard icon={Filter} title="Reglas por territorio" detail="En la etapa funcional podremos definir porcentajes distintos según país, partner o campaña." />
      </div>
    </div>
  );
};

const RangeField: React.FC<{ label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; formatter: (value: number) => string }> = ({ label, value, min, max, step, onChange, formatter }) => (
  <label className="block"><div className="flex items-center justify-between mb-2"><span className="text-[9px] uppercase tracking-widest font-black text-zinc-500">{label}</span><span className="text-xs font-black text-white">{formatter(value)}</span></div><input type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-amber-500" /></label>
);

const Distribution: React.FC<{ label: string; amount: number; tone: string }> = ({ label, amount, tone }) => <div className="flex items-center justify-between text-xs"><span className="text-zinc-500">{label}</span><span className={`font-black ${tone}`}>{money(amount)}</span></div>;
const Small: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="p-3 rounded-xl bg-zinc-950/50 border border-zinc-800"><p className="text-[8px] uppercase tracking-wider text-zinc-600 font-black">{label}</p><p className="text-sm font-black text-white mt-1">{value}</p></div>;
const InfoCard: React.FC<{ icon: any; title: string; detail: string }> = ({ icon: Icon, title, detail }) => <div className="p-4 rounded-2xl bg-[#0d0d0f] border border-zinc-800 flex items-start gap-3"><div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300"><Icon className="w-4 h-4" /></div><div><p className="text-xs font-black text-white">{title}</p><p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{detail}</p></div></div>;
