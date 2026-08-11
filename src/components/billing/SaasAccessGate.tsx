import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, Crown, Loader2, LockKeyhole, ShieldCheck, X } from 'lucide-react';
import { loadPlanCatalog, type CommercialPlanRecord } from '../../lib/planRepository';
import { loadMyAccessState, requestAccountActivation, type SaaSAccessState } from '../../lib/saasAccessRepository';
import { useAuth } from '../../context/AuthContext';
import centralGoLogo from '../../assets/images/central-go-logo.svg';

const money = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

export const SaasAccessGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { signOut } = useAuth();
  const [state, setState] = useState<SaaSAccessState | null>(null);
  const [plans, setPlans] = useState<CommercialPlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requesting, setRequesting] = useState<string | null>(null);
  const [requestId, setRequestId] = useState('');
  const [showPlans, setShowPlans] = useState(false);

  const reload = async () => {
    setLoading(true); setError('');
    try {
      const access = await loadMyAccessState();
      setState(access);
      if (access.accountKind === 'central' || access.paymentRequired) {
        try { setPlans(await loadPlanCatalog()); } catch { setPlans([]); }
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'No fue posible validar la suscripción.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, []);

  const trial = state?.allowed && state.status === 'trialing';
  const centralPaywall = state?.accountKind === 'central';
  const trialLabel = useMemo(() => state?.daysRemaining === 1 ? '1 día de prueba' : `${state?.daysRemaining ?? 0} días de prueba`, [state?.daysRemaining]);

  const request = async (plan?: CommercialPlanRecord) => {
    setRequesting(plan?.code ?? 'partner'); setError('');
    try {
      const id = await requestAccountActivation(plan ? { planCode: plan.code, billingCycle: 'annual' } : undefined);
      setRequestId(id);
    } catch (err) { setError(err instanceof Error ? err.message : 'No fue posible registrar la activación.'); }
    finally { setRequesting(null); }
  };

  if (loading) return <main className="min-h-screen bg-zinc-950 text-zinc-200 flex items-center justify-center"><div className="flex items-center gap-3 text-sm font-bold"><Loader2 className="h-5 w-5 animate-spin text-amber-400" />Validando acceso Central GO…</div></main>;
  if (error && !state) return <main className="min-h-screen bg-zinc-950 p-5 text-zinc-100 flex items-center justify-center"><section className="max-w-md rounded-3xl border border-rose-500/30 bg-[#0d0d0f] p-7 text-center"><LockKeyhole className="mx-auto h-8 w-8 text-rose-300" /><h1 className="mt-4 text-xl font-black">No pudimos validar tu acceso</h1><p className="mt-2 text-sm text-zinc-400">{error}</p><button onClick={() => void reload()} className="mt-5 rounded-xl bg-amber-400 px-4 py-3 text-xs font-black text-zinc-950">Reintentar</button></section></main>;

  if (state?.allowed) {
    return <>{children}{trial && <div className="fixed bottom-4 left-1/2 z-[85] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-amber-400/30 bg-zinc-950/95 px-4 py-3 shadow-2xl backdrop-blur-xl"><div className="flex items-center gap-3"><div className="rounded-xl bg-amber-400/10 p-2 text-amber-300"><Clock3 className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="text-xs font-black text-white">Prueba gratis activa · {trialLabel}</p><p className="mt-0.5 text-[9px] text-zinc-500">Tus datos se conservan. Al finalizar necesitarás activar el servicio.</p></div>{state.accountKind === 'central' && <button onClick={() => setShowPlans(true)} className="shrink-0 rounded-xl bg-amber-400 px-3 py-2 text-[10px] font-black text-zinc-950">Ver planes</button>}</div></div>}{showPlans && <PlanOverlay plans={plans} onClose={() => setShowPlans(false)} onChoose={(plan) => void request(plan)} requesting={requesting} requestId={requestId} error={error} />}</>;
  }

  return (
    <main className="min-h-screen bg-[#070709] p-4 text-zinc-100 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><img src={centralGoLogo} alt="Central GO" className="h-11 w-11 rounded-2xl border border-amber-400/50 bg-zinc-950 p-1" /><div><p className="text-[9px] font-black uppercase tracking-widest text-amber-300">Central GO Oficial</p><p className="text-sm font-black text-white">Tu prueba gratuita terminó</p></div></div><button onClick={() => void signOut()} className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-[10px] font-bold text-zinc-400">Cerrar sesión</button></header>

        <section className="mx-auto mt-12 max-w-3xl text-center"><div className="mx-auto inline-flex rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3 text-amber-300"><LockKeyhole className="h-7 w-7" /></div><h1 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">Activa Central GO para continuar</h1><p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">No eliminamos tu información. Tu cuenta, configuración y datos siguen guardados y volverán a estar disponibles cuando se confirme la activación.</p></section>

        {error && <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{error}</div>}
        {requestId && <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-center"><ShieldCheck className="mx-auto h-6 w-6 text-emerald-300" /><p className="mt-2 text-sm font-black text-emerald-200">Solicitud de activación registrada</p><p className="mt-1 text-xs text-zinc-500">Quedará pendiente hasta confirmar el pago. No necesitas volver a registrarte.</p></div>}

        {centralPaywall ? <div className="mt-10 grid gap-4 lg:grid-cols-3">{plans.map((plan) => <PlanCard key={plan.id} plan={plan} busy={requesting===plan.code} disabled={Boolean(requestId)} onChoose={() => void request(plan)} />)}</div> : <section className="mx-auto mt-10 max-w-xl rounded-3xl border border-blue-500/25 bg-[#0d0d0f] p-7 text-center"><Crown className="mx-auto h-8 w-8 text-blue-300" /><h2 className="mt-4 text-xl font-black">Partner Comercial Central GO</h2><p className="mt-2 text-sm leading-relaxed text-zinc-400">Activa tu acceso para seguir registrando centrales, revisar tu cartera, planes y comisiones.</p><button disabled={Boolean(requestId) || requesting==='partner'} onClick={() => void request()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3.5 text-sm font-black text-white disabled:opacity-50">{requesting==='partner'&&<Loader2 className="h-4 w-4 animate-spin" />}Solicitar activación</button></section>}
      </div>
    </main>
  );
};

const PlanOverlay: React.FC<{ plans: CommercialPlanRecord[]; onClose:()=>void; onChoose:(plan:CommercialPlanRecord)=>void; requesting:string|null; requestId:string; error:string }> = ({ plans,onClose,onChoose,requesting,requestId,error }) => <div className="fixed inset-0 z-[95] overflow-y-auto bg-black/85 p-4 backdrop-blur-md"><div className="mx-auto my-6 max-w-6xl rounded-3xl border border-zinc-800 bg-[#0b0b0d] p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Elige con tiempo</p><h2 className="mt-1 text-2xl font-black text-white">Planes Central GO</h2><p className="mt-1 text-xs text-zinc-500">Tu prueba sigue activa hasta la fecha indicada.</p></div><button onClick={onClose} className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400"><X className="h-4 w-4" /></button></div>{error&&<div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}{requestId&&<div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-200">Solicitud registrada.</div>}<div className="mt-6 grid gap-4 lg:grid-cols-3">{plans.map((plan)=><PlanCard key={plan.id} plan={plan} busy={requesting===plan.code} disabled={Boolean(requestId)} onChoose={()=>onChoose(plan)} />)}</div></div></div>;

const PlanCard: React.FC<{ plan:CommercialPlanRecord; busy:boolean; disabled:boolean; onChoose:()=>void }> = ({ plan,busy,disabled,onChoose }) => {
  const rows = [
    ['Despacho + mapa',plan.features.dispatch_map],['App conductor',plan.features.driver_app],['GPS en vivo',plan.features.live_gps],['Reportes avanzados',plan.features.advanced_reports],['Múltiples sedes',plan.features.multi_branch],['API / integraciones',plan.features.api_integrations],['Soporte prioritario',plan.features.priority_support],
  ] as const;
  return <article className={`relative rounded-3xl border p-5 ${plan.recommended?'border-amber-400/55 bg-amber-400/[0.055] shadow-xl shadow-amber-500/5':'border-zinc-800 bg-[#0d0d0f]'}`}>{plan.recommended&&<span className="absolute -top-3 left-5 rounded-full bg-amber-400 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-zinc-950">Recomendado</span>}<p className="text-lg font-black text-white">{plan.name}</p><p className="mt-1 min-h-[34px] text-[10px] leading-relaxed text-zinc-500">{plan.features.sales_highlight || plan.features.description}</p><div className="mt-4"><span className="text-2xl font-black text-white">{money(plan.annualMonthlyPrice)}</span><span className="text-[10px] text-zinc-500"> /mes equivalente</span><p className="mt-1 text-[9px] text-zinc-600">Facturación anual {money(plan.annualPrice)}</p></div><div className="mt-5 space-y-2 border-y border-zinc-800 py-4">{rows.map(([label,enabled])=><div key={label} className={`flex items-center gap-2 text-[10px] font-bold ${enabled?'text-zinc-300':'text-zinc-600'}`}>{enabled?<Check className="h-3.5 w-3.5 text-emerald-400" />:<X className="h-3.5 w-3.5 text-rose-400" />}{label}</div>)}</div><button onClick={onChoose} disabled={disabled||busy} className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black disabled:opacity-40 ${plan.recommended?'bg-amber-400 text-zinc-950':'bg-zinc-800 text-white hover:bg-zinc-700'}`}>{busy&&<Loader2 className="h-4 w-4 animate-spin" />}{disabled?'Solicitud pendiente':`Elegir ${plan.name}`}</button></article>;
};
