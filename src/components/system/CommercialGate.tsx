import React from 'react';
import { commercialBlockers, runtimeConfig } from '../../config/runtime';

export const CommercialGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  if (runtimeConfig.isCommercial && !runtimeConfig.commercialReady) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <section className="w-full max-w-2xl rounded-3xl border border-amber-400/30 bg-[#0d0d0f] p-7 shadow-2xl">
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">Protección de producción activa</span>
          <h1 className="mt-4 text-2xl font-black">Central GO no abrirá datos demo como si fueran datos comerciales</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">El modo comercial fue solicitado, pero todavía falta infraestructura obligatoria. La aplicación queda bloqueada de forma intencional para evitar carreras, usuarios o GPS ficticios en una central real.</p>
          <ul className="mt-5 space-y-2">
            {commercialBlockers.map((item) => <li key={item} className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3 text-sm text-zinc-300">• {item}</li>)}
          </ul>
        </section>
      </main>
    );
  }

  return (
    <>
      {runtimeConfig.isDemo && (
        <div className="fixed bottom-3 left-3 z-[120] rounded-full border border-amber-400/30 bg-zinc-950/95 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-amber-300 shadow-xl backdrop-blur">
          Entorno demo · sin persistencia comercial
        </div>
      )}
      {children}
    </>
  );
};
