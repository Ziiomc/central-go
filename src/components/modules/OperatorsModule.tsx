import React, { useEffect, useMemo, useState } from 'react';
import { Check, Headphones, Loader2, MailPlus, RefreshCw, Send, UserCheck, UserPlus, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { loadCompanyUsers, inviteCompanyUser, type CompanyUserDirectoryItem } from '../../lib/userRepository';
import { loadCompanyOperatorApplications, reviewOperatorApplication, type CompanyOperatorApplication } from '../../lib/operatorRepository';

export const OperatorsModule: React.FC = () => {
  const { currentCompany, trips } = useApp();
  const [operators, setOperators] = useState<CompanyUserDirectoryItem[]>([]);
  const [applications, setApplications] = useState<CompanyOperatorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true); setError('');
    try {
      const [users, pending] = await Promise.all([
        loadCompanyUsers(currentCompany.id),
        loadCompanyOperatorApplications(currentCompany.id),
      ]);
      setOperators(users.filter((user) => user.role === 'operator'));
      setApplications(pending);
    } catch (err) { setError(err instanceof Error ? err.message : 'No fue posible cargar los operadores.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, [currentCompany.id]);

  const sendInvite = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy('invite'); setError(''); setNotice('');
    try {
      const result = await inviteCompanyUser({ companyId: currentCompany.id, email: inviteEmail, role: 'operator', name: inviteName });
      setNotice(result.message); setInviteOpen(false); setInviteEmail(''); setInviteName(''); await reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'No fue posible enviar la invitación.'); }
    finally { setBusy(null); }
  };

  const review = async (application: CompanyOperatorApplication, approve: boolean) => {
    const reason = approve ? undefined : window.prompt(`Motivo para rechazar la solicitud de ${application.name}:`)?.trim();
    if (!approve && !reason) return;
    setBusy(application.id); setError(''); setNotice('');
    try {
      await reviewOperatorApplication(application.id, approve, reason);
      setNotice(approve ? `${application.name} ya puede operar en ${currentCompany.name}.` : 'Solicitud rechazada.');
      await reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'No fue posible revisar la solicitud.'); }
    finally { setBusy(null); }
  };

  const today = new Date().toISOString().slice(0, 10);
  const stats = useMemo(() => new Map(operators.map((operator) => {
    const own = trips.filter((trip) => trip.operatorId === operator.userId && trip.createdAt.slice(0, 10) === today);
    const assignedSeconds = own.filter((trip) => trip.assignedAt).map((trip) => Math.max(0, (new Date(trip.assignedAt!).getTime() - new Date(trip.createdAt).getTime()) / 1000));
    const avg = assignedSeconds.length ? Math.round(assignedSeconds.reduce((sum, value) => sum + value, 0) / assignedSeconds.length) : null;
    return [operator.userId, { dispatches: own.length, avg }];
  })), [operators, trips, today]);

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-white"><Headphones className="h-6 w-6 text-blue-500" />Operadores y operadoras</h1><p className="mt-1 text-xs text-zinc-400">Registra manualmente su correo para habilitar el acceso seguro a {currentCompany.name}.</p></div><div className="flex gap-2"><button onClick={() => setInviteOpen(true)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white"><MailPlus className="h-4 w-4" />Registrar operador/a</button><button onClick={() => void reload()} disabled={loading} className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-bold text-zinc-300 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button></div></div>
    {notice && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-200">{notice}</div>}{error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{error}</div>}
    {applications.length > 0 && <section className="rounded-2xl border border-amber-500/25 bg-amber-500/[.06] p-5"><div className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-amber-300" /><div><h2 className="text-sm font-black text-white">Solicitudes para unirse</h2><p className="text-[10px] text-zinc-500">Cuentas Google que eligieron esta central.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2">{applications.map((application)=><article key={application.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="font-black text-white">{application.name}</p><p className="mt-1 text-[10px] text-zinc-500">{application.email}</p><div className="mt-3 flex gap-2"><button disabled={busy===application.id} onClick={()=>void review(application,true)} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 py-2 text-[10px] font-black text-white"><Check className="h-3.5 w-3.5" />Aprobar</button><button disabled={busy===application.id} onClick={()=>void review(application,false)} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-rose-500/25 bg-rose-500/10 py-2 text-[10px] font-black text-rose-300"><X className="h-3.5 w-3.5" />Rechazar</button></div></article>)}</div></section>}
    {loading && <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs font-bold text-blue-300"><Loader2 className="h-4 w-4 animate-spin" />Sincronizando operadores…</div>}
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{operators.map((operator) => { const stat=stats.get(operator.userId); return <article key={operator.userId} className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-5 shadow-xl"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400"><Headphones className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate text-sm font-black text-white">{operator.name}</p><p className="truncate text-[10px] text-zinc-500">{operator.email}</p></div></div><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${operator.active?'border-emerald-500/25 bg-emerald-500/10 text-emerald-300':'border-zinc-800 bg-zinc-900 text-zinc-500'}`}>{operator.active?'Activa':'Inactiva'}</span></div><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Despachos hoy" value={String(stat?.dispatches ?? 0)} /><Metric label="Promedio asignación" value={stat?.avg == null ? '—' : `${stat.avg} s`} /></div><p className="mt-3 flex items-center gap-2 text-[9px] text-zinc-600"><UserCheck className="h-3.5 w-3.5" />Alta {operator.createdAt ? new Date(operator.createdAt).toLocaleDateString('es-CL') : 'sin fecha'}</p></article>; })}</div>
    {!loading && operators.length === 0 && <div className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-10 text-center text-xs text-zinc-500">Aún no hay operadores activos. Registra su correo o aprueba una solicitud.</div>}
    {inviteOpen && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"><form onSubmit={sendInvite} className="w-full max-w-md rounded-3xl border border-zinc-800 bg-[#0d0d0f] p-6"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-widest text-blue-300">Registro manual</p><h2 className="text-lg font-black text-white">Registrar operador/a</h2></div><button type="button" onClick={()=>setInviteOpen(false)} className="p-2 text-zinc-500"><X className="h-4 w-4" /></button></div><p className="mt-3 text-xs leading-relaxed text-zinc-500">Registra su nombre y correo. En su primer acceso deberá entrar con Google; luego creará una contraseña y podrá usar cualquiera de las dos opciones.</p><label className="mt-5 block"><span className="text-[9px] font-black uppercase text-zinc-500">Nombre</span><input required value={inviteName} onChange={event=>setInviteName(event.target.value)} className={inputClass} placeholder="Nombre del operador o la operadora" /></label><label className="mt-3 block"><span className="text-[9px] font-black uppercase text-zinc-500">Correo de acceso</span><input required type="email" value={inviteEmail} onChange={event=>setInviteEmail(event.target.value)} className={inputClass} placeholder="nombre@gmail.com" /></label><button disabled={busy==='invite'} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-black text-white disabled:opacity-50">{busy==='invite'?<Loader2 className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4" />}{busy==='invite'?'Registrando…':'Registrar y enviar acceso'}</button></form></div>}
  </div>;
};

const inputClass='mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500';
const Metric: React.FC<{ label:string; value:string }> = ({label,value}) => <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><p className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</p><p className="mt-1 text-lg font-black text-white">{value}</p></div>;
