import React,{useEffect,useMemo,useState}from'react';
import{ChevronDown,ChevronUp,Clock3,Loader2,LocateFixed,ShieldCheck,UsersRound,XCircle,Zap}from'lucide-react';
import{useApp}from'../../context/AppContext';
import{isQueueConnected,loadDispatchQueue,refreshDispatchRouteMatrix,subscribeDispatchQueue,type DispatchQueueItem}from'../../lib/dispatchPriorityRepository';

export const DispatchPriorityBoard:React.FC=()=>{
 const{currentCompany,trips,assignTrip,cancelTrip}=useApp();
 const[queue,setQueue]=useState<DispatchQueueItem[]>([]);
 const[openTripId,setOpenTripId]=useState('');
 const[busy,setBusy]=useState('');
 const[error,setError]=useState('');
 const pending=useMemo(()=>trips.filter(t=>t.status==='pending').sort((a,b)=>new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime()),[trips]);
 const connected=useMemo(()=>queue.filter(isQueueConnected).sort((a,b)=>{const av=Number(b.status==='available')-Number(a.status==='available');return av||a.queueOrder-b.queueOrder||a.unitNumber.localeCompare(b.unitNumber,'es',{numeric:true});}),[queue]);
 const availableCount=connected.filter(d=>d.status==='available').length;
 const load=async(tripId=openTripId)=>{if(currentCompany.id==='network')return;try{setQueue(await loadDispatchQueue(currentCompany.id,tripId||undefined));setError('');}catch(err){setError(err instanceof Error?err.message:'No fue posible cargar los móviles conectados.');}};
 useEffect(()=>{void load(openTripId);if(currentCompany.id==='network')return;return subscribeDispatchQueue(currentCompany.id,()=>void load(openTripId));},[currentCompany.id,openTripId]);
 useEffect(()=>{if(openTripId&&!pending.some(t=>t.id===openTripId))setOpenTripId('');},[pending,openTripId]);
 useEffect(()=>{if(!openTripId)return;let alive=true;void refreshDispatchRouteMatrix(openTripId).then(()=>window.setTimeout(()=>{if(alive)void load(openTripId);},700)).catch(()=>undefined);return()=>{alive=false;};},[openTripId]);
 const toggleTrip=(tripId:string)=>setOpenTripId(v=>v===tripId?'':tripId);
 const manualAssign=async(tripId:string,item:DispatchQueueItem)=>{if(item.status!=='available')return;setBusy(`assign:${tripId}:${item.driverId}`);setError('');try{await assignTrip(tripId,item.driverId);setOpenTripId('');}catch(err){setError(err instanceof Error?err.message:'No fue posible asignar la carrera.');}finally{setBusy('');}};
 const cancelPending=async(tripId:string,code:string)=>{if(!window.confirm(`¿Cancelar la carrera pendiente ${code}?`))return;setBusy(`cancel:${tripId}`);setError('');try{await cancelTrip(tripId,'Cancelada por la central antes de asignar un móvil');if(openTripId===tripId)setOpenTripId('');}catch(err){setError(err instanceof Error?err.message:'No fue posible cancelar la carrera.');}finally{setBusy('');}};
 const locateDriver=(item:DispatchQueueItem)=>window.dispatchEvent(new CustomEvent('centralgo:locate-driver',{detail:{driverId:item.driverId,unitNumber:item.unitNumber,name:item.name}}));
 const waitMinutes=(createdAt:string)=>Math.max(0,Math.floor((Date.now()-new Date(createdAt).getTime())/60000));
 if(currentCompany.id==='network')return null;
 return <section className="cg-priority-board overflow-hidden rounded-[20px] border border-white/[0.07] bg-[linear-gradient(180deg,#111217_0%,#0b0c10_100%)] shadow-[0_24px_80px_rgba(0,0,0,.28)]">
  <header className="border-b border-white/[0.06] bg-white/[0.015] px-4 py-3.5">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex items-center gap-2.5"><div className="grid h-8 w-8 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08]"><ShieldCheck className="h-4 w-4 text-cyan-300"/></div><div><h2 className="text-sm font-black tracking-tight text-white">Cola de despacho</h2><p className="mt-0.5 text-[9px] font-medium text-zinc-500">Primero en entrar, primero en pantalla</p></div></div>
    <div className="flex items-center gap-2"><Stat label="Pendientes" value={pending.length} tone="text-amber-300"/><Stat label="Móviles libres" value={availableCount} tone="text-emerald-300"/></div>
   </div>
  </header>
  {error&&<div className="mx-3 mt-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.08] px-3 py-2 text-[10px] font-medium text-rose-200">{error}</div>}
  <div className="space-y-2 p-3">
   {pending.map((trip,index)=>{const open=openTripId===trip.id;const mins=waitMinutes(trip.createdAt);const urgency=mins>=10?'border-rose-400/25 bg-rose-400/[0.035]':mins>=5?'border-amber-400/20 bg-amber-400/[0.03]':'border-white/[0.07] bg-white/[0.018]';return <article key={trip.id} className={`overflow-hidden rounded-2xl border transition ${open?'border-cyan-400/30 bg-cyan-400/[0.035]':urgency}`}>
    <div className="flex items-center gap-3 p-3">
     <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-black/20 text-[10px] font-black text-zinc-400">{String(index+1).padStart(2,'0')}</div>
     <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[10px] font-black text-cyan-300">{trip.code}</span><span className={`inline-flex items-center gap-1 text-[8px] font-bold ${mins>=10?'text-rose-300':mins>=5?'text-amber-300':'text-zinc-500'}`}><Clock3 className="h-3 w-3"/>{mins} min</span></div><p className="mt-1 truncate text-[11px] font-bold text-zinc-100">{trip.origin.address}</p><p className="mt-0.5 truncate text-[9px] text-zinc-500">→ {trip.destination.address}</p></div>
     <button type="button" onClick={()=>toggleTrip(trip.id)} className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[9px] font-black transition ${open?'border-cyan-400/30 bg-cyan-400/10 text-cyan-200':'border-white/[0.08] bg-white/[0.03] text-zinc-200 hover:border-cyan-400/25'}`}><UsersRound className="h-3.5 w-3.5"/>Asignar móvil{open?<ChevronUp className="h-3 w-3"/>:<ChevronDown className="h-3 w-3"/>}</button>
    </div>
    {open&&<div className="border-t border-white/[0.06] bg-black/15 p-2.5">
     <div className="mb-2 flex items-center justify-between px-1"><p className="text-[8px] font-black uppercase tracking-[.14em] text-zinc-500">Móviles conectados · libres primero</p><span className="text-[8px] font-bold text-emerald-300">{availableCount} disponibles</span></div>
     <div className="max-h-[310px] space-y-1.5 overflow-y-auto pr-1 [scrollbar-color:#27272a_transparent] [scrollbar-width:thin]">
      {connected.map((item,driverIndex)=>{const available=item.status==='available';const label=available?'Libre':item.status==='in_trip'?'En viaje':'En servicio';return <div key={item.driverId} className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${available?'border-emerald-400/10 bg-emerald-400/[0.025]':'border-white/[0.05] bg-white/[0.012] opacity-70'}`}>
       <span className="w-5 shrink-0 text-center text-[8px] font-black text-zinc-600">{driverIndex+1}</span>
       <button type="button" onClick={()=>locateDriver(item)} className="min-w-0 flex-1 text-left"><div className="flex items-center gap-1.5"><span className="text-[10px] font-black text-white">Móvil {item.unitNumber}</span><LocateFixed className="h-3 w-3 text-zinc-600"/></div><p className="truncate text-[8px] font-medium text-zinc-500">{item.name||'Conductor sin nombre'} · {label}</p></button>
       <button type="button" disabled={!available||Boolean(busy)} onClick={()=>void manualAssign(trip.id,item)} className="inline-flex h-8 min-w-[82px] items-center justify-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] px-2 text-[8px] font-black text-cyan-200 disabled:border-white/[0.05] disabled:bg-white/[0.015] disabled:text-zinc-600">{busy===`assign:${trip.id}:${item.driverId}`?<Loader2 className="h-3 w-3 animate-spin"/>:<Zap className="h-3 w-3"/>}{available?'Enviar':'Ocupado'}</button>
      </div>})}
      {!connected.length&&<div className="rounded-xl border border-dashed border-white/[0.07] px-3 py-8 text-center text-[10px] font-bold text-zinc-500">No hay móviles conectados en este momento.</div>}
     </div>
     <div className="mt-2 flex justify-end"><button type="button" disabled={Boolean(busy)} onClick={()=>void cancelPending(trip.id,trip.code)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[8px] font-bold text-zinc-600 transition hover:bg-rose-400/[0.06] hover:text-rose-300"><XCircle className="h-3 w-3"/>Cancelar carrera</button></div>
    </div>}
   </article>})}
   {!pending.length&&<div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.012] px-4 py-12 text-center"><p className="text-[12px] font-black text-zinc-300">Cola despejada</p><p className="mt-1 text-[9px] text-zinc-600">Las carreras enviadas a pendiente aparecerán aquí automáticamente.</p></div>}
  </div>
 </section>;
};

const Stat=({label,value,tone}:{label:string;value:number;tone:string})=><div className="rounded-xl border border-white/[0.07] bg-black/20 px-2.5 py-1.5 text-right"><p className="text-[7px] font-black uppercase tracking-[.12em] text-zinc-600">{label}</p><p className={`text-sm font-black leading-none ${tone}`}>{value}</p></div>;
