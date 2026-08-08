import React, { useState } from 'react';
import { Check, CircleDollarSign, Crown, Globe2, Layers3, Plus, Settings2, Sparkles, X, Zap } from 'lucide-react';
import { money, NetworkKpi } from '../network/NetworkUi';

type PlanFeature = { label: string; included: boolean };

type CommercialPlan = {
  name: 'Start' | 'Pro' | 'Enterprise';
  monthlyPrice: number;
  annualMonthlyPrice: number;
  color: 'blue' | 'amber' | 'purple';
  description: string;
  features: PlanFeature[];
  centrals: number;
  recommended?: boolean;
};

const plans: CommercialPlan[] = [
  {
    name: 'Start',
    monthlyPrice: 149000,
    annualMonthlyPrice: 59000,
    color: 'blue',
    description: 'Una entrada controlada para centrales pequeñas que solo necesitan digitalizar el despacho básico.',
    features: [
      { label: 'Máximo exacto de 10 móviles', included: true },
      { label: 'Hasta 2 operadoras', included: true },
      { label: 'Despacho y mapa operacional', included: true },
      { label: 'Historial por 60 días', included: true },
      { label: 'Aplicación para conductores', included: false },
      { label: 'Soporte únicamente por correo', included: true },
    ],
    centrals: 9,
  },
  {
    name: 'Pro',
    monthlyPrice: 219000,
    annualMonthlyPrice: 99000,
    color: 'amber',
    description: 'La alternativa equilibrada para centrales que necesitan operar, medir y coordinar a sus conductores.',
    features: [
      { label: 'Hasta 50 móviles', included: true },
      { label: 'Operadoras ilimitadas', included: true },
      { label: 'Reportes, clientes e historial completo', included: true },
      { label: 'PWA para conductores', included: true },
      { label: 'Soporte prioritario', included: true },
      { label: 'Una sede operacional', included: true },
    ],
    centrals: 18,
  },
  {
    name: 'Enterprise',
    monthlyPrice: 289000,
    annualMonthlyPrice: 149000,
    color: 'purple',
    description: 'La mejor inversión para crecer: control total, múltiples sedes y acompañamiento comercial y técnico.',
    features: [
      { label: 'Flota y operadoras ilimitadas', included: true },
      { label: 'Múltiples sucursales y ciudades', included: true },
      { label: 'Aplicación para conductores y GPS avanzado', included: true },
      { label: 'API e integraciones', included: true },
      { label: 'Onboarding y SLA preferente', included: true },
      { label: 'Ejecutivo regional asignado', included: true },
    ],
    centrals: 11,
    recommended: true,
  },
];

