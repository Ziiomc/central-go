import React, { useEffect, useMemo, useState } from 'react';
import { Check, Headphones, KeyRound, Loader2, LogOut, MailPlus, MonitorCheck, MonitorOff, PlayCircle, RefreshCw, Send, UserCheck, UserPlus, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { loadCompanyUsers, inviteCompanyUser, type CompanyUserDirectoryItem } from '../../lib/userRepository';
import { loadCompanyOperatorApplications, reviewOperatorApplication, type CompanyOperatorApplication } from '../../lib/operatorRepository';
import {
  authorizeThisOperatorTerminal,
  isValidOperatorUsername,
  readOperatorTerminal,
  revokeThisOperatorTerminal,
  type OperatorTerminalConfig,
} from '../../lib/operatorTerminal';

export const OperatorsModule: React.FC = () => {
  const { currentCompany, trips } = useApp();
  const { signOut } = useAuth();
  const [operators, setOperators] = useState<CompanyUserDirectoryItem[]>([]);
  const [applications, setApplications] = useState<CompanyOperatorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'manual' | 'google'>('manual');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<OperatorTerminalConfig | null>(() => readOperatorTerminal());
  const [terminalLabel, setTerminalLabel] = useState('Computador principal');

  const reload = async () => {
    setLoading(true); setError('');
    try {
      const [users, pending] = await Promise.all([
        loadCompanyUsers(currentCompany.id),
        loadCompanyOperatorApplications(currentCompany.id),
      ]);
      setOperators(users.filter((user) => user.role === 'operator'));
      setApplications(pending);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar los operadores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, [currentCompany.id]);

  const resetCreateForm = () => {
    setInviteEmail(''); setInviteName(''); setUsername(''); setPassword(''); setConfirmPassword('');
  };

  const createOperator = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy('create'); setError(''); setNotice('');
    try {
      if (createMode === 'manual') {
        if (!isValidOperatorUsername(username)) throw new Error('El usuario debe tener entre 3 y 32 caracteres y usar solo letras, números, punto, guion o guion bajo.');
        if (password.length < 10) throw new Error('La contraseña debe tener al menos 10 caracteres.');
        if (password !== confirmPassword) throw new Error('Las contraseñas no coinciden.');
        const result = await inviteCompanyUser({ companyId: currentCompany.id, role: 'operator', name: inviteName, username, initialPassword: password });
        setNotice(`${result.message} Ya puedes pulsar “Iniciar turno” en esta misma pantalla.`);
      } else {
        const result = await inviteCompanyUser({ companyId: currentCompany.id, email: inviteEmail, role: 'operator', name: inviteName });
        setNotice(result.message);
      }
      setCreateOpen(false); resetCreateForm(); await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible crear el acceso del operador.');
    } finally {
      setBusy(null);
    }
  };

  const review = async (application: CompanyOperatorApplication, approve: boolean) => {
    const reason = approve ? undefined : window.prompt(`Motivo para rechazar la solicitud de ${application.name}:`)?.trim();
    if (!approve && !reason) return;
    setBusy(application.id); setError(''); setNotice('');
    try {
      await reviewOperatorApplication(application.id, approve, reason);
      setNotice(approve ? `${application.name} ya puede operar en ${currentCompany.name}.` : 'Solicitud rechazada.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible revisar la solicitud.');
    } finally {
      setBusy(null);
    }
  };

  const authorizeTerminal = async () => {
    setBusy('terminal'); setError(''); setNotice('');
    try {
      if (terminal && terminal.companyId !== currentCompany.id) throw new Error(`Este navegador ya está autorizado como terminal de ${terminal.companyName}. Revoca esa terminal antes de vincularlo a otra central.`);
      if (terminal?.companyId === currentCompany.id) {
        setNotice('Este computador ya está autorizado para esta central. Pulsa “Ir al acceso de operadores” para comenzar un turno.');
        return;
      }
      const created = await authorizeThisOperatorTerminal({ companyId: currentCompany.id, companyName: currentCompany.name, label: terminalLabel });
      setTerminal(created);
      setNotice('Computador autorizado. Ya puedes abrir el acceso de operadores sin buscar otra pantalla.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible autorizar este computador.');
    } finally {
      setBusy(null);
    }
  };

  const revokeTerminal = async () => {
    if (!terminal || terminal.companyId !== currentCompany.id) return;
    setBusy('terminal'); setError(''); setNotice('');
    try {
      await revokeThisOperatorTerminal(terminal);
      setTerminal(null);
      setNotice('Terminal revocada. Este navegador volverá a mostrar el acceso general.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible revocar esta terminal.');
    } finally {
      setBusy(null);
    }
  };

  const goToOperatorLogin = async () => {
    if (!terminal || terminal.companyId !== currentCompany.id) {
      setError('Primero autoriza este computador como terminal de operadores.');
      return;
    }
    setBusy('switch'); setError(''); setNotice('');
    try {
      await signOut();
      window.location.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible abrir el acceso de operadores.');
      setBusy(null);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const stats = useMemo(() => new Map(operators.map((operator) => {
    const own = trips.filter((trip) => trip.operatorId === operator.userId && trip.createdAt.slice(0, 10) === today);
    const assignedSeconds = own.filter((trip) => trip.assignedAt).map((trip) => Math.max(0, (new Date(trip.assignedAt!).getTime() - new Date(trip.createdAt).getTime()) / 1000));
    const avg = assignedSeconds.length ? Math.round(assignedSeconds.reduce((sum, value) => sum + value, 0) / assignedSeconds.length) : null;
    return [operator.userId, { dispatches: own.length, avg }];
  })), [operators, trips, today]);

  const currentTerminalActive = terminal?.companyId === currentCompany.id;
  const operatorAccessLabel = (operator: CompanyUserDirectoryItem) => {
    const internal = operator.email.match(/^([^@]+)@[0-9a-f-]+\.operators\.centralgo\.app$/i);
    return internal ? `Usuario: ${internal[1]}` : operator.email;
  };

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-white"><Headphones className="h-6 w-6 text-blue-500" />Operadores y operadoras</h1><p className="mt-1 text-xs text-zinc-400">Crea accesos propios para cada turno y controla qué computadores pueden operar en {currentCompany.name}.</p></div>
      <div className="flex gap-2"><button onClick={() => { setCreateMode('manual'); setCreateOpen(true); }} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white"><KeyRound className="h-4 w-4" />Crear acceso</button><button onClick={() => void reload()} disabled={loading} className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-bold text-zinc-300 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button></div>
    </div>

    <section className={`rounded-2xl border p-5 ${currentTerminalActive ? 'border-emerald-500/25 bg-emerald-500/[.06]' : 'border-blue-500/20 bg-blue-500/[.05]'}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${currentTerminalActive ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-blue-500/20 bg-blue-500/10 text-blue-300'}`}><MonitorCheck className="h-5 w-5" /></span><div><h2 className="text-sm font-black text-white">Terminal de operadores</h2><p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-zinc-400">Autoriza este computador una sola vez. Cuando esté activo, usa el botón <strong className="text-white">Ir al acceso de operadores</strong>; no necesitas buscar otra pantalla ni revocar la terminal.</p>{currentTerminalActive && <p className="mt-2 text-[10px] font-black text-emerald-300">Autorizada · {terminal?.label}</p>}{terminal && !currentTerminalActive && <p className="mt-2 text-[10px] font-black text-amber-300">Este navegador está vinculado a {terminal.companyName}.</p>}</div></div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row lg:w-auto">
          {!currentTerminalActive && !terminal && <input value={terminalLabel} onChange={event=>setTerminalLabel(event.target.value)} maxLength={80} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs text-white outline-none focus:border-blue-500" placeholder="Nombre del computador" />}
          {currentTerminalActive ? <><button disabled={busy==='switch'} onClick={()=>void goToOperatorLogin()} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{busy==='switch'?<Loader2 className="h-4 w-4 animate-spin"/>:<PlayCircle className="h-4 w-4" />}Ir al acceso de operadores</button><button disabled={busy==='terminal'} onClick={()=>void revokeTerminal()} className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-2.5 text-xs font-black text-rose-300"><MonitorOff className="h-4 w-4" />Revocar terminal</button></> : <button disabled={busy==='terminal'||Boolean(terminal)} onClick={()=>void authorizeTerminal()} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{busy==='terminal'?<Loader2 className="h-4 w-4 animate-spin"/>:<MonitorCheck className="h-4 w-4" />}Autorizar este computador</button>}
        </div>
      </div>
    </section>

    {notice && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-200">{notice}</div>}
    {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{error}</div>}
    {applications.length > 0 && <section className="rounded-2xl border border-amber-500/25 bg-amber-500/[.06] p-5"><div className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-amber-300" /><div><h2 className="text-sm font-black text-white">Solicitudes para unirse</h2><p className="text-[10px] text-zinc-500">Cuentas Google que eligieron esta central.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2">{applications.map((application)=><article key={application.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="font-black text-white">{application.name}</p><p className="mt-1 text-[10px] text-zinc-500">{application.email}</p><div className="mt-3 flex gap-2"><button disabled={busy===application.id} onClick={()=>void review(application,true)} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 py-2 text-[10px] font-black text-white"><Check className="h-3.5 w-3.5" />Aprobar</button><button disabled={busy===application.id} onClick={()=>void review(application,false)} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-rose-500/25 bg-rose-500/10 py-2 text-[10px] font-black text-rose-300"><X className="h-3.5 w-3.5" />Rechazar</button></div></article>)}</div></section>}
    {loading && <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs font-bold text-blue-300"><Loader2 className="h-4 w-4 animate-spin" />Sincronizando operadores…</div>}
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{operators.map((operator) => { const stat=stats.get(operator.userId); return <article key={operator.userId} className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-5 shadow-xl"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400"><Headphones className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate text-sm font-black text-white">{operator.name}</p><p className="truncate text-[10px] text-zinc-500">{operatorAccessLabel(operator)}</p></div></div><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${operator.active?'border-emerald-500/25 bg-emerald-500/10 text-emerald-300':'border-zinc-800 bg-zinc-900 text-zinc-500'}`}>{operator.active?'Activa':'Inactiva'}</span></div><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Despachos hoy" value={String(stat?.dispatches ?? 0)} /><Metric label="Promedio asignación" value={stat?.avg == null ? '—' : `${stat.avg} s`} /></div>{currentTerminalActive&&operator.active&&<button type="button" disabled={busy==='switch'} onClick={()=>void goToOperatorLogin()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[10px] font-black text-emerald-200"><PlayCircle className="h-3.5 w-3.5" />Iniciar turno</button>}<p className="mt-3 flex items-center gap-2 text-[9px] text-zinc-600"><UserCheck className="h-3.5 w-3.5" />Alta {operator.createdAt ? new Date(operator.createdAt).toLocaleDateString('es-CL') : 'sin fecha'}</p></article>; })}</div>
    {!loading && operators.length === 0 && <div className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-10 text-center text-xs text-zinc-500">Aún no hay operadores activos. Crea un usuario propio o invita una cuenta Google.</div>}

    {createOpen && <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/80 p-2 backdrop-blur-md sm:p-4"><form onSubmit={createOperator} className="my-auto max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-4 sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-widest text-blue-300">Acceso de operador</p><h2 className="text-lg font-black text-white">Agregar operador/a</h2></div><button type="button" onClick={()=>setCreateOpen(false)} className="p-2 text-zinc-500" aria-label="Cerrar formulario de operador"><X className="h-4 w-4" /></button></div><div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-950 p-1"><button type="button" onClick={()=>setCreateMode('manual')} className={`rounded-lg px-3 py-2 text-[10px] font-black ${createMode==='manual'?'bg-blue-600 text-white':'text-zinc-500'}`}>Usuario propio</button><button type="button" onClick={()=>setCreateMode('google')} className={`rounded-lg px-3 py-2 text-[10px] font-black ${createMode==='google'?'bg-blue-600 text-white':'text-zinc-500'}`}>Cuenta Google</button></div><p className="mt-3 text-xs leading-relaxed text-zinc-500">{createMode==='manual'?'La central define el usuario y la contraseña. El operador entra directamente desde un computador autorizado.':'Mantiene el sistema de invitación por correo/Google para quien lo necesite.'}</p><label className="mt-5 block"><span className="text-[9px] font-black uppercase text-zinc-500">Nombre</span><input required value={inviteName} onChange={event=>setInviteName(event.target.value)} className={inputClass} placeholder="Nombre del operador o la operadora" /></label>{createMode==='manual'?<><label className="mt-3 block"><span className="text-[9px] font-black uppercase text-zinc-500">Usuario</span><input required minLength={3} maxLength={32} autoCapitalize="none" value={username} onChange={event=>setUsername(event.target.value)} className={inputClass} placeholder="operador01" /></label><label className="mt-3 block"><span className="text-[9px] font-black uppercase text-zinc-500">Contraseña</span><input required minLength={10} type="password" autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)} className={inputClass} placeholder="Mínimo 10 caracteres" /></label><label className="mt-3 block"><span className="text-[9px] font-black uppercase text-zinc-500">Repetir contraseña</span><input required minLength={10} type="password" autoComplete="new-password" value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} className={inputClass} placeholder="Repite la contraseña" /></label></>:<label className="mt-3 block"><span className="text-[9px] font-black uppercase text-zinc-500">Correo de acceso</span><input required type="email" value={inviteEmail} onChange={event=>setInviteEmail(event.target.value)} className={inputClass} placeholder="nombre@gmail.com" /></label>}<button disabled={busy==='create'} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-black text-white disabled:opacity-50">{busy==='create'?<Loader2 className="h-4 w-4 animate-spin"/>:createMode==='manual'?<KeyRound className="h-4 w-4"/>:<Send className="h-4 w-4" />}{busy==='create'?'Creando…':createMode==='manual'?'Crear usuario y contraseña':'Registrar y enviar acceso'}</button>{createMode==='google'&&<p className="mt-3 flex items-center justify-center gap-1 text-[9px] text-zinc-600"><MailPlus className="h-3 w-3" />Se enviará el flujo de invitación actual.</p>}</form></div>}
  </div>;
};

const inputClass='mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500';
const Metric: React.FC<{ label:string; value:string }> = ({label,value}) => <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><p className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</p><p className="mt-1 text-lg font-black text-white">{value}</p></div>;

