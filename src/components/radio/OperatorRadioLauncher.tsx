import React, { useMemo, useState } from 'react';
import { Radio, RadioTower, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Driver } from '../../types';

export const OperatorRadioLauncher: React.FC = () => {
  const { currentRole, currentCompany, drivers, setVHFModalDriver } = useApp();
  const [open, setOpen] = useState(false);

  const allowed = ['operator', 'company_admin', 'super_admin'].includes(currentRole) && currentCompany.id !== 'network';
  const radioDrivers = useMemo(() => drivers
    .filter((driver) => driver.status !== 'offline')
    .sort((a, b) => {
      const aOrder = Number((a as Driver & { dispatchQueueOrder?: number }).dispatchQueueOrder ?? Number.MAX_SAFE_INTEGER);
      const bOrder = Number((b as Driver & { dispatchQueueOrder?: number }).dispatchQueueOrder ?? Number.MAX_SAFE_INTEGER);
      return aOrder - bOrder || a.unitNumber.localeCompare(b.unitNumber, 'es', { numeric: true });
    }), [drivers]);

  if (!allowed) return null;

  const openDriver = (driver: Driver) => {
    setOpen(false);
    setVHFModalDriver(driver);
  };

  return (
    <div className="fixed bottom-4 left-4 z-[115] flex flex-col items-start gap-2">
      {open && (
        <section className="w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#08131d]/95 shadow-2xl shadow-black/70 backdrop-blur-xl">
          <header className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200"><RadioTower className="h-4 w-4" /></span>
              <div><p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-300">Central → móvil</p><p className="text-xs font-black text-white">Mensajes de radio</p></div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-white/10 hover:text-white" aria-label="Cerrar radio"><X className="h-4 w-4" /></button>
          </header>
          <div className="max-h-[52vh] overflow-y-auto p-2">
            {radioDrivers.length === 0 ? <p className="px-3 py-6 text-center text-xs text-zinc-500">No hay móviles conectados.</p> : radioDrivers.map((driver) => (
              <button key={driver.id} type="button" onClick={() => openDriver(driver)} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition hover:bg-cyan-400/[.08]">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-xs font-black text-cyan-200">{driver.unitNumber}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-black text-white">{driver.name}</span><span className="block truncate text-[9px] text-zinc-500">{driver.operationMode === 'traditional' ? 'Radio tradicional' : 'App'} · {driver.status}</span></span>
                <Radio className="h-4 w-4 shrink-0 text-cyan-300" />
              </button>
            ))}
          </div>
        </section>
      )}

      <button type="button" onClick={() => setOpen((value) => !value)} className="flex h-12 items-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-300 px-4 text-xs font-black text-slate-950 shadow-xl shadow-black/40 transition active:scale-[.98]" aria-expanded={open} title="Abrir mensajes de radio">
        <RadioTower className="h-4 w-4" />
        Mensajes de radio
      </button>
    </div>
  );
};
