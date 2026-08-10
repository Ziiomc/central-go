import React, { useEffect, useMemo, useState } from 'react';
import { Car, Headphones, Loader2, Lock, MailPlus, RefreshCw, ShieldCheck, UserRound, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { inviteCompanyUser, loadCompanyUsers, type CompanyUserDirectoryItem, type CompanyUserRole } from '../../lib/userRepository';

const roleLabel: Record<CompanyUserRole, string> = {
  company_admin: 'Administrador de central',
  operator: 'Operadora / despacho',
  driver: 'Conductor',
};

const roleIcon: Record<CompanyUserRole, React.ReactNode> = {
  company_admin: <ShieldCheck className="h-4 w-4 text-amber-300" />,
  operator: <Headphones className="h-4 w-4 text-blue-300" />,
  driver: <Car className="h-4 w-4 text-emerald-300" />,
};

export const UsersModule: React.FC = () => {
  const { currentCompany } = useApp();
  const [users, setUsers] = useState<CompanyUserDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ name: '', email: '', role: 'operator' as 'operator' | 'driver' });

  const reload = async () => {
    if (!currentCompany.id || currentCompany.id === 'network') return;
    setLoading(true);
    setError('');
    try {
      setUsers(await loadCompanyUsers(currentCompany.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, [currentCompany.id]);

  const counts = useMemo(() => ({
    admins: users.filter((user) => user.role === 'company_admin' && user.active).length,
    operators: users.filter((user) => user.role === 'operator' && user.active).length,
    drivers: users.filter((user) => user.role === 'driver' && user.active).length,
  }), [users]);

  const submitInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await inviteCompanyUser({
        companyId: currentCompany.id,
        name: form.name,
        email: form.email,
        role: form.role,
        redirectTo: `${window.location.origin}${form.role === 'driver' ? '/driver' : '/'}`,
      });
      setNotice(result.message + (form.role === 'driver' ? '. Luego vincula su móvil desde Conductores.' : '.'));
      setInviteOpen(false);
      setForm({ name: '', email: '', role: 'operator' });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible invitar al usuario.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-300 mb-2"><Lock className="w-3.5 h-3.5" />Accesos reales</div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Usuarios y permisos</h1>
          <p className="text-xs text-zinc-400 mt-1">Cuentas sincronizadas con Supabase para {currentCompany.name}. Las invitaciones llegan por correo.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void reload()} disabled={loading} className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 flex items-center gap-2 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button>
          <button onClick={() => setInviteOpen(true)} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black text-white flex items-center gap-2"><MailPlus className="h-4 w-4" />Invitar usuario</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Administradores" value={counts.admins} icon={<ShieldCheck className="h-4 w-4 text-amber-300" />} />
        <Stat label="Operadoras" value={counts.operators} icon={<Headphones className="h-4 w-4 text-blue-300" />} />
        <Stat label="Conductores con acceso" value={counts.drivers} icon={<Car className="h-4 w-4 text-emerald-300" />} />
      </div>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-200">{notice}</div>}

      <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-zinc-950/60 border-b border-zinc-800"><tr>{['Usuario', 'Correo', 'Rol', 'Estado', 'Alta'].map((label) => <th key={label} className="p-3.5 text-[9px] uppercase tracking-widest font-black text-zinc-600">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-zinc-900">
              {users.map((user) => (
                <tr key={`${user.userId}-${user.role}`} className="hover:bg-zinc-900/30">
                  <td className="p-3.5"><div className="flex items-center gap-3"><div className="h-9 w-9 rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-400"><UserRound className="h-4 w-4" /></div><div><p className="text-xs font-black text-white">{user.name}</p><p className="text-[9px] text-zinc-600">{user.phone || 'Teléfono pendiente'}</p></div></div></td>
                  <td className="p-3.5 text-[10px] font-mono text-zinc-400">{user.email || 'Correo pendiente'}</td>
                  <td className="p-3.5"><div className="flex items-center gap-2 text-[10px] font-bold text-zinc-300">{roleIcon[user.role]}{roleLabel[user.role]}</div></td>
                  <td className="p-3.5"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${user.active ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 bg-zinc-900 text-zinc-500'}`}>{user.active ? 'Activo' : 'Inactivo'}</span></td>
                  <td className="p-3.5 text-[10px] text-zinc-500">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-CL') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && users.length === 0 && <div className="p-12 text-center text-xs text-zinc-500">Aún no hay usuarios vinculados a esta central.</div>}
          {loading && <div className="p-8 flex items-center justify-center gap-2 text-xs font-bold text-blue-300"><Loader2 className="h-4 w-4 animate-spin" />Sincronizando usuarios…</div>}
        </div>
      </section>

      {inviteOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form onSubmit={submitInvite} className="w-full max-w-md rounded-3xl border border-zinc-700 bg-[#0d0d0f] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black text-white">Invitar usuario</h2><p className="mt-1 text-xs text-zinc-500">Se creará o vinculará una cuenta real de Supabase.</p></div><button type="button" onClick={() => setInviteOpen(false)} className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400"><X className="h-4 w-4" /></button></div>
            <div className="mt-5 space-y-4">
              <Field label="Nombre" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} placeholder="Nombre y apellido" />
              <Field label="Correo" type="email" value={form.email} onChange={(value) => setForm((prev) => ({ ...prev, email: value }))} placeholder="usuario@correo.com" />
              <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Rol</span><select value={form.role} onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as 'operator' | 'driver' }))} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-blue-500/50"><option value="operator">Operadora / despacho</option><option value="driver">Conductor</option></select></label>
              {form.role === 'driver' && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[10px] leading-relaxed text-emerald-200/80">El conductor recibirá acceso a la app independiente. Después debes asociarlo a un móvil en la sección Conductores.</div>}
            </div>
            <button disabled={saving || !form.email.trim()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white hover:bg-blue-500 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}{saving ? 'Enviando invitación…' : 'Enviar invitación segura'}</button>
          </form>
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number; icon: React.ReactNode }> = ({ label, value, icon }) => <div className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-4"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-zinc-600">{icon}{label}</div><p className="mt-2 text-2xl font-black text-white">{value}</p></div>;

const Field: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }> = ({ label, value, onChange, placeholder, type = 'text' }) => <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</span><input required type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-blue-500/50" /></label>;
