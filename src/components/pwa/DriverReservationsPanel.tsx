import React, { useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, ChevronUp, MapPin, Phone, UserRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const formatReservation = (iso: string) => new Date(iso).toLocaleString('es-CL', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export const DriverReservationsPanel: React.FC = () => {
  const { trips, drivers, currentUser } = useApp();
  const [expanded, setExpanded] = useState(false);
  const driver = drivers.find((item) => item.userId === currentUser.id);
  const reservations = useMemo(() => driver ? trips
    .filter((trip) => Boolean(trip.scheduledFor))
    .filter((trip) => trip.status === 'pending')
    .filter((trip) => trip.reservedDriverId === driver.id)
    .filter((trip) => new Date(trip.scheduledFor!).getTime() > Date.now() - 30 * 60 * 1000)
    .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime()) : [], [driver?.id, trips]);

  if (!driver || reservations.length === 0) return null;
  const visible = expanded ? reservations.slice(0, 4) : reservations.slice(0, 1);

  return (
    <div className="pointer-events-none fixed inset-x-3 top-[4.6rem] z-[92] flex justify-center">
      <section className="pointer-events-auto w-full max-w-lg overflow-hidden rounded-2xl border border-sky-300/30 bg-[#07131d]/96 text-white shadow-2xl shadow-black/55 backdrop-blur-xl">
        <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-400/10 text-sky-200"><CalendarClock className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[9px] font-black uppercase tracking-[.16em] text-sky-300">Próxima reserva</span>
            <span className="mt-0.5 block truncate text-xs font-black">{formatReservation(reservations[0].scheduledFor!)} · {reservations[0].origin.address}</span>
          </span>
          <span className="rounded-full bg-sky-400/10 px-2 py-1 text-[9px] font-black text-sky-200">{reservations.length}</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
        </button>
        {expanded && <div className="max-h-[48vh] divide-y divide-white/10 overflow-y-auto border-t border-white/10">
          {visible.map((trip) => <article key={trip.id} className="space-y-1.5 px-3 py-3">
            <div className="flex items-center justify-between gap-2"><strong className="text-xs text-sky-100">{formatReservation(trip.scheduledFor!)}</strong><span className="text-[9px] font-black text-zinc-500">{trip.code}</span></div>
            <p className="flex items-start gap-1.5 text-[11px] text-zinc-200"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" /><span><strong>{trip.origin.address}</strong>{trip.destination.address ? ` → ${trip.destination.address}` : ''}</span></p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-400"><span className="flex items-center gap-1"><UserRound className="h-3 w-3" />{trip.clientName}</span>{trip.clientPhone && trip.clientPhone !== 'Sin teléfono' && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{trip.clientPhone}</span>}</div>
          </article>)}
        </div>}
      </section>
    </div>
  );
};
