import React, { useEffect, useMemo, useState } from 'react';
import { Headphones, Loader2, RefreshCw, UserCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { loadCompanyUsers, type CompanyUserDirectoryItem } from '../../lib/userRepository';

export const OperatorsModule: React.FC = () => {
  const { currentCompany, trips } = useApp();
  const [operators, setOperators] = useState<CompanyUserDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = async () => {
    setLoading(true); setError('');
    try {
      const users = await loadCompanyUsers(currentCompany.id);
      setOperators(users.filter((user) => user.role === 'operator'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar las operadoras.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, [currentCompany.id]);

  const today = new Date().toISOString().slice(0, 10);
  const stats = useMemo(() => new Map(operators.map((operator) => {
    const own = trips.filter((trip) => trip.operatorId === operator.userId && trip.createdAt.slice(0, 10) === today);
    const assignedSeconds = own
      .filter((trip) => trip.assignedAt)
      .map((trip) => Math.max(0, (new Date(trip.assignedAt!).getTime() - new Date(trip.createdAt).getTime()) / 1000));
    const avg = assignedSeconds.length ? Math.round(assignedSeconds.reduce((sum, value) => sum + value, 0) / assignedSeconds.length) : null;
    return [operator.userId, { dispatches: own.length, avg }];
  })), [operators, trips, today]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-2"><Headphones className="w-6 h-6 text-blue-500" />Operadoras</h1><p className="text-xs text-zinc-400 mt-1">Cuentas reales de despacho vinculadas a {currentCompany.name}.</p></div><button onClick={() => void reload()} disabled={loading} className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 flex items-center gap-2 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button></div>
      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{error}</div>}
      {loading && <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs font-bold text-blue-300"><Loader2 className="h-4 w-4 animate-spin" />Sincronizando operadoras…</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {operators.map((operator) => { const stat=stats.get(operator.userId); return <article key={operator.userId} className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-5 shadow-xl"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3 min-w-0"><div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center"><Headphones className="w-5 h-5" /></div><div className="min-w-0"><p className="font-black text-sm text-white truncate">{operator.name}</p><p className="text-[10px] text-zinc-500 truncate">{operator.email}</p></div></div><span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border ${operator.active?'bg-emerald-500/10 text-emerald-300 border-emerald-500/25':'bg-zinc-900 text-zinc-500 border-zinc-800'}`}>{operator.active?'Activa':'Inactiva'}</span></div><div className="grid grid-cols-2 gap-3 mt-4"><Metric label="Despachos hoy" value={String(stat?.dispatches ?? 0)} /><Metric label="Promedio asignación" value={stat?.avg == null ? '—' : `${stat.avg} s`} /></div><p className="mt-3 flex items-center gap-2 text-[9px] text-zinc-600"><UserCheck className="h-3.5 w-3.5" />Alta {operator.createdAt ? new Date(operator.createdAt).toLocaleDateString('es-CL') : 'sin fecha'}</p></article>; })}
      </div>
      {!loading && operators.length === 0 && <div className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-10 text-center text-xs text-zinc-500">Aún no hay cuentas con rol Operadora. Créala desde Usuarios y Permisos.</div>}
    </div>
  );
};

const Metric: React.FC<{ label:string; value:string }> = ({label,value}) => <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><p className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</p><p className="mt-1 text-lg font-black text-white">{value}</p></div>;
