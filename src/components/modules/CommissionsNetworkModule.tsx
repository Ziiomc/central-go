import React, { useEffect, useMemo, useState } from 'react';
import { BadgeDollarSign, CheckCircle2, Clock3, Loader2, RefreshCw, RotateCcw, Search, ShieldCheck, WalletCards } from 'lucide-react';
import { loadVisibleCommissions, type CommissionLedgerItem } from '../../lib/commissionRepository';
import { money, NetworkKpi } from '../network/NetworkUi';

const statusLabel: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  available: 'Disponible',
  paid: 'Pagada',
  reversed: 'Revertida',
};

export const CommissionsNetworkModule: React.FC = () => {
  const [items, setItems] = useState<CommissionLedgerItem[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = async () => {
    setLoading(true); setError('');
    try { setItems(await loadVisibleCommissions()); }
    catch (err) { setError(err instanceof Error ? err.message : 'No fue posible cargar las comisiones.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, []);

  const filtered = useMemo(() => items.filter((item) => {
    const matchesStatus = status === 'all' || item.status === status;
    const q = query.toLowerCase().trim();
    return matchesStatus && (!q || [item.companyName, item.partnerName, item.id, item.commissionType].join(' ').toLowerCase().includes(q));
  }), [items, query, status]);

  const pending = items.filter((item) => item.status === 'pending' || item.status === 'confirmed').reduce((sum, item) => sum + item.amount, 0);
  const available = items.filter((item) => item.status === 'available').reduce((sum, item) => sum + item.amount, 0);
  const paid = items.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0);
  const reversed = items.filter((item) => item.status === 'reversed').reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4"><div><div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-300 mb-2"><BadgeDollarSign className="w-3.5 h-3.5" />Libro contable real</div><h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Comisiones y liquidaciones</h1><p className="text-xs text-zinc-400 mt-1">Cada fila proviene del libro de comisiones de Supabase y corresponde a una venta/pago atribuido.</p></div><button onClick={() => void reload()} disabled={loading} className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 flex items-center gap-2 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button></div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <NetworkKpi label="Pendiente / confirmación" value={money(pending)} detail="Aún no disponible para liquidar" icon={Clock3} accent="purple" />
        <NetworkKpi label="Disponible" value={money(available)} detail="Saldo liberado" icon={WalletCards} accent="blue" />
        <NetworkKpi label="Pagado" value={money(paid)} detail="Comisiones ya liquidadas" icon={CheckCircle2} accent="emerald" />
        <NetworkKpi label="Revertido" value={money(reversed)} detail="Pagos anulados o reversados" icon={RotateCcw} accent="amber" />
      </div>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{error}</div>}
      {loading && <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs font-bold text-blue-300"><Loader2 className="h-4 w-4 animate-spin" />Sincronizando libro contable…</div>}

      <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3"><div className="flex flex-wrap gap-1.5">{[['all','Todas'],['pending','Pendientes'],['confirmed','Confirmadas'],['available','Disponibles'],['paid','Pagadas'],['reversed','Revertidas']].map(([id,label]) => <button key={id} onClick={() => setStatus(id)} className={`px-3 py-2 rounded-lg text-[10px] font-extrabold border ${status===id?'bg-amber-500/10 border-amber-500/30 text-amber-300':'bg-zinc-950 border-zinc-800 text-zinc-500'}`}>{label}</button>)}</div><label className="relative min-w-[250px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" /><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar central o partner..." className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white outline-none focus:border-amber-500/50" /></label></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[920px]"><thead className="bg-zinc-950/50"><tr>{['Comisión','Central','Partner','Tipo','Pago base','Tasa','Comisión','Disponible','Estado'].map((h)=><th key={h} className="p-3 text-left text-[9px] font-black uppercase tracking-widest text-zinc-600 border-b border-zinc-800">{h}</th>)}</tr></thead><tbody>{filtered.map((item)=><tr key={item.id} className="border-b border-zinc-900 hover:bg-zinc-900/35"><td className="p-3"><p className="max-w-[100px] truncate font-mono text-[9px] font-black text-zinc-500">{item.id}</p><p className="mt-0.5 text-[8px] text-zinc-700">{item.earnedAt ? new Date(item.earnedAt).toLocaleDateString('es-CL') : '—'}</p></td><td className="p-3"><p className="text-xs font-black text-white">{item.companyName}</p></td><td className="p-3"><p className="text-[10px] font-bold text-zinc-300">{item.partnerName}</p><p className="mt-0.5 text-[8px] uppercase text-zinc-600">{item.partnerKind==='regional'?'Regional':'Comercial'}</p></td><td className="p-3 text-[10px] text-zinc-400">{item.commissionType || 'Suscripción'}</td><td className="p-3 text-[11px] font-black text-white">{money(item.grossAmount)}</td><td className="p-3 text-[11px] font-black text-amber-300">{item.ratePercent}%</td><td className="p-3 text-[11px] font-black text-emerald-300">{money(item.amount)}</td><td className="p-3 text-[10px] text-zinc-400">{item.availableAt ? new Date(item.availableAt).toLocaleDateString('es-CL') : 'Pendiente'}</td><td className="p-3"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${item.status==='paid'?'border-emerald-500/25 bg-emerald-500/10 text-emerald-300':item.status==='available'?'border-blue-500/25 bg-blue-500/10 text-blue-300':item.status==='reversed'?'border-rose-500/25 bg-rose-500/10 text-rose-300':'border-amber-500/25 bg-amber-500/10 text-amber-300'}`}>{statusLabel[item.status] ?? item.status}</span></td></tr>)}</tbody></table>{!loading&&filtered.length===0&&<div className="p-12 text-center text-xs text-zinc-500">Todavía no hay comisiones reales con este filtro.</div>}</div>
      </section>

      <div className="grid md:grid-cols-3 gap-4"><Info title="Origen verificable" text="Una comisión se registra asociada a una central y a un pago, nunca por incorporar personas a la red." /><Info title="Estados contables" text="Pendiente → confirmada → disponible → pagada. Una devolución puede llevarla a revertida." /><Info title="Acceso según rol" text="Superadmin ve el libro global; los partners ven únicamente sus registros autorizados y, en regional, los de su equipo." /></div>
    </div>
  );
};

const Info: React.FC<{ title:string; text:string }> = ({title,text}) => <div className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-4"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-zinc-500"><ShieldCheck className="h-4 w-4 text-blue-300" />{title}</div><p className="mt-2 text-[10px] leading-relaxed text-zinc-500">{text}</p></div>;