export const PlansNetworkModule: React.FC = () => {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-300 mb-2">
            <Layers3 className="w-3.5 h-3.5" />Oferta comercial
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Planes y suscripciones</h1>
          <p className="text-xs text-zinc-400 mt-1">El anual conserva los valores de lanzamiento y convierte Enterprise en la oferta de mayor valor.</p>
        </div>
        <button className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-200 flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-300" />Crear plan personalizado
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <NetworkKpi label="Planes activos" value="3" detail="Start, Pro y Enterprise" icon={Layers3} accent="blue" />
        <NetworkKpi label="Precio medio mensual" value={money(219000)} detail="Referencia de lista en Chile" icon={CircleDollarSign} accent="emerald" />
        <NetworkKpi label="Plan recomendado" value="Enterprise" detail="Mayor valor percibido en anual" icon={Crown} accent="purple" />
        <NetworkKpi label="Mercados configurados" value="6" detail="Precio y moneda por país" icon={Globe2} accent="amber" />
      </div>

      <section className="bg-[#0d0d0f] border border-zinc-800 rounded-3xl p-5 md:p-7 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-white">Catálogo principal</h2>
            <p className="text-xs text-zinc-500 mt-1">Precios de referencia en CLP. El anual se factura por 12 meses y mantiene el precio de lanzamiento.</p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
            <button onClick={() => setBilling('monthly')} className={`px-3.5 py-2 rounded-lg text-[10px] font-black transition ${billing === 'monthly' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              Mensual
            </button>
            <button onClick={() => setBilling('annual')} className={`px-3.5 py-2 rounded-lg text-[10px] font-black transition ${billing === 'annual' ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-950/30' : 'text-emerald-400 hover:text-emerald-300'}`}>
              Anual · mejor precio
            </button>
          </div>
        </div>

        {billing === 'annual' && (
          <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-black text-emerald-200"><Sparkles className="h-4 w-4" />Oferta anual de lanzamiento</div>
            <p className="text-[11px] text-emerald-300/80">La central asegura 12 meses al mejor valor y obtiene hasta 60% de ahorro.</p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-5 mt-7">
          {plans.map((plan) => {
            const price = billing === 'annual' ? plan.annualMonthlyPrice : plan.monthlyPrice;
            const annualTotal = plan.annualMonthlyPrice * 12;
            const annualSavings = (plan.monthlyPrice - plan.annualMonthlyPrice) * 12;
            const discount = Math.round((1 - plan.annualMonthlyPrice / plan.monthlyPrice) * 100);
            const tone = plan.recommended
              ? 'border-purple-400/60 bg-gradient-to-b from-purple-500/12 to-purple-500/5 ring-2 ring-purple-500/15'
              : plan.color === 'amber'
                ? 'border-amber-500/35 bg-amber-500/5'
                : 'border-blue-500/25 bg-blue-500/5';
            const button = plan.recommended
              ? 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white hover:from-purple-400 hover:to-fuchsia-400'
              : plan.color === 'amber'
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-blue-600 text-white hover:bg-blue-500';

            return (
              <article key={plan.name} className={`relative rounded-3xl border p-6 transition ${tone} ${plan.recommended ? 'lg:-translate-y-3 shadow-2xl shadow-purple-950/35' : ''}`}>
                {plan.recommended && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white text-[9px] font-black uppercase tracking-widest shadow-lg">
                    Mejor inversión anual
                  </span>
                )}

                <div className="flex items-center justify-between">
                  <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${plan.color === 'amber' ? 'bg-amber-500/10 border-amber-500/25 text-amber-300' : plan.color === 'purple' ? 'bg-purple-500/10 border-purple-500/25 text-purple-300' : 'bg-blue-500/10 border-blue-500/25 text-blue-300'}`}>
                    {plan.recommended ? <Crown className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                  </div>
                  <span className="text-[9px] text-zinc-500 font-black uppercase">{plan.centrals} centrales</span>
                </div>

                <h3 className="text-xl font-black text-white mt-5">{plan.name}</h3>
                <p className="text-[11px] text-zinc-400 mt-2 min-h-[52px] leading-relaxed">{plan.description}</p>

                <div className="mt-5 min-h-[102px]">
                  {billing === 'annual' && <p className="text-[10px] text-zinc-500 line-through mb-1">Precio mensual: {money(plan.monthlyPrice)}</p>}
                  <div><span className="text-3xl font-black text-white">{money(price)}</span><span className="text-[10px] text-zinc-500"> / mes</span></div>
                  {billing === 'annual' ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] font-black text-emerald-400">Ahorra {discount}% · {money(annualSavings)} al año</p>
                      <p className="text-[9px] text-zinc-500">Facturación anual: {money(annualTotal)}</p>
                    </div>
                  ) : (
                    <p className="text-[9px] text-zinc-500 mt-2">Pago mes a mes, sin precio anual protegido.</p>
                  )}
                </div>

                <button className={`w-full mt-5 py-3 rounded-xl text-xs font-black transition shadow-lg ${button}`}>
                  {billing === 'annual' ? (plan.recommended ? 'Promover Enterprise anual' : 'Configurar oferta anual') : 'Editar configuración'}
                </button>

                <div className="mt-5 pt-5 border-t border-zinc-800/80 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature.label} className={`flex items-center gap-2 text-[10px] ${feature.included ? 'text-zinc-300' : 'text-zinc-600'}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${feature.included ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/8 text-red-400/70'}`}>
                        {feature.included ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      </div>
                      <span className={feature.included ? '' : 'line-through decoration-zinc-700'}>{feature.label}</span>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-5">
        <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300"><Globe2 className="w-5 h-5" /></div>
            <div><h2 className="text-sm font-black text-white">Precios por mercado</h2><p className="text-[10px] text-zinc-500">Moneda, impuestos y métodos de pago.</p></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
            {[['Chile', 'CLP'], ['Argentina', 'ARS'], ['México', 'MXN'], ['Perú', 'PEN'], ['España', 'EUR'], ['Ecuador', 'USD']].map(([country, currency]) => (
              <div key={country} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><p className="text-[10px] font-bold text-zinc-300">{country}</p><p className="text-[9px] text-zinc-600 mt-1">{currency} · Configurado</p></div>
            ))}
          </div>
        </section>

        <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300"><Settings2 className="w-5 h-5" /></div>
            <div><h2 className="text-sm font-black text-white">Reglas comerciales</h2><p className="text-[10px] text-zinc-500">Parámetros que conectaremos en la etapa funcional.</p></div>
          </div>
          <div className="space-y-3 mt-5">
            {[['Prueba gratuita', '14 días'], ['Tolerancia de pago', '5 días'], ['Garantía comisión', '7 días'], ['Ahorro anual', 'Hasta 60%']].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800"><span className="text-[10px] text-zinc-500">{label}</span><span className="text-xs font-black text-white">{value}</span></div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
