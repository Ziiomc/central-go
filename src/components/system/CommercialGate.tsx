import React from 'react';
import { commercialBlockers, runtimeConfig } from '../../config/runtime';

export const CommercialGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  if (!runtimeConfig.commercialReady) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <section className="w-full max-w-2xl rounded-3xl border border-amber-400/30 bg-[#0d0d0f] p-7 shadow-2xl">
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">Protección de producción activa</span>
          <h1 className="mt-4 text-2xl font-black">Central GO oficial requiere backend seguro</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">La plataforma ya no dispone de un modo demo operativo. Si falta una variable de infraestructura, se bloquea el acceso antes de permitir carreras, usuarios o GPS sin persistencia real.</p>
          <ul className="mt-5 space-y-2">{commercialBlockers.map((item) => <li key={item} className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3 text-sm text-zinc-300">• {item}</li>)}</ul>
        </section>
      </main>
    );
  }
  return <>{children}</>;
};
