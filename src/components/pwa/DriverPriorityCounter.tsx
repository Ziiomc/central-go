import React,{useEffect,useMemo,useState}from'react';
import{Users,Hash,ChevronDown}from'lucide-react';
import{useApp}from'../../context/AppContext';
import{loadDriverQueueSnapshot,subscribeDispatchQueue,type DriverQueueSnapshotItem}from'../../lib/dispatchPriorityRepository';
import{DriverTripCancellationControl}from'./DriverTripCancellationControl';

export const DriverPriorityCounter:React.FC=()=>{
 const{currentRole,currentCompany,currentUser}=useApp();
 const[queue,setQueue]=useState<DriverQueueSnapshotItem[]>([]);
 const[error,setError]=useState(false);
 const[colleaguesOpen,setColleaguesOpen]=useState(false);
 const load=async()=>{if(currentRole!=='driver'||currentCompany.id==='network')return;try{setQueue(await loadDriverQueueSnapshot(currentCompany.id));setError(false);}catch{setError(true);}};
 useEffect(()=>{void load();if(currentRole!=='driver'||currentCompany.id==='network')return;const unsubscribe=subscribeDispatchQueue(currentCompany.id,()=>void load());const timer=window.setInterval(()=>void load(),30000);return()=>{unsubscribe();window.clearInterval(timer);};},[currentRole,currentCompany.id,currentUser.id]);
 const connected=useMemo(()=>queue.filter(item=>item.status!=='offline').slice().sort((a,b)=>a.queueOrder-b.queueOrder||new Date(a.connectedAt).getTime()-new Date(b.connectedAt).getTime()||a.unitNumber.localeCompare(b.unitNumber,'es',{numeric:true})),[queue]);
 const own=connected.find(item=>item.userId===currentUser.id);
 const waiting=useMemo(()=>connected.filter(item=>item.status==='available'),[connected]);
 if(currentRole!=='driver'||currentCompany.id==='network')return null;
 const position=own?waiting.findIndex(item=>item.driverId===own.driverId):-1;
 const inQueue=position>=0;
 const positionLabel=error?'…':inQueue?String(position+1):'—';
 const driversLabel=error?'…':String(connected.length);
 const statusLabel=(status:DriverQueueSnapshotItem['status'])=>status==='available'?'LIBRE':status==='paused'?'PAUSA':status==='en_route'?'EN CAMINO':status==='in_trip'?'EN VIAJE':status==='sos'?'SOS':'FUERA';
 const statusTone=(status:DriverQueueSnapshotItem['status'])=>status==='available'?'border-emerald-400/30 bg-emerald-400/10 text-emerald-200':status==='paused'?'border-amber-400/30 bg-amber-400/10 text-amber-200':status==='sos'?'border-rose-400/40 bg-rose-500/15 text-rose-100':'border-sky-400/30 bg-sky-400/10 text-sky-100';
 return <>
  <DriverTripCancellationControl/>
  <section className={`overflow-hidden rounded-xl border shadow-lg ${error?'border-rose-400/30 bg-[#191014]':'border-slate-600/45 bg-[#0d1117]'}`} aria-label={`Tu lugar en la fila: ${positionLabel}. Conductores conectados: ${driversLabel}`}>
   <div className="grid grid-cols-2">
    <div className="flex items-center gap-2 border-r border-slate-700/70 px-2.5 py-2.5">
     <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${inQueue&&!error?'border-blue-400/25 bg-blue-500/15 text-blue-200':'border-slate-700 bg-slate-800 text-slate-300'}`}><Hash className="h-4 w-4"/></div>
     <div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[.12em] text-slate-400">Tu lugar</p><p className="mt-0.5 text-xl font-black tabular-nums leading-none text-white">{positionLabel}</p></div>
    </div>
    <button type="button" onClick={()=>setColleaguesOpen(value=>!value)} className={`flex items-center gap-2 px-2.5 py-2.5 text-left transition ${colleaguesOpen?'bg-sky-400/[0.08]':'hover:bg-sky-400/[0.06]'}`} aria-label={`${colleaguesOpen?'Ocultar':'Ver'} ${driversLabel} conductores conectados`} aria-expanded={colleaguesOpen}>
     <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-sky-400/25 bg-sky-400/10 text-sky-200"><Users className="h-4 w-4"/></div>
     <div className="min-w-0 flex-1"><p className="text-[8px] font-black uppercase tracking-[.12em] text-slate-400">Conectados</p><p className="mt-0.5 text-xl font-black tabular-nums leading-none text-white">{driversLabel}</p></div>
     <ChevronDown className={`h-4 w-4 shrink-0 text-slate-300 transition-transform ${colleaguesOpen?'rotate-180':''}`}/>
    </button>
   </div>
   {colleaguesOpen&&<div className="border-t border-slate-700/70 bg-[#10161f]">
    <div className="max-h-56 divide-y divide-slate-700/60 overflow-y-auto">
     {connected.map((item,index)=>{const isOwn=item.userId===currentUser.id;const waitingPosition=waiting.findIndex(candidate=>candidate.driverId===item.driverId);return <div key={item.driverId} className={`flex min-h-11 items-center gap-2.5 px-3 py-2 ${isOwn?'bg-blue-500/[0.10]':''}`}>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-slate-600 bg-slate-800 text-[10px] font-black text-white">{index+1}</span>
      <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-black text-white">Móvil {item.unitNumber}{isOwn?' · Tú':''}</p><p className="mt-0.5 truncate text-[9px] font-semibold text-slate-300">{waitingPosition>=0?`Posición ${waitingPosition+1} para despacho`:statusLabel(item.status)}</p></div>
      <span className={`shrink-0 rounded-md border px-2 py-1 text-[8px] font-black ${statusTone(item.status)}`}>{statusLabel(item.status)}</span>
     </div>;})}
     {!connected.length&&!error?<p className="px-3 py-4 text-center text-[10px] font-semibold text-slate-300">No hay otros móviles conectados.</p>:null}
     {error?<p className="px-3 py-4 text-center text-[10px] font-semibold text-rose-200">No pudimos actualizar la fila. Intenta nuevamente.</p>:null}
    </div>
   </div>}
  </section>
 </>;
};
