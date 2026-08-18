import React,{useMemo,useState}from'react';
import{CheckCircle2,ChevronDown,ChevronUp,Loader2,Radio,RadioTower,Send,UsersRound}from'lucide-react';
import{useApp}from'../../context/AppContext';
import{playVHFRadioChirp,speakVHFDispatch}from'../../lib/audioService';
import{sendDriverRadioBroadcast}from'../../lib/driverOperations';

const PRESETS=[
 {label:'Frecuencia libre',message:'Atención a todos los móviles: mantener la frecuencia libre y permanecer atentos a los despachos de la central.'},
 {label:'Alta demanda',message:'Atención a todos los móviles: alta demanda de carreras. Favor mantenerse disponibles y atentos a nuevas asignaciones.'},
 {label:'Actualizar estado',message:'Atención a todos los móviles: favor actualizar su estado de disponibilidad en la aplicación.'},
 {label:'Reportar ubicación',message:'Atención a todos los móviles: verificar GPS activo y mantener actualizada su ubicación para el despacho.'},
 {label:'Prioridad seguridad',message:'Atención a todos los móviles: mensaje prioritario de central. Mantenerse atentos a nuevas instrucciones de seguridad.'},
];

export const FleetRadioBroadcast:React.FC=()=>{
 const{drivers,currentCompany,addAuditLog,soundMuted}=useApp();
 const[open,setOpen]=useState(false);
 const[text,setText]=useState('');
 const[sending,setSending]=useState(false);
 const[feedback,setFeedback]=useState<{type:'ok'|'error';text:string}|null>(null);
 const connected=useMemo(()=>drivers.filter(driver=>driver.userId&&driver.status!=='offline'),[drivers]);
 const transmit=async(raw:string)=>{
  const message=raw.trim();if(!message||sending)return;
  setSending(true);setFeedback(null);
  try{
   const delivered=await sendDriverRadioBroadcast(currentCompany.id,drivers,message);
   playVHFRadioChirp();if(!soundMuted)speakVHFDispatch(message);
   addAuditLog('TRANSMISION_VHF_GENERAL',`Radio general enviada a ${delivered} móviles: "${message}"`);
   setText('');setFeedback({type:'ok',text:`Mensaje enviado a ${delivered} ${delivered===1?'móvil':'móviles'}.`});
  }catch(error){setFeedback({type:'error',text:error instanceof Error?error.message:'No fue posible enviar el mensaje general.'});}
  finally{setSending(false);}
 };
 return <section className="cg-fleet-radio overflow-hidden rounded-xl border border-cyan-500/20 bg-cyan-500/[.035] shadow-sm">
  <div className="flex flex-wrap items-center gap-2 px-3 py-2">
   <button type="button" onClick={()=>setOpen(value=>!value)} className="flex h-8 items-center gap-2 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2.5 text-[10px] font-black text-cyan-200" aria-expanded={open}>
    <RadioTower className={`h-3.5 w-3.5 ${open?'animate-pulse':''}`}/><span>VHF VOZ</span>{open?<ChevronUp className="h-3.5 w-3.5"/>:<ChevronDown className="h-3.5 w-3.5"/>}
   </button>
   <div className="min-w-0 flex-1"><p className="text-[10px] font-black text-white">Radio general de la flota</p><p className="truncate text-[9px] text-zinc-500">Mensajes rápidos o texto libre a todos los conductores conectados.</p></div>
   <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[9px] font-black text-emerald-300"><UsersRound className="h-3 w-3"/>{connected.length} conectados</span>
  </div>
  {open&&<div className="border-t border-cyan-400/10 px-3 py-3">
   <div className="flex flex-wrap gap-1.5">{PRESETS.map(item=><button key={item.label} type="button" disabled={sending||!connected.length} onClick={()=>void transmit(item.message)} className="rounded-lg border border-zinc-800 bg-zinc-950/55 px-2.5 py-1.5 text-[9px] font-bold text-zinc-300 hover:border-cyan-400/30 hover:bg-cyan-500/[.07] hover:text-cyan-100 disabled:opacity-40">{item.label}</button>)}</div>
   <form onSubmit={event=>{event.preventDefault();void transmit(text);}} className="mt-2 flex gap-2">
    <div className="relative min-w-0 flex-1"><Radio className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cyan-400"/><input value={text} onChange={event=>setText(event.target.value)} placeholder="Escribe un mensaje para todos los móviles…" maxLength={280} className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 pl-9 pr-3 text-[10px] text-white outline-none focus:border-cyan-400/40"/></div>
    <button type="submit" disabled={sending||!connected.length||!text.trim()} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-cyan-500 px-3 text-[10px] font-black text-slate-950 disabled:opacity-40">{sending?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Send className="h-3.5 w-3.5"/>}Enviar a todos</button>
   </form>
   {feedback&&<div className={`mt-2 flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[9px] font-bold ${feedback.type==='ok'?'border-emerald-500/20 bg-emerald-500/10 text-emerald-300':'border-rose-500/20 bg-rose-500/10 text-rose-300'}`}>{feedback.type==='ok'&&<CheckCircle2 className="h-3.5 w-3.5"/>}{feedback.text}</div>}
  </div>}
 </section>;
};