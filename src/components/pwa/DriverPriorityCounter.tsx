import React,{useEffect,useMemo,useState}from'react';
import{createPortal}from'react-dom';
import{Users,Hash}from'lucide-react';
import{useApp}from'../../context/AppContext';
import{isQueueConnected,loadDispatchQueue,subscribeDispatchQueue,type DispatchQueueItem}from'../../lib/dispatchPriorityRepository';
import{DriverTripCancellationControl}from'./DriverTripCancellationControl';

const ACTIVE_TRIP_STATUSES=new Set(['assigned','en_route','arrived','in_progress']);

export const DriverPriorityCounter:React.FC=()=>{
 const{currentRole,currentCompany,currentUser,drivers,trips}=useApp();
 const[queue,setQueue]=useState<DispatchQueueItem[]>([]);
 const[error,setError]=useState(false);
 const[host,setHost]=useState<HTMLElement|null>(null);
 const load=async()=>{if(currentRole!=='driver'||currentCompany.id==='network')return;try{setQueue(await loadDispatchQueue(currentCompany.id));setError(false);}catch{setError(true);}};
 useEffect(()=>{void load();if(currentRole!=='driver'||currentCompany.id==='network')return;const unsubscribe=subscribeDispatchQueue(currentCompany.id,()=>void load());const timer=window.setInterval(()=>void load(),30000);return()=>{unsubscribe();window.clearInterval(timer);};},[currentRole,currentCompany.id,currentUser.id]);
 useEffect(()=>{
  if(currentRole!=='driver')return;
  let mount:HTMLDivElement|null=null;
  const attach=()=>{
   const container=document.querySelector('.cg-driver-app > div.relative.mx-auto.max-w-md');
   const header=container?.querySelector(':scope > header');
   if(!container||!header)return false;
   mount=document.createElement('div');
   mount.dataset.driverQueuePosition='inline';
   header.insertAdjacentElement('afterend',mount);
   setHost(mount);
   return true;
  };
  if(!attach()){
   const timer=window.setTimeout(()=>void attach(),0);
   return()=>{window.clearTimeout(timer);mount?.remove();setHost(null);};
  }
  return()=>{mount?.remove();setHost(null);};
 },[currentRole]);
 const own=queue.find(item=>item.userId===currentUser.id);
 const connected=useMemo(()=>queue.filter(isQueueConnected).sort((a,b)=>a.queueOrder-b.queueOrder||a.unitNumber.localeCompare(b.unitNumber,'es',{numeric:true})),[queue]);
 if(currentRole!=='driver'||currentCompany.id==='network')return null;
 const driverId=drivers.find(item=>item.userId===currentUser.id)?.id;
 const activeTrip=trips.some(trip=>trip.driverId===driverId&&ACTIVE_TRIP_STATUSES.has(trip.status));
 const position=own?connected.findIndex(item=>item.driverId===own.driverId):-1;
 const inQueue=position>=0;
 const positionLabel=error?'…':inQueue?String(position+1):'—';
 const driversLabel=error?'…':String(connected.length);
 const inlineCard=own&&!activeTrip&&host?createPortal(
  <section className={`grid grid-cols-2 overflow-hidden rounded-xl border shadow-lg ${error?'border-rose-400/30 bg-rose-950/30':'border-blue-500/20 bg-[#121215]'}`} aria-label="Posición en la fila">
   <div className="flex items-center gap-2.5 border-r border-zinc-800 px-3 py-2.5">
    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${inQueue&&!error?'bg-blue-500/15 text-blue-300':'bg-zinc-800 text-zinc-400'}`}><Hash className="h-4 w-4"/></div>
    <div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[.12em] text-zinc-500">Tu posición en la fila</p><p className="mt-0.5 text-lg font-black tabular-nums leading-none text-white">{positionLabel}</p></div>
   </div>
   <div className="flex items-center gap-2.5 px-3 py-2.5">
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-500/15 text-cyan-300"><Users className="h-4 w-4"/></div>
    <div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[.12em] text-zinc-500">Conductores en fila</p><p className="mt-0.5 text-lg font-black tabular-nums leading-none text-white">{driversLabel}</p></div>
   </div>
  </section>,host):null;
 return <><DriverTripCancellationControl/>{inlineCard}</>;
};
