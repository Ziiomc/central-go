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
 // El RPC ya devuelve la fila en el orden autoritativo de Postgres. No la
 // reordenamos nuevamente en el navegador: así un evento Realtime o una fecha
 // de presencia distinta nunca puede hacer que un conductor salte de lugar.
 const connected=useMemo(()=>queue.filter(item=>item.status!=='offline'),[queue]);
 const own=connected.find(item=>item.userId===currentUser.id);
 if(currentRole!=='driver'||currentCompany.id==='network')return null;
 const position=own?connected.findIndex(item=>item.driverId===own.driverId):-1;
 const inQueue=position>=0;
 const positionLabel=error?'…':inQueue?String(position+1):'—';
 const driversLabel=error?'…':String(connected.length);
 const statusLabel=(status:DriverQueueSnapshotItem['status'])=>status==='available'?'LIBRE':status==='paused'?'PAUSA':status==='en_route'?'EN CAMINO':status==='in_trip'?'EN VIAJE':status==='sos'?'SOS':'FUERA';
 const statusTone=(status:DriverQueueSnapshotItem['status'])=>status==='available'?'border-emerald-400/30 bg-emerald-400/10 text-emerald-200':status==='paused'?'border-amber-400/30 bg-amber-400/10 text-amber-200':status==='sos'?'border-rose-400/40 bg-rose-500/15 text-rose-100':'border-sky-400/30 bg-sky-400/10 text-sky-100';
 return <>
  <DriverTripCancellationControl/>
  <section data-driver-priority-card="1" className={`overflow-hidden rounded-xl border shadow-lg ${error?'border-rose-400/30 bg-[#191014]':'border-slate-600/45 bg-[#0d1117]'}`} aria-label={`Tu lugar en la fila: ${positionLabel}. Conductores conectados: ${driversLabel}`}>
   <div className="grid grid-cols-2">
    <div data-driver-priority-cell="1" className="flex min-h-[62px] items-center gap-2 border-r border-slate-700/70 px-3 py-2">
     <div data-driver-priority-icon="position" className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${inQueue&&!error?'border-blue-400/25 bg-blue-500/15 text-blue-200':'border-slate-700 bg-slate-800 text-slate-300'}`}><Hash className="h-3.5 w-3.5"/></div>
     <div className="min-w-0"><p data-driver-priority-label="1" className="font-black uppercase tracking-[.12em] text-slate-400">Tu posición</p><p data-driver-priority-value="1" className="mt-0.5 font-black tabular-nums leading-none text-white">{positionLabel}</p></div>
    </div>
    <button data-driver-connected-toggle="1" type="button" onClick={()=>setColleaguesOpen(value=>!value)} className={`flex min-h-[62px] items-center gap-2 px-3 py-2 text-left transition ${colleaguesOpen?'bg-sky-400/[0.07]':'bg-sky-400/[0.025] hover:bg-sky-400/[0.055]'}`} aria-label={`${colleaguesOpen?'Ocultar':'Ver'} ${driversLabel} conductores conectados`} aria-expanded={colleaguesOpen}>
     <div data-driver-priority-icon="connected" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-sky-400/25 bg-sky-400/10 text-sky-200"><Users className="h-3.5 w-3.5"/></div>
     <div className="min-w-0 flex-1"><p data-driver-priority-label="1" className="font-black uppercase tracking-[.12em] text-slate-400">Conectados</p><p data-driver-priority-value="1" className="mt-0.5 font-black tabular-nums leading-none text-white">{driversLabel}</p></div>
     <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${colleaguesOpen?'rotate-180':''}`}/>
    </button>
   </div>
   {colleaguesOpen&&<div data-driver-priority-list="1" className="border-t border-slate-700/70 bg-[#10161f]">
    <div className="max-h-52 divide-y divide-slate-700/60 overflow-y-auto">
     {connected.map((item,index)=>{const isOwn=item.userId===currentUser.id;return <div data-driver-priority-row="1" data-driver-priority-own={isOwn?'1':'0'} key={item.driverId} className={`flex min-h-10 items-center gap-2.5 px-3 py-1.5 ${isOwn?'bg-blue-500/[0.10]':''}`}>
      <span data-driver-priority-index="1" className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-slate-600 bg-slate-800 text-[9px] font-black text-white">{index+1}</span>
      <div className="min-w-0 flex-1"><p data-driver-priority-title="1" className="truncate text-[10px] font-black text-white">Móvil {item.unitNumber}{isOwn?' · Tú':''}</p><p data-driver-priority-subtitle="1" className="mt-0.5 truncate text-[8px] font-semibold text-slate-300">{item.status==='available'?`Posición ${index+1} para despacho`:item.status==='paused'?`Posición ${index+1} conservada en pausa`:statusLabel(item.status)}</p></div>
      <span data-driver-priority-status="1" className={`shrink-0 rounded-md border px-2 py-1 text-[8px] font-black ${statusTone(item.status)}`}>{statusLabel(item.status)}</span>
     </div>;})}
     {!connected.length&&!error?<p data-driver-priority-empty="1" className="px-3 py-3 text-center text-[9px] font-semibold text-slate-300">No hay otros móviles conectados.</p>:null}
     {error?<p className="px-3 py-3 text-center text-[9px] font-semibold text-rose-200">No pudimos actualizar la fila. Intenta nuevamente.</p>:null}
    </div>
   </div>}
  </section>
 </>;
};
