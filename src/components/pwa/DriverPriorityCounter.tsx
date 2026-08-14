import React,{useEffect,useMemo,useState}from'react';
import{ListOrdered,Wifi,WifiOff}from'lucide-react';
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
 const place=inQueue?position+1:null;
 const total=connected.length;
 const label=inQueue?`${place} de ${total}`:'Fuera';
 return <>
  <div className="fixed top-[calc(env(safe-area-inset-top)+.72rem)] z-[145]" style={{right:'max(3.65rem, calc((100vw - 28rem)/2 + 3.75rem))'}}>
   <div className={`flex h-10 items-center gap-2 rounded-xl border px-2.5 shadow-lg backdrop-blur-xl ${error?'border-rose-300/60 bg-rose-50/95 text-rose-800':inQueue?'border-cyan-300/70 bg-white/95 text-slate-900':'border-slate-300 bg-white/90 text-slate-500'}`}>
    <ListOrdered className={`h-4 w-4 ${inQueue?'text-cyan-600':'text-slate-400'}`}/>
    <div className="leading-none"><p className="text-[8px] font-black uppercase tracking-wider text-slate-500">Turno</p><p className="mt-1 text-[12px] font-black tabular-nums">{label}</p></div>
   </div>
  </div>
  <aside className="fixed right-3 top-[calc(env(safe-area-inset-top)+4.65rem)] z-[82] w-[168px] rounded-2xl border border-cyan-400/35 bg-[#071827]/96 p-3 shadow-2xl shadow-slate-950/35 backdrop-blur-xl">
   <div className="flex items-center gap-2"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20"><ListOrdered className="h-4 w-4"/></span><div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[.15em] text-cyan-300">Cola equitativa</p><p className="mt-0.5 text-[18px] font-black leading-none text-white tabular-nums">{inQueue?`${place} de ${total}`:'Fuera de cola'}</p></div></div>
   <p className={`mt-2 flex items-center gap-1 text-[9px] font-bold ${error?'text-rose-300':inQueue?'text-emerald-300':'text-slate-400'}`}>{error?<WifiOff className="h-3 w-3"/>:<Wifi className="h-3 w-3"/>}{error?'Sincronización pendiente':inQueue?place===1?'Eres el próximo por prioridad':'Tu turno se actualiza en tiempo real':'Pausa, sin señal o no disponible'}</p>
  </aside>
 </>;
};
