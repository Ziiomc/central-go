import React,{useMemo,useState}from'react';
import{CalendarClock,Car,Clock3,Copy,MapPin,Pencil,Radio,Trash2,UserRound,XCircle,Zap}from'lucide-react';
import{useApp}from'../../context/AppContext';
import{reserveScheduledTripAtomic}from'../../lib/reservationRepository';
import type{Trip}from'../../types';

const formatSchedule=(iso:string)=>new Date(iso).toLocaleString('es-CL',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
const minutesUntil=(iso:string)=>Math.ceil((new Date(iso).getTime()-Date.now())/60000);
const sameLocalDay=(iso:string)=>{const a=new Date(iso);const b=new Date();return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();};

export const ScheduledTripsStrip:React.FC=()=>{
 const{trips,drivers,setSelectedTripForDetail,cancelTrip,createTrip}=useApp();
 const[busyId,setBusyId]=useState<string|null>(null);
 const[message,setMessage]=useState('');
 const[driverChoice,setDriverChoice]=useState<Record<string,string>>({});

 const scheduled=useMemo(()=>trips
  .filter(t=>Boolean(t.scheduledFor)&&!['completed','cancelled'].includes(t.status))
  .sort((a,b)=>new Date(a.scheduledFor!).getTime()-new Date(b.scheduledFor!).getTime()),[trips]);
 const reservationDrivers=useMemo(()=>drivers
  .filter(driver=>driver.status!=='sos')
  .slice()
  .sort((a,b)=>a.unitNumber.localeCompare(b.unitNumber,'es',{numeric:true})),[drivers]);

 const cancelReservation=async(trip:Trip)=>{if(busyId)return;if(!window.confirm(`¿Cancelar la reserva ${trip.code}?`))return;setBusyId(trip.id);setMessage('');try{await Promise.resolve(cancelTrip(trip.id,'Reserva cancelada por la central'));setMessage('Reserva cancelada.');}catch(e){setMessage(e instanceof Error?e.message:'No se pudo cancelar la reserva.');}finally{setBusyId(null);}};
 const repeatNextWeek=async(trip:Trip)=>{if(!trip.scheduledFor||busyId)return;const next=new Date(trip.scheduledFor);next.setDate(next.getDate()+7);const exists=scheduled.some(item=>item.id!==trip.id&&item.clientId===trip.clientId&&Math.abs(new Date(item.scheduledFor!).getTime()-next.getTime())<120000);if(exists){setMessage('Ya existe una reserva equivalente para la próxima semana.');return;}setBusyId(trip.id);setMessage('');try{await Promise.resolve(createTrip({clientId:trip.clientId,clientName:trip.clientName,clientPhone:trip.clientPhone,origin:trip.origin,destination:trip.destination,vehicleTypeRequested:trip.vehicleTypeRequested,estimatedDistanceKm:trip.estimatedDistanceKm,estimatedDurationMins:trip.estimatedDurationMins,estimatedFare:trip.estimatedFare,isFixedFare:trip.isFixedFare,fixedFareAmount:trip.fixedFareAmount,paymentMethod:trip.paymentMethod,notes:trip.notes,dispatchMode:trip.dispatchMode,scheduledFor:next.toISOString()}));setMessage(`Reserva creada para ${formatSchedule(next.toISOString())}.`);}catch(e){setMessage(e instanceof Error?e.message:'No se pudo repetir la reserva.');}finally{setBusyId(null);}};
 const editReservation=(trip:Trip)=>{setSelectedTripForDetail(trip);window.setTimeout(()=>window.dispatchEvent(new CustomEvent('centralgo:edit-trip',{detail:{tripId:trip.id}})),0);};
 const reserveDriver=async(trip:Trip)=>{if(busyId)return;const driverId=driverChoice[trip.id]??trip.reservedDriverId??'';if(!driverId){setMessage('Elige un móvil para esta reserva.');return;}const driver=drivers.find(item=>item.id===driverId);setBusyId(trip.id);setMessage('');try{await reserveScheduledTripAtomic(trip.id,driverId);setMessage(`Reserva ${trip.code} vinculada al móvil ${driver?.unitNumber??driverId}.`);window.dispatchEvent(new CustomEvent('centralgo:driver-resync',{detail:{reason:'reservation-assigned'}}));}catch(e){setMessage(e instanceof Error?e.message:'No se pudo reservar el móvil.');}finally{setBusyId(null);}};
 const clearReservedDriver=async(trip:Trip)=>{if(busyId)return;setBusyId(trip.id);setMessage('');try{await reserveScheduledTripAtomic(trip.id,null);setDriverChoice(current=>({...current,[trip.id]:''}));setMessage(`Se quitó el móvil reservado de ${trip.code}.`);window.dispatchEvent(new CustomEvent('centralgo:driver-resync',{detail:{reason:'reservation-cleared'}}));}catch(e){setMessage(e instanceof Error?e.message:'No se pudo quitar el móvil reservado.');}finally{setBusyId(null);}};

 return <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0d0f] shadow-xl shadow-black/20">
  <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
   <div className="flex min-w-0 items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl border border-sky-500/25 bg-sky-500/10 text-sky-300"><CalendarClock className="h-4 w-4"/></span><div className="min-w-0"><h2 className="text-sm font-black text-white">Reservas</h2><p className="truncate text-[10px] text-zinc-500">Las reservas futuras viven aquí y no ocupan la central de despacho.</p></div></div>
   <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[10px] font-black text-sky-300">{scheduled.length}</span>
  </div>
  {message&&<div className="border-b border-zinc-800 bg-sky-500/[0.06] px-4 py-2 text-[10px] font-bold text-sky-200">{message}</div>}
  {!scheduled.length?<div className="px-5 py-14 text-center"><CalendarClock className="mx-auto h-8 w-8 text-zinc-700"/><p className="mt-3 text-sm font-black text-white">No hay reservas programadas</p><p className="mt-1 text-xs text-zinc-500">Las nuevas reservas aparecerán aquí ordenadas por fecha.</p></div>:
  <div className="max-h-[calc(100vh-210px)] divide-y divide-zinc-800/80 overflow-y-auto">{scheduled.map(trip=>{const remaining=minutesUntil(trip.scheduledFor!);const automatic=trip.dispatchMode==='automatic';const selected=driverChoice[trip.id]??trip.reservedDriverId??'';const today=sameLocalDay(trip.scheduledFor!);const inDispatchWindow=remaining<=20;return <article key={trip.id} className="p-3.5 hover:bg-zinc-900/45">
   <div className="flex flex-wrap items-start justify-between gap-3">
    <button type="button" onClick={()=>setSelectedTripForDetail(trip)} className="min-w-0 flex-1 text-left">
     <div className="flex flex-wrap items-center gap-1.5"><span className="inline-flex items-center gap-1.5 text-[11px] font-black text-sky-300"><Clock3 className="h-3.5 w-3.5"/>{formatSchedule(trip.scheduledFor!)}</span><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8px] font-black ${automatic?'border-emerald-500/25 bg-emerald-500/10 text-emerald-300':'border-cyan-500/25 bg-cyan-500/10 text-cyan-300'}`}>{automatic?<Zap className="h-3 w-3"/>:<Radio className="h-3 w-3"/>}{automatic?'Automática':'Manual'}</span><span className={`rounded-full border px-2 py-0.5 text-[8px] font-black ${today&&inDispatchWindow?'border-amber-500/30 bg-amber-500/10 text-amber-300':today?'border-blue-500/25 bg-blue-500/10 text-blue-300':'border-zinc-700 bg-zinc-900 text-zinc-400'}`}>{today&&inDispatchWindow?'En cola de despacho':today?'Reserva de hoy':'Solo Reservas'}</span>{trip.reservedDriverId&&<span className="inline-flex items-center gap-1 rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[8px] font-black text-violet-300"><Car className="h-3 w-3"/>Móvil {trip.reservedDriverUnitNumber}</span>}</div>
     <p className="mt-2 flex items-center gap-1.5 truncate text-[11px] font-bold text-zinc-200"><UserRound className="h-3.5 w-3.5 shrink-0 text-zinc-500"/>{trip.clientName}{trip.clientPhone&&trip.clientPhone!=='Sin teléfono'?` · ${trip.clientPhone}`:''}</p>
     <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-zinc-400"><MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400"/>{trip.origin.address}</p>
     <p className="mt-1 pl-5 text-[9px] text-zinc-600">{automatic?'El sistema ofrecerá esta carrera automáticamente 10 minutos antes del retiro.':'La operadora podrá asignarla dentro de la ventana de despacho.'}</p>
    </button>
    <div className="flex shrink-0 gap-1.5"><button type="button" onClick={()=>editReservation(trip)} className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-700 bg-zinc-900 text-sky-300" title="Editar"><Pencil className="h-3.5 w-3.5"/></button><button type="button" disabled={busyId===trip.id} onClick={()=>void repeatNextWeek(trip)} className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-700 bg-zinc-900 text-indigo-300 disabled:opacity-40" title="Repetir +1 semana"><Copy className="h-3.5 w-3.5"/></button><button type="button" disabled={busyId===trip.id} onClick={()=>void cancelReservation(trip)} className="grid h-8 w-8 place-items-center rounded-lg border border-rose-500/25 bg-rose-500/10 text-rose-300 disabled:opacity-40" title="Cancelar"><Trash2 className="h-3.5 w-3.5"/></button></div>
   </div>
   <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-violet-500/15 bg-violet-500/[0.04] p-2"><span className="mr-1 text-[8px] font-black uppercase tracking-wider text-violet-300">Móvil reservado</span><select value={selected} onChange={event=>setDriverChoice(current=>({...current,[trip.id]:event.target.value}))} className="h-8 min-w-[170px] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-[9px] font-bold text-zinc-200 outline-none"><option value="">Sin móvil específico</option>{reservationDrivers.map(driver=><option key={driver.id} value={driver.id}>Móvil {driver.unitNumber} · {driver.name} · {driver.operationMode==='traditional'?'Radio':'App'}</option>)}</select><button type="button" disabled={!selected||busyId===trip.id} onClick={()=>void reserveDriver(trip)} className="h-8 rounded-lg bg-violet-600 px-2.5 text-[8px] font-black text-white disabled:opacity-40">{trip.reservedDriverId?'Cambiar':'Reservar'}</button>{trip.reservedDriverId&&<button type="button" disabled={busyId===trip.id} onClick={()=>void clearReservedDriver(trip)} className="grid h-8 w-8 place-items-center rounded-lg border border-violet-500/20 bg-zinc-950 text-violet-300 disabled:opacity-40" title="Quitar móvil reservado"><XCircle className="h-3.5 w-3.5"/></button>}</div>
  </article>})}</div>}
 </section>;
};
