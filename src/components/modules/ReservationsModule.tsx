import React from 'react';
import { CalendarClock, Info } from 'lucide-react';
import { ScheduledTripsStrip } from './ScheduledTripsStrip';

export const ReservationsModule: React.FC = () => (
  <div className="space-y-4 pb-6">
    <section className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/[0.09] to-blue-500/[0.03] p-4 shadow-xl shadow-black/10 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-sky-500/25 bg-sky-500/10 text-sky-300">
          <CalendarClock className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[.18em] text-sky-400">Central GO · Operación</p>
          <h1 className="mt-1 text-xl font-black text-white sm:text-2xl">Reservas programadas</h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-400">Administra aquí las carreras futuras. Permanecen separadas del despacho diario y aparecen en la central solamente cuando entran en su ventana operativa.</p>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-950/45 px-3 py-2.5 text-[10px] leading-relaxed text-zinc-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
        <span>Editar, repetir, cancelar o reservar un móvil no tapa la pantalla de carreras ni la central de despacho.</span>
      </div>
    </section>
    <ScheduledTripsStrip />
  </div>
);
