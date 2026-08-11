import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Building2, Clock3, Loader2, RefreshCw, Store } from 'lucide-react';
import { approveActivationRequest, loadActivationRequests, type ActivationRequestItem } from '../../lib/billingAdminRepository';

export const ActivationRequestsPanel: React.FC = () => {
  const [items, setItems] = useState<ActivationRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [approving, setApproving] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true); setError('');
    try { setItems(await loadActivationRequests()); }
    catch (err) { setError(err instanceof Error ? err.message : 'No fue posible cargar las solicitudes de activación.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, []);
  const pending = useMemo(() => items.filter((item) => item.status === 'pending'), [items]);

  const approve = async (item: ActivationRequestItem) => {
    if (!window.confirm(`¿Confirmar pago y activar ${item.companyName || item.name}?`)) return;
    setApproving(item.id); setError(''); setNotice('');
    try {
      await approveActivationRequest(item.id);
      setNotice(`${item.companyName || item.name} quedó activado correctamente.`);
      await reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'No fue posible activar la cuenta.'); }
    finally { setApproving(null); }
  };

  return (
    <section className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] overflow-hidden shadow-xl">
      <div className="flex flex-col gap-3 border-b border-zinc-800 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-amber-300" /><h2 className="text-sm font-black text-white">Activaciones pendientes</h2>{pending.length > 0 && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-zinc-950">{pending.length}</span>}</div><p className="mt-1 text-[10px] text-zinc-500">Cuando una prueba termina y el cliente elige continuar, la solicitud aparece aquí.</p></div>
        <button onClick={() => void reload()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-[10px] font-bold text-zinc-400 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading?'animate-spin':''}`} />Actualizar</button>
      </div>
      {error && <div className="m-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{error}</div>}
      {notice && <div className="m-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-200">{notice}</div>}
      {loading ? <div className="flex items-center justify-center gap-2 p-8 text-xs font-bold text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" />Sincronizando activaciones…</div> : pending.length === 0 ? <div className="p-8 text-center"><BadgeCheck className="mx-auto h-7 w-7 text-emerald-400" /><p className="mt-2 text-xs font-black text-zinc-300">No hay pagos pendientes de confirmar</p><p className="mt-1 text-[9px] text-zinc-600">Las nuevas solicitudes aparecerán automáticamente aquí.</p></div> : <div className="divide-y divide-zinc-900">{pending.map((item) => <div key={item.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${item.accountKind==='central'?'border-amber-400/20 bg-amber-400/10 text-amber-300':'border-blue-500/20 bg-blue-500/10 text-blue-300'}`}>{item.accountKind==='central'?<Building2 className="h-5 w-5" />:<Store className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-white">{item.companyName || item.name}</p><p className="mt-0.5 truncate text-[9px] text-zinc-500">{item.email} · {item.accountKind==='central' ? `${item.planName || item.planCode || 'Plan'} · ${item.billingCycle==='annual'?'anual':'mensual'}` : 'Partner Comercial'}</p></div><div className="text-[9px] text-zinc-600">{new Date(item.createdAt).toLocaleString('es-CL')}</div><button disabled={approving===item.id} onClick={() => void approve(item)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-[10px] font-black text-zinc-950 disabled:opacity-50">{approving===item.id?<Loader2 className="h-4 w-4 animate-spin" />:<BadgeCheck className="h-4 w-4" />}Confirmar pago y activar</button></div>)}</div>}
    </section>
  );
};
