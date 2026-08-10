import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Headphones, Loader2, MessageCircle, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { loadVisibleSupportTickets, updateSupportTicketStatus, type SupportTicketRecord, type SupportTicketStatus } from '../../lib/supportRepository';
import { NetworkKpi } from '../network/NetworkUi';

const statusLabel: Record<SupportTicketStatus, string> = {
  open: 'Abierto',
  in_progress: 'En proceso',
  waiting_customer: 'Esperando cliente',
  resolved: 'Resuelto',
  closed: 'Cerrado',
};

export const NetworkSupportModule: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [changingId, setChangingId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true); setError('');
    try { setTickets(await loadVisibleSupportTickets()); }
    catch (err) { setError(err instanceof Error ? err.message : 'No fue posible cargar soporte.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, []);

  const filtered = useMemo(() => tickets.filter((ticket) => {
    const q = query.toLowerCase().trim();
    return !q || [ticket.companyName, ticket.subject, ticket.createdByName, ticket.assignedPartnerName, ticket.id].join(' ').toLowerCase().includes(q);
  }), [tickets, query]);

  const open = tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length;
  const high = tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status) && ['high', 'urgent'].includes(ticket.priority)).length;
  const resolved = tickets.filter((ticket) => ['resolved', 'closed'].includes(ticket.status)).length;
  const avgMinutes = useMemo(() => {
    const resolvedRows = tickets.filter((ticket) => ticket.resolvedAt && ticket.createdAt);
    if (!resolvedRows.length) return 0;
    return Math.round(resolvedRows.reduce((sum, ticket) => sum + (new Date(ticket.resolvedAt!).getTime() - new Date(ticket.createdAt).getTime()) / 60000, 0) / resolvedRows.length);
  }, [tickets]);

  const changeStatus = async (ticket: SupportTicketRecord, status: SupportTicketStatus) => {
    setChangingId(ticket.id); setError('');
    try { await updateSupportTicketStatus(ticket.id, status); await reload(); }
    catch (err) { setError(err instanceof Error ? err.message : 'No fue posible actualizar el ticket.'); }
    finally { setChangingId(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4"><div><div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-300 mb-2"><Headphones className="w-3.5 h-3.5" />Soporte sincronizado</div><h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Soporte regional</h1><p className="text-xs text-zinc-400 mt-1">Incidencias reales asignadas al partner responsable, con supervisión global.</p></div><button onClick={() => void reload()} disabled={loading} className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 flex items-center gap-2 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button></div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"><NetworkKpi label="Tickets abiertos" value={String(open)} detail={`${high} prioridad alta/urgente`} icon={AlertCircle} accent="amber" /><NetworkKpi label="Tiempo medio resolución" value={avgMinutes ? `${avgMinutes} min` : '—'} detail="Solo tickets resueltos reales" icon={Clock3} accent="blue" /><NetworkKpi label="Resueltos" value={String(resolved)} detail={`${tickets.length} tickets visibles`} icon={CheckCircle2} accent="emerald" /><NetworkKpi label="Cobertura" value={String(new Set(tickets.map((ticket) => ticket.assignedPartnerId).filter(Boolean)).size)} detail="Partners con tickets asignados" icon={ShieldCheck} accent="purple" /></div>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{error}</div>}
      {loading && <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs font-bold text-blue-300"><Loader2 className="h-4 w-4 animate-spin" />Sincronizando tickets…</div>}

      <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="font-extrabold text-white">Bandeja de soporte</h2><p className="text-[10px] text-zinc-500 mt-1">No se muestran tickets de demostración.</p></div><label className="relative min-w-[260px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" /><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar ticket, central o responsable..." className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white outline-none focus:border-blue-500/50" /></label></div>
        <div className="divide-y divide-zinc-900">{filtered.map((ticket) => <article key={ticket.id} className="p-4 hover:bg-zinc-900/35 transition"><div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4"><div className="flex items-start gap-3 min-w-0"><div className={`p-2 rounded-xl border shrink-0 ${['high','urgent'].includes(ticket.priority)?'bg-red-500/10 border-red-500/25 text-red-300':'bg-blue-500/10 border-blue-500/20 text-blue-300'}`}><MessageCircle className="w-4 h-4" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-black text-white">{ticket.subject}</p><span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${['high','urgent'].includes(ticket.priority)?'border-red-500/20 bg-red-500/10 text-red-300':'border-zinc-700 bg-zinc-900 text-zinc-500'}`}>{ticket.priority}</span></div><p className="mt-1 text-[10px] text-zinc-500">{ticket.companyName} · {ticket.createdByName} · {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString('es-CL') : 'sin fecha'}</p><p className="mt-2 max-w-3xl text-[10px] leading-relaxed text-zinc-400">{ticket.description}</p><p className="mt-2 text-[9px] text-zinc-600">Asignado: {ticket.assignedPartnerName}</p></div></div><div className="flex shrink-0 flex-col sm:flex-row items-stretch sm:items-center gap-2"><span className={`rounded-full border px-2.5 py-1.5 text-center text-[9px] font-black uppercase ${ticket.status==='resolved'||ticket.status==='closed'?'border-emerald-500/25 bg-emerald-500/10 text-emerald-300':ticket.status==='in_progress'?'border-blue-500/25 bg-blue-500/10 text-blue-300':'border-amber-500/25 bg-amber-500/10 text-amber-300'}`}>{statusLabel[ticket.status]}</span>{!['resolved','closed'].includes(ticket.status)&&<select disabled={changingId===ticket.id} value={ticket.status} onChange={(e)=>void changeStatus(ticket,e.target.value as SupportTicketStatus)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-[10px] font-bold text-zinc-300"><option value="open">Abierto</option><option value="in_progress">En proceso</option><option value="waiting_customer">Esperando cliente</option><option value="resolved">Resolver</option><option value="closed">Cerrar</option></select>}</div></div></article>)}</div>
        {!loading&&filtered.length===0&&<div className="p-12 text-center text-xs text-zinc-500">No hay tickets reales visibles con este filtro.</div>}
      </section>

      <section className="grid md:grid-cols-3 gap-4">{[['Nivel 1','Partner comercial','Capacitación y uso básico'],['Nivel 2','Partner regional','Configuración y operación'],['Nivel 3','Central GO Global','Errores técnicos, seguridad y facturación']].map(([level,owner,detail])=><div key={level} className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-4"><p className="text-[9px] font-black uppercase tracking-widest text-blue-300">{level}</p><p className="mt-2 text-xs font-black text-white">{owner}</p><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">{detail}</p></div>)}</section>
    </div>
  );
};
