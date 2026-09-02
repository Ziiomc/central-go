import React,{useEffect,useMemo,useState}from'react';
import{createPortal}from'react-dom';
import{Users,Hash,X}from'lucide-react';
import{useApp}from'../../context/AppContext';
import{loadDriverQueueSnapshot,subscribeDispatchQueue,type DriverQueueSnapshotItem}from'../../lib/dispatchPriorityRepository';
import{DriverTripCancellationControl}from'./DriverTripCancellationControl';

export const DriverPriorityCounter:React.FC=()=>{
 const{currentRole,currentCompany,currentUser}=useApp();
 const[queue,setQueue]=useState<DriverQueueSnapshotItem[]>([]);
 const[error,setError]=useState(false);
 const[host,setHost]=useState<HTMLElement|null>(null);
 const[colleaguesOpen,setColleaguesOpen]=useState(false);
 const load=async()=>{if(currentRole!=='driver'||currentCompany.id==='network')return;try{setQueue(await loadDriverQueueSnapshot(currentCompany.id));setError(false);}catch{setError(true);}};
 useEffect(()=>{void load();if(currentRole!=='driver'||currentCompany.id==='network')return;const unsubscribe=subscribeDispatchQueue(currentCompany.id,()=>void load());const timer=window.setInterval(()=>void load(),30000);return()=>{unsubscribe();window.clearInterval(timer);};},[currentRole,currentCompany.id,currentUser.id]);
 useEffect(()=>{
  if(currentRole!=='driver')return;
  const locate=()=>setHost(document.getElementById('driver-queue-summary-slot'));
  locate();
  const observer=new MutationObserver(locate);
  observer.observe(document.body,{childList:true,subtree:true});
  return()=>{observer.disconnect();setHost(null);};
 },[currentRole]);
 const connected=useMemo(()=>queue.slice().sort((a,b)=>a.queueOrder-b.queueOrder||new Date(a.connectedAt).getTime()-new Date(b.connectedAt).getTime()||a.unitNumber.localeCompare(b.unitNumber,'es',{numeric:true})),[queue]);
 const own=connected.find(item=>item.userId===currentUser.id);
 const waiting=useMemo(()=>connected.filter(item=>item.status==='available'),[connected]);
 if(currentRole!=='driver'||currentCompany.id==='network')return null;
 const position=own?waiting.findIndex(item=>item.driverId===own.driverId):-1;
 const inQueue=position>=0;
 const positionLabel=error?'…':inQueue?String(position+1):'—';
 const driversLabel=error?'…':String(connected.length);
 const statusLabel=(status:DriverQueueSnapshotItem['status'])=>status==='available'?'LIBRE':status==='paused'?'PAUSA':status==='en_route'?'EN CAMINO':status==='in_trip'?'EN VIAJE':status==='sos'?'SOS':'DESCONECTADO';
 const colleaguesPanel=colleaguesOpen?createPortal(<div className="fixed inset-0 z-[3200] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center" onClick={()=>setColleaguesOpen(false)}><section onClick={event=>event.stopPropagation()} className="max-h-[72dvh] w-full max-w-sm overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#101014] shadow-2xl shadow-black/60"><header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3"><div><p className="text-sm font-black text-white">Móviles conectados</p><p className="mt-0.5 text-[9px] text-zinc-500">Orden de la fila en tiempo real</p></div><button type="button" onClick={()=>setColleaguesOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-400" aria-label="Cerrar lista de conectados"><X className="h-4 w-4"/></button></header><div className="max-h-[58dvh] divide-y divide-zinc-800 overflow-y-auto">{connected.map((item,index)=>{const isOwn=item.userId===currentUser.id;const waitingPosition=waiting.findIndex(candidate=>candidate.driverId===item.driverId);return <div key={item.driverId} className={`flex items-center gap-3 px-4 py-3 ${isOwn?'bg-blue-500/[0.08]':''}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-xs font-black text-cyan-200">{index+1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-white">Móvil {item.unitNumber}{isOwn?' · Tú':''}</p><p className="mt-0.5 text-[9px] font-bold text-zinc-500">{waitingPosition>=0?`Posición ${waitingPosition+1} para despacho`:statusLabel(item.status)}</p></div><span className={`rounded-lg px-2 py-1 text-[8px] font-black ${item.status==='available'?'bg-emerald-500/10 text-emerald-300':item.status==='paused'?'bg-amber-500/10 text-amber-300':'bg-blue-500/10 text-blue-300'}`}>{statusLabel(item.status)}</span></div>;})}{!connected.length&&!error?<p className="px-4 py-8 text-center text-xs text-zinc-500">No hay otros móviles conectados.</p>:null}{error?<p className="px-4 py-8 text-center text-xs text-rose-300">No pudimos actualizar la fila. Intenta nuevamente.</p>:null}</div></section></div>,document.body):null;
 const inlineCard=host?createPortal(
  <section className={`grid grid-cols-2 overflow-hidden rounded-xl border shadow-lg ${error?'border-rose-400/30 bg-rose-950/30':'border-blue-500/25 bg-[#121215]'}`} aria-label={`Tu lugar en la fila: ${positionLabel}. Conductores conectados: ${driversLabel}`}>
   <div className="flex items-center gap-2 border-r border-zinc-800 px-2.5 py-2">
    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${inQueue&&!error?'bg-blue-500/15 text-blue-300':'bg-zinc-800 text-zinc-400'}`}><Hash className="h-4 w-4"/></div>
    <div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[.12em] text-zinc-500">Tu lugar</p><p className="mt-0.5 text-xl font-black tabular-nums leading-none text-white">{positionLabel}</p></div>
   </div>
   <button type="button" onClick={()=>setColleaguesOpen(true)} className="flex items-center gap-2 px-2.5 py-2 text-left transition hover:bg-cyan-500/[0.08]" aria-label={`Ver ${driversLabel} conductores conectados`} aria-expanded={colleaguesOpen}>
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-500/15 text-cyan-300"><Users className="h-4 w-4"/></div>
    <div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[.12em] text-zinc-500">Conectados</p><p className="mt-0.5 text-xl font-black tabular-nums leading-none text-white">{driversLabel}</p></div>
   </button>
  </section>,host):null;
 return <><DriverTripCancellationControl/>{inlineCard}{colleaguesPanel}</>;
};
