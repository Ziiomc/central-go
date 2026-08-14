import React,{useEffect,useMemo,useState}from'react';
import{useApp}from'../../context/AppContext';
import{isQueueConnected,loadDispatchQueue,subscribeDispatchQueue,type DispatchQueueItem}from'../../lib/dispatchPriorityRepository';

export const DriverPriorityCounter:React.FC=()=>{
 const{currentRole,currentCompany,currentUser}=useApp();
 const[queue,setQueue]=useState<DispatchQueueItem[]>([]);
 const[error,setError]=useState(false);
 const load=async()=>{if(currentRole!=='driver'||currentCompany.id==='network')return;try{setQueue(await loadDispatchQueue(currentCompany.id));setError(false);}catch{setError(true);}};
 useEffect(()=>{void load();if(currentRole!=='driver'||currentCompany.id==='network')return;const unsubscribe=subscribeDispatchQueue(currentCompany.id,()=>void load());const timer=window.setInterval(()=>void load(),30000);return()=>{unsubscribe();window.clearInterval(timer);};},[currentRole,currentCompany.id,currentUser.id]);
 const own=queue.find(item=>item.userId===currentUser.id);
 const connected=useMemo(()=>queue.filter(isQueueConnected).sort((a,b)=>a.queueOrder-b.queueOrder||a.unitNumber.localeCompare(b.unitNumber,'es',{numeric:true})),[queue]);
 if(currentRole!=='driver'||currentCompany.id==='network'||!own)return null;
 const position=connected.findIndex(item=>item.driverId===own.driverId);
 const inQueue=position>=0;
 const value=error?'…':inQueue?`${position+1} de ${connected.length}`:'—';
 return <div className="pointer-events-none fixed top-[calc(env(safe-area-inset-top)+.72rem)] z-[145]" style={{right:'max(4.05rem, calc((100vw - 28rem)/2 + 4.15rem))'}}>
  <div className={`flex h-10 min-w-[72px] items-center justify-center rounded-xl border px-2.5 shadow-md backdrop-blur-xl ${error?'border-rose-400/35 bg-rose-950/90 text-rose-200':inQueue?'border-cyan-400/30 bg-[#0b1b2e]/94 text-white':'border-slate-600/45 bg-[#0b1b2e]/90 text-slate-400'}`}>
   <span className="text-[13px] font-black tabular-nums tracking-tight">{value}</span>
  </div>
 </div>;
};
