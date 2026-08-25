import React, { useMemo, useState, useEffect, useRef } from 'react';
import { CalendarClock, ChevronRight, Clock3, MapPin, Radio, Sparkles, UserRound, Zap } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { soundManager } from '../../lib/audio';

const formatSchedule = (iso: string) => new Date(iso).toLocaleString('es-CL', { weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit' });
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('es-CL', { hour:'2-digit',minute:'2-digit' });
const minutesUntil = (iso: string, now: number) => Math.ceil((new Date(iso).getTime() - now) / 60000);

export const ScheduledTripsStrip: React.FC = () => {
  const { trips, setSelectedTripForDetail, addNotification, soundMuted } = useApp();
  const [now, setNow] = useState(Date.now());
  const lastAlertMinuteRef = useRef<Map<string, number>>(new Map());

  useEffect(() => { const timer=window.setInterval(()=>setNow(Date.now()),15000); return()=>window.clearInterval(timer); }, []);
  const scheduled=useMemo(()=>trips.filter(t=>Boolean(t.scheduledFor)&&!['completed','cancelled'].includes(t.status)).sort((a,b)=>new Date(a.scheduledFor!).getTime()-new Date(b.scheduledFor!).getTime()),[trips]);
  const waitingReservations=useMemo(()=>scheduled.filter(t=>minutesUntil(t.scheduledFor!,now)>20),[scheduled,now]);

  useEffect(()=>{
    scheduled.forEach((trip)=>{
      if(!trip.scheduledFor)return;
      const remaining=minutesUntil(trip.scheduledFor,now);
      const row=document.querySelector<HTMLElement>(`[data-dispatch-trip-id="${trip.id}"]`);
      if(row){row.hidden=remaining>20;row.dataset.centralgoReservation='true';row.dataset.reservationLabel=`RESERVA · ${formatTime(trip.scheduledFor)}`;}

      // Desde 10 minutos antes de la reserva, insiste cada minuto mientras siga pendiente/asignada.
      // El bucket evita repetir varias veces durante el mismo minuto aunque el reloj refresque cada 15 s.
      if(remaining<=10 && remaining>=0){
        const minuteBucket=Math.floor(Date.now()/60000);
        if(lastAlertMinuteRef.current.get(trip.id)!==minuteBucket){
          lastAlertMinuteRef.current.set(trip.id,minuteBucket);
          addNotification('RESERVA PRÓXIMA',`${trip.code} · ${trip.clientName} · retiro ${formatTime(trip.scheduledFor)} · faltan ${Math.max(0,remaining)} min`,'trip',trip.id);
          if(!soundMuted) soundManager.playReservationAlarm();
        }
      }
    });
  },[scheduled,now,addNotification,soundMuted]);

  const reservationStyle=<style>{`[data-centralgo-reservation="true"]{border-color:rgba(96,165,250,.45)!important;background:linear-gradient(90deg,rgba(59,130,246,.12),rgba(14,165,233,.06))!important;box-shadow:inset 3px 0 0 rgba(96,165,250,.75)}[data-centralgo-reservation="true"]::before{content:attr(data-reservation-label);display:inline-flex;margin:0 0 6px 0;padding:3px 8px;border:1px solid rgba(125,211,252,.35);border-radius:999px;background:rgba(14,165,233,.12);color:#bae6fd;font-size:9px;font-weight:900;letter-spacing:.08em}`}</style>;
  if(!waitingReservations.length)return reservationStyle;

  return <>{reservationStyle}<section className="overflow-hidden rounded-2xl border border-sky-400/25 bg-gradient-to-r from-sky-400/[0.09] via-[#0d0d0f] to-[#0d0d0f] shadow-xl shadow-black/20">
    <div className="flex items-center justify-between gap-3 border-b border-sky-400/15 px-3 py-2.5"><div className="flex min-w-0 items-center gap-2"><div className="rounded-lg bg-sky-400/10 p-1.5 text-sky-200"><CalendarClock className="h-4 w-4"/></div><div className="min-w-0"><h2 className="text-xs font-black text-white">Reservas programadas</h2><p className="truncate text-[9px] text-zinc-500">Pasan a la planilla 20 min antes. Desde 10 min antes, la alarma insiste cada minuto.</p></div></div><span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-[9px] font-black text-sky-200">{waitingReservations.length}</span></div>
    <div className="flex gap-2 overflow-x-auto p-2.5">{waitingReservations.slice(0,10).map((trip)=>{const remaining=minutesUntil(trip.scheduledFor!,now);const automatic=trip.dispatchMode==='automatic';return <button key={trip.id} type="button" onClick={()=>setSelectedTripForDetail(trip)} className="min-w-[270px] max-w-[340px] flex-1 rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-3 text-left transition hover:border-sky-300/45 hover:bg-sky-400/[0.09]">
      <div className="flex items-start justify-between gap-2"><div className="flex items-center gap-1.5 text-[10px] font-black text-sky-200"><Clock3 className="h-3.5 w-3.5"/>RESERVA · {formatSchedule(trip.scheduledFor!)}</div><ChevronRight className="h-4 w-4 shrink-0 text-zinc-600"/></div>
      <div className="mt-2 flex flex-wrap gap-1.5"><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-black ${automatic?'border-emerald-500/20 bg-emerald-500/10 text-emerald-300':'border-cyan-500/20 bg-cyan-500/10 text-cyan-200'}`}>{automatic?<Zap className="h-3 w-3"/>:<Radio className="h-3 w-3"/>}{automatic?'Despacho automático':'Despacho manual'}</span><span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-[9px] font-bold text-sky-200">Pasa a principal en {Math.max(1,remaining-20)} min</span></div>
      <p className="mt-2 flex items-center gap-1.5 truncate text-[10px] font-bold text-zinc-200"><UserRound className="h-3.5 w-3.5 shrink-0 text-zinc-500"/>{trip.clientName}</p><p className="mt-1 flex items-center gap-1.5 truncate text-[9px] text-zinc-500"><MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400"/>{trip.origin.address}</p>
      {trip.reservedDriverUnitNumber?<div className="mt-2 flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/[0.07] px-2 py-1.5 text-[9px] font-black text-violet-300"><Sparkles className="h-3.5 w-3.5"/>Móvil reservado: {trip.reservedDriverUnitNumber}</div>:<div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2 py-1.5 text-[9px] font-bold text-zinc-500">En espera hasta la ventana operativa de 20 minutos</div>}
    </button>})}</div>
  </section></>;
};
