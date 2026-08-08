import React, { useMemo, useState } from 'react';
import { Building2, Check, ChevronLeft, ChevronRight, Globe2, UserRound, X, Zap } from 'lucide-react';
import { EmptySuccess, money } from './NetworkUi';
import { NetworkCentral } from '../../data/networkMockData';

interface CentralRegistrationModalProps {
  open: boolean;
  onClose: () => void;
  onCreate?: (central: NetworkCentral) => void;
}

const steps = [
  { id: 1, title: 'Central', detail: 'Identidad y ubicación', icon: Building2 },
  { id: 2, title: 'Responsable', detail: 'Propietario y contacto', icon: UserRound },
  { id: 3, title: 'Plan y partner', detail: 'Suscripción y atribución', icon: Globe2 },
];

const plans = [
  { name: 'Start' as const, monthlyPrice: 149000, annualMonthlyPrice: 59000, detail: 'Solo 10 móviles · sin app de conductores' },
  { name: 'Pro' as const, monthlyPrice: 219000, annualMonthlyPrice: 99000, detail: 'Hasta 50 móviles · app para conductores' },
  { name: 'Enterprise' as const, monthlyPrice: 289000, annualMonthlyPrice: 149000, detail: 'Flota ilimitada · soporte y expansión' },
];

export const CentralRegistrationModal: React.FC<CentralRegistrationModalProps> = ({ open, onClose, onCreate }) => {
  const [step, setStep] = useState(1);
  const [finished, setFinished] = useState(false);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');
  const [form, setForm] = useState({
    name: '', country: 'Chile', region: '', city: '', owner: '', phone: '', email: '', vehicles: '20', plan: 'Enterprise' as NetworkCentral['plan'], partner: 'Ignacio Varas', regionalPartner: 'María Paz Herrera',
  });

  const selectedPlan = useMemo(() => plans.find((p) => p.name === form.plan) || plans[2], [form.plan]);
  const selectedMonthlyPrice = billing === 'annual' ? selectedPlan.annualMonthlyPrice : selectedPlan.monthlyPrice;
  const selectedBillingAmount = billing === 'annual' ? selectedMonthlyPrice * 12 : selectedMonthlyPrice;

  if (!open) return null;

  const update = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const canContinue = step === 1 ? form.name && form.region && form.city : step === 2 ? form.owner && form.phone && form.email : true;

  const resetAndClose = () => {
    setStep(1);
    setBilling('annual');
    setFinished(false);
    onClose();
  };

  const submit = () => {
    const created: NetworkCentral = {
      id: `net-demo-${Date.now()}`,
      name: form.name || 'Nueva Central Demo',
      country: form.country,
      countryCode: form.country === 'Chile' ? 'CL' : form.country === 'Argentina' ? 'AR' : form.country === 'México' ? 'MX' : form.country === 'Perú' ? 'PE' : form.country === 'España' ? 'ES' : 'EC',
      region: form.region,
      city: form.city,
      owner: form.owner,
      phone: form.phone,
      email: form.email,
      vehicles: Number(form.vehicles) || 0,
      operators: 1,
      plan: form.plan,
      monthlyFee: selectedMonthlyPrice,
      status: 'trial',
      partner: form.partner,
      regionalPartner: form.regionalPartner,
      joinedAt: new Date().toISOString().slice(0, 10),
      nextBillingAt: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      activityScore: 15,
    };
    onCreate?.(created);
    setFinished(true);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-[#0d0d0f] border border-zinc-700 rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-zinc-800 flex items-start justify-between gap-4 bg-gradient-to-r from-purple-950/35 via-[#0d0d0f] to-blue-950/25">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] font-black uppercase tracking-widest text-purple-300 mb-2">
              <Zap className="w-3 h-3" /> Alta multitenant
            </div>
            <h2 className="text-xl font-black text-white">Registrar una nueva central</h2>
            <p className="text-xs text-zinc-400 mt-1">Vista preliminar del flujo que usará el superadmin y la red de partners.</p>
          </div>
          <button onClick={resetAndClose} className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {!finished ? (
          <>
            <div className="grid grid-cols-3 border-b border-zinc-800 bg-zinc-950/50">
              {steps.map(({ id, title, detail, icon: Icon }) => (
                <div key={id} className={`p-4 flex gap-3 items-center border-r last:border-r-0 border-zinc-800 ${step === id ? 'bg-blue-500/5' : ''}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${step > id ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : step === id ? 'bg-blue-500/10 text-blue-300 border-blue-500/30' : 'bg-zinc-900 text-zinc-600 border-zinc-800'}`}>
                    {step > id ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <div className="hidden sm:block">
                    <p className={`text-[11px] font-extrabold ${step === id ? 'text-white' : 'text-zinc-500'}`}>{title}</p>
                    <p className="text-[9px] text-zinc-600">{detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 min-h-[355px]">
              {step === 1 && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Nombre comercial" value={form.name} onChange={(v) => update('name', v)} placeholder="Ej. Radio Taxi Los Andes" className="sm:col-span-2" />
                  <SelectField label="País" value={form.country} onChange={(v) => update('country', v)} options={['Chile', 'Argentina', 'Perú', 'México', 'España', 'Ecuador']} />
                  <Field label="Región / Estado" value={form.region} onChange={(v) => update('region', v)} placeholder="Ej. Región del Maule" />
                  <Field label="Ciudad" value={form.city} onChange={(v) => update('city', v)} placeholder="Ej. Linares" />
                  <Field label="Móviles estimados" type="number" value={form.vehicles} onChange={(v) => update('vehicles', v)} placeholder="20" />
                  <div className="sm:col-span-2 p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 text-[11px] text-blue-200/80 leading-relaxed">
                    Cada central tendrá un espacio independiente. Sus conductores, carreras y clientes no serán visibles para otras empresas.
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Nombre del propietario" value={form.owner} onChange={(v) => update('owner', v)} placeholder="Nombre completo" className="sm:col-span-2" />
                  <Field label="Teléfono / WhatsApp" value={form.phone} onChange={(v) => update('phone', v)} placeholder="+56 9 1234 5678" />
                  <Field label="Correo electrónico" type="email" value={form.email} onChange={(v) => update('email', v)} placeholder="administracion@central.com" />
                  <div className="sm:col-span-2 grid sm:grid-cols-3 gap-3 mt-1">
                    {['Acceso administrador', 'Prueba por 14 días', 'Capacitación inicial'].map((item) => (
                      <div key={item} className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center gap-2 text-[10px] text-zinc-300"><Check className="w-3.5 h-3.5 text-emerald-400" />{item}</div>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Plan y modalidad de pago</p>
                        <p className="text-[10px] text-emerald-400 mt-1">El anual mantiene los valores de lanzamiento y se selecciona por defecto.</p>
                      </div>
                      <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
                        <button onClick={() => setBilling('monthly')} className={`rounded-lg px-3 py-2 text-[10px] font-black ${billing === 'monthly' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>Mensual</button>
                        <button onClick={() => setBilling('annual')} className={`rounded-lg px-3 py-2 text-[10px] font-black ${billing === 'annual' ? 'bg-emerald-500 text-slate-950' : 'text-emerald-400'}`}>Anual recomendado</button>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {plans.map((plan) => {
                        const unavailable = plan.name === 'Start' && Number(form.vehicles) > 10;
                        const displayPrice = billing === 'annual' ? plan.annualMonthlyPrice : plan.monthlyPrice;
                        const annualTotal = plan.annualMonthlyPrice * 12;
                        const recommended = plan.name === 'Enterprise';
                        return (
                          <button
                            key={plan.name}
                            disabled={unavailable}
                            onClick={() => update('plan', plan.name)}
                            className={`relative text-left p-4 rounded-2xl border transition disabled:cursor-not-allowed disabled:opacity-40 ${form.plan === plan.name ? recommended ? 'bg-purple-500/10 border-purple-400/50 ring-1 ring-purple-500/25' : 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20' : 'bg-zinc-950/50 border-zinc-800 hover:border-zinc-700'} ${recommended ? 'shadow-lg shadow-purple-950/20' : ''}`}
                          >
                            {recommended && <span className="absolute -top-2 right-3 rounded-full bg-purple-500 px-2 py-0.5 text-[8px] font-black uppercase text-white">Recomendado</span>}
                            <div className="flex items-center justify-between"><p className="text-xs font-black text-white">{plan.name}</p>{form.plan === plan.name && <Check className={`w-4 h-4 ${recommended ? 'text-purple-300' : 'text-amber-300'}`} />}</div>
                            {billing === 'annual' && <p className="mt-2 text-[9px] text-zinc-600 line-through">{money(plan.monthlyPrice)} mensual</p>}
                            <p className={`text-xl font-black mt-1 ${recommended ? 'text-purple-300' : 'text-amber-300'}`}>{money(displayPrice)}<span className="text-[9px] font-bold text-zinc-500"> / mes</span></p>
                            <p className="text-[10px] text-zinc-500 mt-1">{plan.detail}</p>
                            {billing === 'annual' && <p className="text-[9px] font-bold text-emerald-400 mt-2">Total anual: {money(annualTotal)}</p>}
                            {unavailable && <p className="text-[9px] font-bold text-red-400 mt-2">No disponible para {form.vehicles} móviles</p>}
                          </button>
                        );
                      })}
                    </div>
                    {form.plan === 'Start' && (
                      <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-[10px] leading-relaxed text-blue-200/80">
                        Start queda limitado a 10 móviles, historial de 60 días, sin aplicación para conductores y con soporte solo por correo.
                      </div>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <SelectField label="Partner comercial atribuido" value={form.partner} onChange={(v) => update('partner', v)} options={['Ignacio Varas', 'Luciano Ferreyra', 'Camila Rojas', 'Lucía Martín']} />
                    <SelectField label="Responsable regional" value={form.regionalPartner} onChange={(v) => update('regionalPartner', v)} options={['María Paz Herrera', 'Valentina Núñez', 'Renzo Medina', 'Paola Hernández']} />
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20">
                    <Summary label={billing === 'annual' ? 'Cobro anual' : 'Cobro mensual'} value={money(selectedBillingAmount)} />
                    <Summary label="Partner directo (20%)" value={money(selectedBillingAmount * 0.2)} />
                    <Summary label="Regional (5%)" value={money(selectedBillingAmount * 0.05)} />
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-zinc-800 flex items-center justify-between bg-zinc-950/35">
              <button disabled={step === 1} onClick={() => setStep((s) => s - 1)} className="px-4 py-2 rounded-xl border border-zinc-800 text-xs font-bold text-zinc-300 disabled:opacity-30 flex items-center gap-1.5"><ChevronLeft className="w-4 h-4" />Atrás</button>
              {step < 3 ? (
                <button disabled={!canContinue} onClick={() => setStep((s) => s + 1)} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-xs font-black text-white flex items-center gap-1.5 shadow-lg shadow-blue-950/50">Continuar<ChevronRight className="w-4 h-4" /></button>
              ) : (
                <button onClick={submit} className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-black text-slate-950 flex items-center gap-2 shadow-lg shadow-amber-950/50"><Zap className="w-4 h-4" />Crear central en prueba</button>
              )}
            </div>
          </>
        ) : (
          <div className="p-8"><EmptySuccess title="Central registrada correctamente" detail={`${form.name || 'La nueva central'} quedó creada en modo prueba. En la versión funcional se enviarán accesos por correo y quedará atribuida automáticamente a ${form.partner}.`} onClose={resetAndClose} /></div>
        )}
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; className?: string }> = ({ label, value, onChange, placeholder, type = 'text', className = '' }) => (
  <label className={`space-y-1.5 ${className}`}>
    <span className="text-[10px] uppercase tracking-widest font-extrabold text-zinc-500">{label}</span>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3.5 py-3 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/10 outline-none text-xs text-white placeholder:text-zinc-700" />
  </label>
);

const SelectField: React.FC<{ label: string; value: string; onChange: (value: string) => void; options: string[] }> = ({ label, value, onChange, options }) => (
  <label className="space-y-1.5">
    <span className="text-[10px] uppercase tracking-widest font-extrabold text-zinc-500">{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3.5 py-3 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-blue-500/60 outline-none text-xs text-white">
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  </label>
);

const Summary: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div><p className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">{label}</p><p className="text-sm font-black text-white mt-1">{value}</p></div>
);
