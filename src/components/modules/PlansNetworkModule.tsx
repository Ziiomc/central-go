import React from 'react';
import { Layers3, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PlanComparison } from '../network/PlanComparison';
import { SubscriptionsAdminPanel } from '../network/SubscriptionsAdminPanel';

export const PlansNetworkModule: React.FC = () => {
  const { currentRole } = useApp();
  const isSuper = currentRole === 'super_admin';
  const partnerView = currentRole === 'regional_partner' || currentRole === 'sales_partner';

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-300 mb-2">
            <Layers3 className="w-3.5 h-3.5" /> {isSuper ? 'Gestión comercial y facturación' : 'Oferta comercial oficial'}
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">{isSuper ? 'Planes y suscripciones' : 'Planes y valores Central GO'}</h1>
          <p className="text-xs text-zinc-400 mt-1">{isSuper ? 'Administra activaciones, modalidades de pago y ofertas especiales sin modificar los precios oficiales para el resto de la red.' : 'Los valores y capacidades se leen directamente desde Supabase; no son cifras de demostración.'}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[10px] font-black text-emerald-300">
          <ShieldCheck className="h-4 w-4" /> Catálogo sincronizado
        </div>
      </div>

      {isSuper && <SubscriptionsAdminPanel />}

      <PlanComparison
        salesMode={partnerView}
        title={partnerView ? 'Tabla de valores para presentar al cliente' : 'Catálogo comercial oficial'}
        subtitle={partnerView
          ? 'Úsala durante la reunión: muestra claramente qué incluye cada versión, qué queda fuera y por qué Enterprise evita límites futuros.'
          : isSuper
            ? 'Estos son los valores base. Las ofertas individuales se administran arriba y no alteran este catálogo.'
            : 'Comparación única de precios, límites y funciones disponibles en cada plan.'}
      />
    </div>
  );
};
