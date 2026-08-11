import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Check, ChevronLeft, ChevronRight, Crown, Globe2, Loader2, MailCheck, UserRound, X, Zap } from 'lucide-react';
import type { NetworkCentral } from '../../data/networkMockData';
import { useApp } from '../../context/AppContext';
import { createNetworkCentral, loadNetworkCentrals } from '../../lib/networkRepository';
import { loadPlanCatalog, type CommercialPlanRecord } from '../../lib/planRepository';
import { inviteCompanyUser } from '../../lib/userRepository';
import { money } from './NetworkUi';

interface CentralRegistrationModalProps {
  open: boolean;
  onClose: () => void;
  onCreate?: (central: NetworkCentral) => void;
}

const countryCode: Record<string, string> = {
  Chile: 'CL', Argentina: 'AR', Perú: 'PE', México: 'MX', España: 'ES', Ecuador: 'EC', Colombia: 'CO', Uruguay: 'UY', Brasil: 'BR',
};

const steps = [
  { id: 1, title: 'Central', detail: 'Empresa y ubicación', icon: Building2 },
  { id: 2, title: 'Administrador', detail: 'Cuenta propietaria', icon: UserRound },
  { id: 3, title: 'Plan', detail: 'Oferta y prueba', icon: Globe2 },
];

