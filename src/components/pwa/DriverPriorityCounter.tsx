import React,{useEffect,useMemo,useState}from'react';
import{createPortal}from'react-dom';
import{Users,Hash}from'lucide-react';
import{useApp}from'../../context/AppContext';
import{loadDriverQueueSnapshot,subscribeDispatchQueue,type DriverQueueSnapshotItem}from'../../lib/dispatchPriorityRepository';
import{DriverTripCancellationControl}from'./DriverTripCancellationControl';

export const DriverPriorityCounter:React.FC=()=>{
 const{currentRole,currentCompany,currentUser}=useApp();
 const[queue,setQueue]=useState<DriverQueueSnapshotItem[]>([]);
 const[error,setError]=useState(false);
 const[host,setHost]=useState<HTMLElement|null>(null);
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
 const inlineCard=host?createPortal(
  <section className={`grid grid-cols-2 overflow-hidden rounded-xl border shadow-lg ${error?'border-rose-400/30 bg-rose-950/30':'border-blue-500/25 bg-[#121215]'}`} aria-label={`Tu lugar en la fila: ${positionLabel}. Conductores conectados: ${driversLabel}`}>
   <div className="flex items-center gap-2 border-r border-zinc-800 px-2.5 py-2">
    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${inQueue&&!error?'bg-blue-500/15 text-blue-300':'bg-zinc-800 text-zinc-400'}`}><Hash className="h-4 w-4"/></div>
    <div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[.12em] text-zinc-500">Tu lugar</p><p className="mt-0.5 text-xl font-black tabular-nums leading-none text-white">{positionLabel}</p></div>
   </div>
   <div className="flex items-center gap-2 px-2.5 py-2">
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-500/15 text-cyan-300"><Users className="h-4 w-4"/></div>
    <div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[.12em] text-zinc-500">Conectados</p><p className="mt-0.5 text-xl font-black tabular-nums leading-none text-white">{driversLabel}</p></div>
   </div>
  </section>,host):null;
 return <><DriverTripCancellationControl/>{inlineCard}</>;
};
