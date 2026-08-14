import React,{useEffect,useMemo,useState}from'react';
import{ListOrdered,Wifi,WifiOff}from'lucide-react';
import{useApp}from'../../context/AppContext';
import{isQueueConnected,loadDispatchQueue,subscribeDispatchQueue,type DispatchQueueItem}from'../../lib/dispatchPriorityRepository';

export const DriverPriorityCounter:React.FC=()=>{
 const{currentRole,currentCompany,currentUser}=useApp();
 const[queue,setQueue]=useState<DispatchQueueItem[]>([]);
 const[error,setError]=useState(false);
 const load=async()=>{if(currentRole!=='driver'||currentCompany.id==='network')return;try{setQueue(await loadDispatchQueue(currentCompany.id));setError(false);}catch{setError(true);}};
 useEffect(()=>{void load();if(currentRole!=='driver'||currentCompany.id==='network')return;const unsubscribe=subscribeDispatchQueue(currentCompany.id,()=>void load());const timer=window.setInterval(()=>void load(),60000);return()=>{unsubscribe();window.clearInterval(timer);};},[currentRole,currentCompany.id,currentUser.id]);
 const own=queue.find(item=>item.userId===currentUser.id);
 const connected=useMemo(()=>queue.filter(isQueueConnected).sort((a,b)=>a.queueOrder-b.queueOrder||a.unitNumber.localeCompare(b.unitNumber,'es',{numeric:true})),[queue]);
 if(currentRole!=='driver'||currentCompany.id==='network'||!own)return null;
 const position=connected.findIndex(item=>item.driverId===own.driverId);
 const inQueue=position>=0;
 return <aside className="fixed right-3 top-[calc(env(safe-area-inset-top)+4.6rem)] z-[82] min-w-[132px] rounded-2xl border border-cyan-400/30 bg-[#07111d]/94 px-3 py-2.5 shadow-xl shadow-black/35 backdrop-blur-xl">
  <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500 text-slate-950"><ListOrdered className="h-4 w-4"/></span><div><p className="text-[8px] font-black uppercase tracking-[.15em] text-cyan-300">Cola equitativa</p><p className="text-sm font-black text-white">{inQueue?`#${position+1} de ${connected.length}`:'Fuera de cola'}</p></div></div>
  <p className={`mt-1.5 flex items-center gap-1 text-[8px] font-bold ${error?'text-rose-300':inQueue?'text-emerald-300':'text-zinc-500'}`}>{error?<WifiOff className="h-3 w-3"/>:<Wifi className="h-3 w-3"/>}{error?'Sincronización pendiente':inQueue?'Turno visible en tiempo real':'Pausa, sin señal o no disponible'}</p>
 </aside>;
};