export const CentralRegistrationModal: React.FC<CentralRegistrationModalProps> = ({ open, onClose, onCreate }) => {
  const { currentRole } = useApp();
  const [step, setStep] = useState(1);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');
  const [plans, setPlans] = useState<CommercialPlanRecord[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ ownerInvited: boolean; ownerAssigned: boolean } | null>(null);
  const [form, setForm] = useState({
    name: '', code: '', country: 'Chile', region: '', city: '', owner: '', phone: '', email: '', vehicles: '20', plan: 'Enterprise' as 'Start' | 'Pro' | 'Enterprise',
  });

  useEffect(() => {
    if (!open || plans.length) return;
    setPlansLoading(true);
    loadPlanCatalog()
      .then(setPlans)
      .catch((err) => setError(err instanceof Error ? err.message : 'No fue posible cargar los planes.'))
      .finally(() => setPlansLoading(false));
  }, [open, plans.length]);

  const selectedPlan = useMemo(() => plans.find((plan) => plan.name === form.plan) ?? plans.find((plan) => plan.recommended) ?? plans[0], [plans, form.plan]);
  const estimatedVehicles = Number(form.vehicles) || 0;
  const planUnavailable = (plan: CommercialPlanRecord) => plan.maxVehicles != null && estimatedVehicles > plan.maxVehicles;
  const canContinue = step === 1
    ? form.name.trim().length >= 2 && form.code.trim().length >= 2 && form.city.trim().length >= 2
    : step === 2
      ? form.owner.trim().length >= 2 && form.email.includes('@')
      : Boolean(selectedPlan && !planUnavailable(selectedPlan));

  if (!open) return null;

  const update = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const resetAndClose = () => {
    setStep(1); setBilling('annual'); setError(''); setSuccess(null);
    setForm({ name: '', code: '', country: 'Chile', region: '', city: '', owner: '', phone: '', email: '', vehicles: '20', plan: 'Enterprise' });
    onClose();
  };

  const submit = async () => {
    if (!selectedPlan) return;
    setSaving(true); setError('');
    try {
      const result = await createNetworkCentral({
        name: form.name, code: form.code, city: form.city, countryCode: countryCode[form.country] ?? 'CL', phone: form.phone,
        address: form.region, plan: form.plan, billing, ownerEmail: form.email,
      }, currentRole);

      let ownerAssigned = result.ownerAssigned;
      let ownerInvited = false;
      if (!ownerAssigned && form.email.trim()) {
        const invite = await inviteCompanyUser({ companyId: result.companyId, email: form.email, name: form.owner, role: 'company_admin', redirectTo: `${window.location.origin}/` });
        ownerAssigned = true;
        ownerInvited = invite.invited;
      }

      const visible = await loadNetworkCentrals();
      const created = visible.find((central) => central.id === result.companyId);
      if (created) onCreate?.(created);
      setSuccess({ ownerInvited, ownerAssigned });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible registrar la central.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/80 p-0 backdrop-blur-md sm:flex sm:items-center sm:justify-center sm:p-4">
      <div className="flex min-h-full w-full max-w-4xl flex-col overflow-visible rounded-none border border-zinc-700 bg-[#0d0d0f] shadow-2xl sm:min-h-0 sm:max-h-[calc(100dvh-2rem)] sm:overflow-hidden sm:rounded-3xl">
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-zinc-800 bg-gradient-to-r from-purple-950/30 via-[#0d0d0f] to-blue-950/20 p-5 sm:p-6">
          <div><div className="mb-2 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-purple-300"><Zap className="h-3 w-3" />Alta oficial</div><h2 className="text-xl font-black text-white">Registrar nueva central</h2><p className="mt-1 text-xs text-zinc-400">Crea la empresa, su prueba de 14 días y el acceso del administrador directamente en Supabase.</p></div>
          <button onClick={resetAndClose} className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        {success ? (
          <div className="p-8 text-center sm:p-10"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"><MailCheck className="h-7 w-7" /></div><h3 className="mt-5 text-xl font-black text-white">Central creada correctamente</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">La central quedó registrada con su plan y periodo de prueba. {success.ownerInvited ? 'Enviamos una invitación al administrador para crear su contraseña y entrar.' : success.ownerAssigned ? 'La cuenta del administrador quedó vinculada a la central.' : 'El acceso del administrador queda pendiente.'}</p><button onClick={resetAndClose} className="mt-6 rounded-xl bg-emerald-500 px-5 py-3 text-xs font-black text-zinc-950 hover:bg-emerald-400">Continuar</button></div>
        ) : (
          <>
            <div className="shrink-0 grid grid-cols-3 border-b border-zinc-800 bg-zinc-950/45">{steps.map(({ id, title, detail, icon: Icon }) => <div key={id} className={`flex items-center gap-3 border-r border-zinc-800 p-3 sm:p-4 last:border-r-0 ${step === id ? 'bg-blue-500/[0.04]' : ''}`}><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${step > id ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : step === id ? 'border-blue-500/30 bg-blue-500/10 text-blue-300' : 'border-zinc-800 bg-zinc-900 text-zinc-600'}`}>{step > id ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</div><div className="hidden sm:block"><p className={`text-[11px] font-extrabold ${step === id ? 'text-white' : 'text-zinc-500'}`}>{title}</p><p className="text-[9px] text-zinc-600">{detail}</p></div></div>)}</div>
            <div className="min-h-[390px] flex-1 p-5 pb-24 sm:min-h-0 sm:overflow-y-auto sm:p-6 sm:pb-6">
              {error && <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{error}</div>}
              {step === 1 && <div className="grid gap-4 sm:grid-cols-2"><Field label="Nombre comercial" value={form.name} onChange={(v) => update('name', v)} placeholder="Ej. Royal Taxi Linares" className="sm:col-span-2" /><Field label="Código interno único" value={form.code} onChange={(v) => update('code', v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24))} placeholder="ROYAL-LINARES" /><Field label="Móviles estimados" type="number" value={form.vehicles} onChange={(v) => update('vehicles', v)} placeholder="20" /><SelectField label="País" value={form.country} onChange={(v) => update('country', v)} options={Object.keys(countryCode)} /><Field label="Región / Estado" value={form.region} onChange={(v) => update('region', v)} placeholder="Región del Maule" /><Field label="Ciudad" value={form.city} onChange={(v) => update('city', v)} placeholder="Linares" /><Field label="Teléfono central" value={form.phone} onChange={(v) => update('phone', v)} placeholder="+56 9 ..." /><div className="sm:col-span-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 text-[11px] leading-relaxed text-blue-200/80">Cada central queda aislada mediante RLS: sus clientes, carreras, usuarios, GPS y flota no son visibles para otras empresas.</div></div>}
              {step === 2 && <div className="grid gap-4 sm:grid-cols-2"><Field label="Nombre del administrador" value={form.owner} onChange={(v) => update('owner', v)} placeholder="Nombre y apellido" className="sm:col-span-2" /><Field label="Correo de acceso" type="email" value={form.email} onChange={(v) => update('email', v)} placeholder="administracion@central.cl" /><div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-[11px] leading-relaxed text-emerald-200/80"><strong className="block text-emerald-300">Acceso sin contraseña compartida</strong>Si el correo aún no existe, Central GO enviará una invitación para que el propietario cree su propia contraseña.</div><div className="sm:col-span-2 grid gap-3 sm:grid-cols-3">{['Cuenta administrador', 'Prueba 14 días', 'Datos separados por central'].map((item) => <div key={item} className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-[10px] text-zinc-300"><Check className="h-3.5 w-3.5 text-emerald-400" />{item}</div>)}</div></div>}
              {step === 3 && <div className="space-y-5"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Plan de la central</p><p className="mt-1 text-[10px] text-emerald-400">Los valores vienen del catálogo oficial de Supabase.</p></div><div className="flex rounded-xl border border-zinc-800 bg-zinc-950 p-1"><button onClick={() => setBilling('monthly')} className={`rounded-lg px-3 py-2 text-[10px] font-black ${billing === 'monthly' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>Mensual</button><button onClick={() => setBilling('annual')} className={`rounded-lg px-3 py-2 text-[10px] font-black ${billing === 'annual' ? 'bg-emerald-400 text-zinc-950' : 'text-emerald-400'}`}>Anual recomendado</button></div></div>{plansLoading ? <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs font-bold text-blue-300"><Loader2 className="h-4 w-4 animate-spin" />Cargando planes…</div> : <div className="grid gap-3 md:grid-cols-3">{plans.map((plan) => { const unavailable=planUnavailable(plan); const selected=form.plan===plan.name; const price=billing==='annual'?plan.annualMonthlyPrice:plan.monthlyPrice; return <button key={plan.id} disabled={unavailable} onClick={() => update('plan', plan.name)} className={`relative text-left rounded-2xl border p-4 transition disabled:cursor-not-allowed disabled:opacity-40 ${selected ? plan.recommended ? 'border-purple-400/60 bg-purple-500/10 ring-1 ring-purple-500/20' : 'border-amber-500/45 bg-amber-500/[0.06]' : 'border-zinc-800 bg-zinc-950/50 hover:border-zinc-700'}`}>{plan.recommended && <span className="absolute -top-2 right-3 rounded-full bg-purple-500 px-2 py-0.5 text-[8px] font-black uppercase text-white">Recomendado</span>}<div className="flex items-center justify-between"><p className="text-xs font-black text-white">{plan.name}</p>{plan.recommended ? <Crown className="h-4 w-4 text-purple-300" /> : selected ? <Check className="h-4 w-4 text-amber-300" /> : null}</div><p className="mt-3 text-xl font-black text-white">{money(price)}<span className="text-[9px] text-zinc-500"> / mes</span></p>{billing==='annual'&&<p className="mt-1 text-[9px] font-bold text-emerald-400">Total anual {money(plan.annualPrice)}</p>}<p className="mt-3 text-[10px] leading-relaxed text-zinc-500">{plan.features.sales_highlight}</p><div className="mt-3 border-t border-zinc-800 pt-3 text-[9px] text-zinc-500">{plan.maxVehicles==null?'Móviles ilimitados':`Hasta ${plan.maxVehicles} móviles`} · {plan.maxOperators==null?'Operadoras ilimitadas':`Hasta ${plan.maxOperators} operadoras`}</div>{unavailable&&<p className="mt-2 text-[9px] font-black text-rose-400">No admite {estimatedVehicles} móviles</p>}</button>; })}</div>}<div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.05] p-4 text-[10px] leading-relaxed text-purple-200/80">{currentRole==='super_admin'?'Superadmin controla posteriormente activación, suspensión y estado de la suscripción.':'Esta alta quedará atribuida automáticamente a tu código de partner. Las comisiones se calculan sobre ventas reales pagadas, no por reclutar personas.'}</div></div>}
            </div>
            <div className="sticky bottom-0 z-20 shrink-0 flex items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-950/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] backdrop-blur sm:static sm:bg-zinc-950/45 sm:px-6 sm:pb-4"><button disabled={step===1||saving} onClick={()=>setStep((v)=>Math.max(1,v-1))} className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-bold text-zinc-300 disabled:opacity-30"><ChevronLeft className="h-4 w-4" />Atrás</button>{step<3?<button disabled={!canContinue} onClick={()=>setStep((v)=>Math.min(3,v+1))} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-black text-white hover:bg-blue-500 disabled:opacity-40">Continuar<ChevronRight className="h-4 w-4" /></button>:<button disabled={!canContinue||saving} onClick={()=>void submit()} className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black text-zinc-950 hover:bg-amber-300 disabled:opacity-40">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Building2 className="h-4 w-4"/>}{saving?'Creando…':'Crear central'}</button>}</div>
          </>
        )}
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string; className?: string }> = ({ label, value, onChange, placeholder, type='text', className='' }) => <label className={`block ${className}`}><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</span><input required type={type} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-blue-500/50" /></label>;
const SelectField: React.FC<{ label: string; value: string; onChange: (value: string) => void; options: string[] }> = ({ label,value,onChange,options }) => <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</span><select value={value} onChange={(e)=>onChange(e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-blue-500/50">{options.map((option)=><option key={option}>{option}</option>)}</select></label>;
