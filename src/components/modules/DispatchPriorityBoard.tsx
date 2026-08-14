import React,{useEffect,useMemo,useState}from'react';
import{ArrowDown,ArrowUp,Loader2,MapPin,ShieldCheck,XCircle,Zap}from'lucide-react';
import{useApp}from'../../context/AppContext';
import{estimateDrivingDistanceKm}from'../../lib/tripDistance';
import{isQueueConnected,loadDispatchQueue,moveDispatchPriority,refreshDispatchRouteMatrix,subscribeDispatchQueue,type DispatchQueueItem}from'../../lib/dispatchPriorityRepository';
import type{Trip}from'../../types';

const activeStatuses=['assigned','en_route','arrived','in_progress'] as const;

export const DispatchPriorityBoard:React.FC=()=>{
 const{currentCompany,trips,assignTrip,cancelTrip}=useApp();
 const[queue,setQueue]=useState<DispatchQueueItem[]>([]);
 const[selectedTripId,setSelectedTripId]=useState('');
 const[busy,setBusy]=useState('');
 const[error,setError]=useState('');
 const load=async(tripId=selectedTripId)=>{if(currentCompany.id==='network')return;try{setQueue(await loadDispatchQueue(currentCompany.id,tripId||undefined));setError('');}catch(err){setError(err instanceof Error?err.message:'No fue posible cargar la prioridad de móviles.');}};
 useEffect(()=>{void load(selectedTripId);if(currentCompany.id==='network')return;return subscribeDispatchQueue(currentCompany.id,()=>void load(selectedTripId));},[currentCompany.id,selectedTripId]);
 const pending=useMemo(()=>trips.filter(t=>t.status==='pending').sort((a,b)=>new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime()),[trips]);
 useEffect(()=>{if(!pending.length){setSelectedTripId('');return;}if(!pending.some(t=>t.id===selectedTripId))setSelectedTripId(pending[0].id);},[pending,selectedTripId]);
 useEffect(()=>{if(!selectedTripId)return;let alive=true;void refreshDispatchRouteMatrix(selectedTripId).then(()=>{window.setTimeout(()=>{if(alive)void load(selectedTripId);},900);}).catch(()=>undefined);return()=>{alive=false;};},[selectedTripId]);
 const selectedTrip=pending.find(t=>t.id===selectedTripId);
 const connected=useMemo(()=>queue.filter(isQueueConnected).sort((a,b)=>a.queueOrder-b.queueOrder||a.unitNumber.localeCompare(b.unitNumber,'es',{numeric:true})),[queue]);
 const activeByDriver=useMemo(()=>new Map(trips.filter(t=>t.driverId&&activeStatuses.includes(t.status as any)).map(t=>[t.driverId as string,t])),[trips]);
 const distanceFor=(item:DispatchQueueItem)=>item.routeDistanceKm??(selectedTrip&&item.lat!=null&&item.lng!=null?estimateDrivingDistanceKm({lat:item.lat,lng:item.lng},selectedTrip.origin):null);
 const move=async(item:DispatchQueueItem,direction:'up'|'down')=>{setBusy(`${item.driverId}:${direction}`);setError('');try{await moveDispatchPriority(item.driverId,direction);await load();}catch(err){setError(err instanceof Error?err.message:'No fue posible modificar la prioridad.');}finally{setBusy('');}};
 const manualAssign=async(item:DispatchQueueItem)=>{if(!selectedTrip||item.status!=='available')return;setBusy(`assign:${item.driverId}`);setError('');try{await assignTrip(selectedTrip.id,item.driverId);}catch(err){setError(err instanceof Error?err.message:'No fue posible asignar la carrera.');}finally{setBusy('');}};
 const cancelDriverTrip=async(item:DispatchQueueItem,trip:Trip)=>{if(!window.confirm(`¿Cancelar ${trip.code} del móvil ${item.unitNumber}?`))return;setBusy(`cancel:${item.driverId}`);setError('');try{await cancelTrip(trip.id,`Cancelada por operadora desde prioridad de móvil ${item.unitNumber}`);}catch(err){setError(err instanceof Error?err.message:'No fue posible cancelar la carrera.');}finally{setBusy('');}};
 if(currentCompany.id==='network')return null;
 return <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0d0f] shadow-xl shadow-black/20 xl:min-h-[650px]">
  <header className="border-b border-zinc-800 px-3 py-3">
   <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-cyan-300"/><h2 className="text-sm font-black text-white">Prioridad equitativa</h2></div><p className="mt-1 text-[10px] leading-relaxed text-zinc-400">Turno + distancia vial real. La operadora puede corregir el orden manualmente.</p></div><div className="shrink-0 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-center"><p className="text-[8px] font-black uppercase tracking-wider text-emerald-300">En línea</p><p className="text-base font-black text-white">{connected.length}</p></div></div>
  </header>
  {error&&<div className="m-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">{error}</div>}
  <div className="p-3">
   <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-zinc-500">Carrera para asignación manual</span><select value={selectedTripId} onChange={e=>setSelectedTripId(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-cyan-400"><option value="">Sin carrera pendiente</option>{pending.map(t=><option key={t.id} value={t.id}>{t.code} · {t.origin.address}</option>)}</select></label>
   {selectedTrip&&<div className="mt-2 rounded-xl border border-cyan-500/15 bg-cyan-500/[0.05] px-3 py-2"><p className="truncate text-[10px] font-bold text-cyan-100">{selectedTrip.origin.address}</p><p className="mt-0.5 truncate text-[9px] text-zinc-500">→ {selectedTrip.destination.address}</p></div>}

   <div className="mt-3 max-h-[490px] space-y-2 overflow-y-auto pr-1">
    {connected.map((item,index)=>{const active=activeByDriver.get(item.driverId);const km=distanceFor(item);const real=item.routeDistanceKm!=null;const zone=km==null?'Sin GPS':km<3?'< 3 km':km<=5?'3–5 km':`${km.toFixed(1)} km`;return <article key={item.driverId} className="rounded-xl border border-zinc-800 bg-zinc-950/55 p-2.5">
     <div className="flex items-start gap-2.5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500 text-sm font-black text-slate-950">#{index+1}</div><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-1.5"><strong className="min-w-0 flex-1 truncate text-xs text-white">{item.unitNumber} · {item.name}</strong><span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black ${item.status==='available'?'bg-emerald-500/10 text-emerald-300':item.status==='in_trip'?'bg-blue-500/10 text-blue-300':'bg-amber-500/10 text-amber-300'}`}>{item.status==='available'?'Libre':item.status==='in_trip'?'En viaje':'Servicio'}</span></div><p className="mt-1 truncate text-[9px] text-zinc-500">{item.locationAddress}</p>{active&&<p className="mt-1 text-[9px] font-bold text-amber-300">Activa: {active.code}</p>}</div></div>
     <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-zinc-800/80 bg-[#0b1119] px-2.5 py-2"><p className="flex min-w-0 items-center gap-1.5 text-[10px] font-black text-zinc-300"><MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-300"/>{zone}</p><p className={`text-right text-[8px] ${real?'font-bold text-emerald-400':'text-zinc-600'}`}>{km==null?'Ubicación pendiente':real?`Vial${item.routeDurationSeconds?` · ~${Math.max(1,Math.round(item.routeDurationSeconds/60))} min`:''}`:'GPS aprox.'}</p></div>
     <div className="mt-2 grid grid-cols-[40px_40px_minmax(0,1fr)] gap-1.5"><button disabled={index===0||Boolean(busy)} onClick={()=>void move(item,'up')} className="grid h-9 place-items-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 disabled:opacity-25" title="Subir prioridad">{busy===`${item.driverId}:up`?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<ArrowUp className="h-3.5 w-3.5"/>}</button><button disabled={index===connected.length-1||Boolean(busy)} onClick={()=>void move(item,'down')} className="grid h-9 place-items-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 disabled:opacity-25" title="Bajar prioridad">{busy===`${item.driverId}:down`?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<ArrowDown className="h-3.5 w-3.5"/>}</button>{active?<button disabled={Boolean(busy)} onClick={()=>void cancelDriverTrip(item,active)} className="flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 text-[9px] font-black text-rose-300"><XCircle className="h-3.5 w-3.5"/>Cancelar carrera</button>:<button disabled={!selectedTrip||item.status!=='available'||Boolean(busy)} onClick={()=>void manualAssign(item)} className="flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg bg-cyan-500 px-2 text-[9px] font-black text-slate-950 disabled:opacity-35"><Zap className="h-3.5 w-3.5"/>Asignar carrera</button>}</div>
    </article>})}
    {!connected.length&&<div className="rounded-xl border border-dashed border-zinc-800 px-3 py-10 text-center"><p className="text-xs font-bold text-zinc-400">Sin móviles conectados</p><p className="mt-1 text-[10px] text-zinc-600">La cola aparecerá aquí cuando los conductores estén en línea.</p></div>}
   </div>

   <div className="mt-3 space-y-1.5 text-[9px] text-zinc-500"><Rule number="1" tone="text-cyan-300" title="Menos de 3 km" text="manda la prioridad de la cola."/><Rule number="2" tone="text-blue-300" title="Hasta 5 km" text="se mantiene la equidad por turno."/><Rule number="3" tone="text-amber-300" title="Sin móviles cerca" text="gana el más cercano por calles; la prioridad desempata."/></div>
  </div>
 </section>;
};

const Rule=({number,tone,title,text}:{number:string;tone:string;title:string;text:string})=><div className="rounded-lg border border-zinc-800 bg-zinc-950/55 px-2.5 py-2"><strong className={tone}>{number}. {title}:</strong> {text}</div>;
