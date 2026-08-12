import React, { useMemo } from 'react';
import { CalendarClock, ChevronRight, Clock3, MapPin, Sparkles, UserRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const formatSchedule = (iso: string) => new Date(iso).toLocaleString('es-CL', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export const ScheduledTripsStrip: React.FC = () => {
  const { trips, setSelectedTripForDetail } = useApp();
  const scheduled = useMemo(() => trips
    .filter((trip) => Boolean(trip.scheduledFor) && !['completed', 'cancelled'].includes(trip.status))
    .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime()), [trips]);

  if (!scheduled.length) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-500/[0.07] via-[#0d0d0f] to-[#0d0d0f] shadow-xl shadow-black/20">
      <div className="flex items-center justify-between gap-3 border-b border-blue-500/10 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-lg bg-blue-500/10 p-1.5 text-blue-300"><CalendarClock className="h-4 w-4" /></div>
          <div className="min-w-0">
            <h2 className="text-xs font-black text-white">Carreras agendadas</h2>
            <p className="truncate text-[9px] text-zinc-500">Central GO las despacha automáticamente cerca de la hora programada.</p>
          </div>
        </div>
        <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[9px] font-black text-blue-300">{scheduled.length}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto p-2.5">
        {scheduled.slice(0, 10).map((trip) => (
          <button
            key={trip.id}
            type="button"
            onClick={() => setSelectedTripForDetail(trip)}
            className="min-w-[260px] max-w-[330px] flex-1 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 text-left transition hover:border-blue-500/40 hover:bg-zinc-950"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-300"><Clock3 className="h-3.5 w-3.5" />{formatSchedule(trip.scheduledFor!)}</div>
              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
            </div>
            <p className="mt-2 flex items-center gap-1.5 truncate text-[10px] font-bold text-zinc-200"><UserRound className="h-3.5 w-3.5 shrink-0 text-zinc-500" />{trip.clientName}</p>
            <p className="mt-1 flex items-center gap-1.5 truncate text-[9px] text-zinc-500"><MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400" />{trip.origin.address}</p>
            {trip.driverUnitNumber ? (
              <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] px-2 py-1.5 text-[9px] font-black text-emerald-300">Oferta enviada a {trip.driverUnitNumber}</div>
            ) : trip.reservedDriverUnitNumber ? (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/[0.07] px-2 py-1.5 text-[9px] font-black text-violet-300"><Sparkles className="h-3.5 w-3.5" />Próximo móvil: {trip.reservedDriverUnitNumber} · predictivo</div>
            ) : (
              <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2 py-1.5 text-[9px] font-bold text-zinc-500">Esperando ventana de despacho automático</div>
            )}
          </button>
        ))}
      </div>
    </section>
  );
};
