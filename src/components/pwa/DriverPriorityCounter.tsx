import React,{useEffect,useMemo,useState}from'react';
import{Users,Hash}from'lucide-react';
import{useApp}from'../../context/AppContext';
import{isQueueConnected,loadDispatchQueue,subscribeDispatchQueue,type DispatchQueueItem}from'../../lib/dispatchPriorityRepository';
import{DriverTripCancellationControl}from'./DriverTripCancellationControl';

export const DriverPriorityCounter:React.FC=()=>{
 const{currentRole,currentCompany,currentUser}=useApp();
 const[queue,setQueue]=useState<DispatchQueueItem[]>([]);
 const[error,setError]=useState(false);
 const load=async()=>{if(currentRole!=='driver'||currentCompany.id==='network')return;try{setQueue(await loadDispatchQueue(currentCompany.id));setError(false);}catch{setError(true);}};
 useEffect(()=>{void load();if(currentRole!=='driver'||currentCompany.id==='network')return;const unsubscribe=subscribeDispatchQueue(currentCompany.id,()=>void load());const timer=window.setInterval(()=>void load(),30000);return()=>{unsubscribe();window.clearInterval(timer);};},[currentRole,currentCompany.id,currentUser.id]);
 const own=queue.find(item=>item.userId===currentUser.id);
 const connected=useMemo(()=>queue.filter(isQueueConnected).sort((a,b)=>a.queueOrder-b.queueOrder||a.unitNumber.localeCompare(b.unitNumber,'es',{numeric:true})),[queue]);
 if(currentRole!=='driver'||currentCompany.id==='network')return null;
 const position=own?connected.findIndex(item=>item.driverId===own.driverId):-1;
 const inQueue=position>=0;
 const positionLabel=error?'…':inQueue?String(position+1):'—';
 const driversLabel=error?'…':String(connected.length);
 return <>
  <DriverTripCancellationControl/>
  {own&&<div className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+4.15rem)] z-[145] w-[min(27rem,calc(100vw-1.25rem))] -translate-x-1/2">
   <div className={`grid grid-cols-2 overflow-hidden rounded-2xl border shadow-xl backdrop-blur-xl ${error?'border-rose-400/35 bg-rose-950/95':'border-blue-400/20 bg-[var(--cg-surface-solid)]/95'}`}>
    <div className="flex items-center gap-2.5 border-r border-[var(--cg-border)] px-3 py-2.5">
     <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${inQueue&&!error?'bg-blue-500/15 text-blue-300':'bg-zinc-800 text-zinc-400'}`}><Hash className="h-4 w-4"/></div>
     <div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[.12em] text-[var(--cg-muted)]">Tu posición en la fila</p><p className="mt-0.5 text-lg font-black tabular-nums leading-none text-[var(--cg-text)]">{positionLabel}</p></div>
    </div>
    <div className="flex items-center gap-2.5 px-3 py-2.5">
     <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cyan-500/15 text-cyan-300"><Users className="h-4 w-4"/></div>
     <div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[.12em] text-[var(--cg-muted)]">Conductores en fila</p><p className="mt-0.5 text-lg font-black tabular-nums leading-none text-[var(--cg-text)]">{driversLabel}</p></div>
    </div>
   </div>
  </div>}
 </>;
};