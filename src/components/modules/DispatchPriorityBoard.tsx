import React,{useEffect,useMemo,useState}from'react';
import{ArrowDown,ArrowUp,Loader2,LocateFixed,ShieldCheck,XCircle,Zap}from'lucide-react';
import{useApp}from'../../context/AppContext';
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
 const move=async(item:DispatchQueueItem,direction:'up'|'down')=>{setBusy(`${item.driverId}:${direction}`);setError('');try{await moveDispatchPriority(item.driverId,direction);await load();}catch(err){setError(err instanceof Error?err.message:'No fue posible modificar la prioridad.');}finally{setBusy('');}};
 const manualAssign=async(item:DispatchQueueItem)=>{if(!selectedTrip||item.status!=='available')return;setBusy(`assign:${item.driverId}`);setError('');try{await assignTrip(selectedTrip.id,item.driverId);}catch(err){setError(err instanceof Error?err.message:'No fue posible asignar la carrera.');}finally{setBusy('');}};
 const cancelDriverTrip=async(item:DispatchQueueItem,trip:Trip)=>{if(!window.confirm(`¿Cancelar ${trip.code} del móvil ${item.unitNumber}?`))return;setBusy(`cancel:${item.driverId}`);setError('');try{await cancelTrip(trip.id,`Cancelada por operadora desde prioridad de móvil ${item.unitNumber}`);}catch(err){setError(err instanceof Error?err.message:'No fue posible cancelar la carrera.');}finally{setBusy('');}};
 const cancelPendingTrip=async()=>{if(!selectedTrip)return;if(!window.confirm(`¿Cancelar la carrera pendiente ${selectedTrip.code}? Todavía no tiene móvil asignado.`))return;setBusy(`cancel-pending:${selectedTrip.id}`);setError('');try{await cancelTrip(selectedTrip.id,'Cancelada por la central antes de asignar un móvil');setSelectedTripId('');await load('');}catch(err){setError(err instanceof Error?err.message:'No fue posible cancelar la carrera pendiente.');}finally{setBusy('');}};
 const locateDriver=(item:DispatchQueueItem)=>window.dispatchEvent(new CustomEvent('centralgo:locate-driver',{detail:{driverId:item.driverId,unitNumber:item.unitNumber,name:item.name}}));
 if(currentCompany.id==='network')return null;
 return <section className="cg-priority-board overflow-hidden rounded-[20px] border border-white/[0.07] bg-[linear-gradient(180deg,#111217_0%,#0b0c10_100%)] shadow-[0_24px_80px_rgba(0,0,0,.28)] xl:min-h-[650px]">
  <header className="border-b border-white/[0.06] bg-white/[0.015] px-3.5 py-3.5">
   <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="flex items-center gap-2"><div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.08]"><ShieldCheck className="h-3.5 w-3.5 text-cyan-300"/></div><div><h2 className="text-sm font-black tracking-tight text-white">Prioridad equitativa</h2><p className="mt-0.5 text-[9px] font-medium text-zinc-500">Orden operativo de conductores</p></div></div></div><div className="flex shrink-0 items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]"/><div><p className="text-[7px] font-black uppercase tracking-[.16em] text-emerald-300/80">En línea</p><p className="text-sm font-black leading-none text-white">{connected.length}</p></div></div></div>
  </header>
  {error&&<div className="mx-3 mt-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.08] px-3 py-2 text-[10px] font-medium text-rose-200">{error}</div>}
  <div className="p-3">
   <label className="block"><span className="mb-1.5 block text-[8px] font-black uppercase tracking-[.14em] text-zinc-600">Carrera para asignación manual</span><select value={selectedTripId} onChange={e=>setSelectedTripId(e.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 text-[11px] font-bold text-zinc-100 outline-none transition focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10"><option value="">Sin carrera pendiente</option>{pending.map(t=><option key={t.id} value={t.id}>{t.code} · {t.origin.address}</option>)}</select></label>
   {selectedTrip&&<div className="mt-2 rounded-xl border border-cyan-400/10 bg-cyan-400/[0.035] px-3 py-2"><div className="flex items-center gap-2"><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold text-cyan-50">{selectedTrip.origin.address}</p><p className="mt-0.5 truncate text-[8px] text-zinc-600">→ {selectedTrip.destination.address}</p></div><button type="button" disabled={Boolean(busy)} onClick={()=>void cancelPendingTrip()} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-2 py-1.5 text-[8px] font-black text-rose-300 transition hover:bg-rose-400/10 disabled:opacity-40" title="Cancelar carrera pendiente"><XCircle className="h-3 w-3"/>{busy===`cancel-pending:${selectedTrip.id}`?<Loader2 className="h-3 w-3 animate-spin"/>:'Cancelar'}</button></div></div>}

   <div className="mt-2.5 max-h-[540px] space-y-1.5 overflow-y-auto pr-1 [scrollbar-color:#27272a_transparent] [scrollbar-width:thin]">
    {connected.map((item,index)=>{const active=activeByDriver.get(item.driverId);const available=item.status==='available';const statusLabel=available?'Libre':item.status==='in_trip'?'En viaje':'En servicio';return <article key={item.driverId} className={`cg-priority-item relative overflow-hidden rounded-xl border ${index===0?'is-first border-cyan-400/25 bg-cyan-400/[0.055]':'border-white/[0.06] bg-white/[0.018]'}`}>
     {index===0&&<span className="absolute inset-y-2 left-0 w-[2px] rounded-r-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,.6)]"/>}
     <div className="cg-priority-main flex min-w-0 items-center gap-2 px-2.5 pt-2 pb-1.5">
      <div className="cg-priority-rank grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-black/20 text-[10px] font-black tabular-nums text-zinc-400">{String(index+1).padStart(2,'0')}</div>
      <button type="button" onClick={()=>locateDriver(item)} className="cg-priority-driver min-w-0 flex-1 rounded-lg px-1 py-1 text-left" title={`Ubicar móvil ${item.unitNumber} en el mapa`}>
       <div className="flex min-w-0 items-center gap-1.5"><span className="shrink-0 text-[11px] font-black text-cyan-300">Móvil {item.unitNumber}</span><LocateFixed className="h-3 w-3 shrink-0 text-zinc-600"/></div>
       <p className="mt-0.5 truncate text-[9px] font-semibold text-zinc-300">{item.name||'Conductor sin nombre'}</p>
      </button>
      <span className={`cg-priority-status inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[8px] font-black ${available?'border-emerald-500/20 bg-emerald-500/10 text-emerald-300':item.status==='in_trip'?'border-blue-500/20 bg-blue-500/10 text-blue-300':'border-amber-500/20 bg-amber-500/10 text-amber-300'}`}><span className={`h-1.5 w-1.5 rounded-full ${available?'bg-emerald-400':item.status==='in_trip'?'bg-blue-400':'bg-amber-400'}`}/>{statusLabel}</span>
     </div>
     {active&&<div className="px-11 pb-1 text-[7px] font-bold uppercase tracking-wide text-amber-300/75">Carrera {active.code}</div>}
     <div className="cg-priority-actions flex items-center gap-1.5 border-t border-white/[0.05] px-2.5 py-2">
      {active?<button disabled={Boolean(busy)} onClick={()=>void cancelDriverTrip(item,active)} className="cg-priority-primary-action flex h-7 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/[0.07] px-2 text-[8px] font-black text-rose-300 disabled:opacity-35"><XCircle className="h-3 w-3"/>{busy===`cancel:${item.driverId}`?<Loader2 className="h-3 w-3 animate-spin"/>:'Cancelar carrera'}</button>:<button disabled={!selectedTrip||!available||Boolean(busy)} onClick={()=>void manualAssign(item)} className="cg-priority-primary-action flex h-7 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.07] px-2 text-[8px] font-black text-cyan-200 disabled:border-white/[0.05] disabled:bg-white/[0.015] disabled:text-zinc-600"><Zap className="h-3 w-3"/>{busy===`assign:${item.driverId}`?<Loader2 className="h-3 w-3 animate-spin"/>:selectedTrip?`Asignar a móvil ${item.unitNumber}`:'Selecciona una carrera'}</button>}
      <button disabled={index===0||Boolean(busy)} onClick={()=>void move(item,'up')} className="cg-priority-move grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-black/20 text-zinc-500 disabled:pointer-events-none disabled:opacity-20" title="Subir prioridad">{busy===`${item.driverId}:up`?<Loader2 className="h-3 w-3 animate-spin"/>:<ArrowUp className="h-3 w-3"/>}</button>
      <button disabled={index===connected.length-1||Boolean(busy)} onClick={()=>void move(item,'down')} className="cg-priority-move grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-black/20 text-zinc-500 disabled:pointer-events-none disabled:opacity-20" title="Bajar prioridad">{busy===`${item.driverId}:down`?<Loader2 className="h-3 w-3 animate-spin"/>:<ArrowDown className="h-3 w-3"/>}</button>
     </div>
    </article>})}
    {!connected.length&&<div className="rounded-xl border border-dashed border-white/[0.07] bg-white/[0.01] px-3 py-10 text-center"><p className="text-[11px] font-bold text-zinc-400">Sin móviles conectados</p><p className="mt-1 text-[9px] text-zinc-600">La cola aparecerá aquí cuando los conductores estén en línea.</p></div>}
   </div>

   <div className="mt-3 grid gap-1.5 text-[8px] text-zinc-600"><Rule number="1" tone="text-cyan-300" title="Menos de 3 km" text="manda la prioridad de la cola."/><Rule number="2" tone="text-blue-300" title="Hasta 5 km" text="se mantiene la equidad por turno."/><Rule number="3" tone="text-amber-300" title="Sin móviles cerca" text="gana el más cercano por calles; la prioridad desempata."/></div>
  </div>
 </section>;
};

const Rule=({number,tone,title,text}:{number:string;tone:string;title:string;text:string})=><div className="rounded-lg border border-white/[0.05] bg-white/[0.015] px-2.5 py-1.5"><strong className={tone}>{number}. {title}:</strong> {text}</div>;
