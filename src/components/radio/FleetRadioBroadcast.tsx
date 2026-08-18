import React,{useEffect,useMemo,useRef,useState}from'react';
import{createPortal}from'react-dom';
import{CheckCircle2,ChevronDown,ChevronUp,Loader2,Radio,RadioTower,Send,UsersRound,X}from'lucide-react';
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
 const[target,setTarget]=useState<HTMLElement|null>(null);
 const wrapperRef=useRef<HTMLDivElement>(null);
 const connected=useMemo(()=>drivers.filter(driver=>driver.userId&&driver.status!=='offline'),[drivers]);

 useEffect(()=>{
  let owned:HTMLElement|null=null;
  const attach=()=>{
   if(owned?.isConnected)return;
   const heading=Array.from(document.querySelectorAll<HTMLHeadingElement>('h2')).find(element=>element.textContent?.trim()==='Mapa operativo');
   const header=heading?.parentElement?.parentElement?.parentElement;
   if(!header)return;
   const existing=header.querySelector<HTMLElement>('[data-centralgo-fleet-radio-anchor="1"]');
   if(existing){owned=existing;setTarget(existing);return;}
   const mount=document.createElement('div');
   mount.dataset.centralgoFleetRadioAnchor='1';
   mount.className='relative ml-auto shrink-0';
   header.appendChild(mount);
   owned=mount;
   setTarget(mount);
  };
  attach();
  const observer=new MutationObserver(attach);
  observer.observe(document.body,{childList:true,subtree:true});
  return()=>{observer.disconnect();if(owned?.dataset.centralgoFleetRadioAnchor==='1')owned.remove();setTarget(null);};
 },[]);

 useEffect(()=>{
  if(!open)return;
  const closeOutside=(event:PointerEvent)=>{if(wrapperRef.current&&!wrapperRef.current.contains(event.target as Node))setOpen(false);};
  const closeEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};
  document.addEventListener('pointerdown',closeOutside,true);
  window.addEventListener('keydown',closeEscape,true);
  return()=>{document.removeEventListener('pointerdown',closeOutside,true);window.removeEventListener('keydown',closeEscape,true);};
 },[open]);

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

 if(!target)return null;
 return createPortal(
  <div ref={wrapperRef} className="relative">
   <button type="button" onClick={()=>{setOpen(value=>!value);setFeedback(null);}} className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[9px] font-black transition ${open?'border-cyan-400/45 bg-cyan-500/15 text-cyan-100':'border-cyan-500/20 bg-cyan-500/[.07] text-cyan-200'}`} aria-expanded={open} title="Radio general de la flota">
    <RadioTower className={`h-3.5 w-3.5 ${open?'animate-pulse':''}`}/><span>VHF VOZ</span><span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8px] text-emerald-300">{connected.length}</span>{open?<ChevronUp className="h-3 w-3"/>:<ChevronDown className="h-3 w-3"/>}
   </button>
   {open&&<section className="absolute right-0 top-full z-[140] mt-2 w-[min(560px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#08131f]/[.98] shadow-[0_24px_80px_rgba(0,0,0,.58)] backdrop-blur-xl">
    <header className="flex items-center gap-2 border-b border-cyan-400/15 px-3 py-2.5">
     <div className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-500/10 text-cyan-300"><RadioTower className="h-4 w-4"/></div>
     <div className="min-w-0 flex-1"><p className="text-[10px] font-black text-white">Radio general de la flota</p><p className="truncate text-[9px] text-zinc-500">Mensajes rápidos o texto libre a todos los conductores conectados.</p></div>
     <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[8px] font-black text-emerald-300"><UsersRound className="h-3 w-3"/>{connected.length} conectados</span>
     <button type="button" onClick={()=>setOpen(false)} className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-white" aria-label="Cerrar radio general"><X className="h-3.5 w-3.5"/></button>
    </header>
    <div className="p-3">
     <div className="flex flex-wrap gap-1.5">{PRESETS.map(item=><button key={item.label} type="button" disabled={sending||!connected.length} onClick={()=>void transmit(item.message)} className="rounded-lg border border-zinc-800 bg-zinc-950/55 px-2.5 py-1.5 text-[9px] font-bold text-zinc-300 hover:border-cyan-400/30 hover:bg-cyan-500/[.07] hover:text-cyan-100 disabled:opacity-40">{item.label}</button>)}</div>
     <form onSubmit={event=>{event.preventDefault();void transmit(text);}} className="mt-2 flex gap-2">
      <div className="relative min-w-0 flex-1"><Radio className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cyan-400"/><input value={text} onChange={event=>setText(event.target.value)} placeholder="Escribe un mensaje para todos los móviles…" maxLength={280} className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 pl-9 pr-3 text-[10px] text-white outline-none focus:border-cyan-400/40"/></div>
      <button type="submit" disabled={sending||!connected.length||!text.trim()} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-cyan-500 px-3 text-[9px] font-black text-slate-950 disabled:opacity-40">{sending?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Send className="h-3.5 w-3.5"/>}Enviar a todos</button>
     </form>
     {feedback&&<div className={`mt-2 flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[9px] font-bold ${feedback.type==='ok'?'border-emerald-500/20 bg-emerald-500/10 text-emerald-300':'border-rose-500/20 bg-rose-500/10 text-rose-300'}`}>{feedback.type==='ok'&&<CheckCircle2 className="h-3.5 w-3.5"/>}{feedback.text}</div>}
    </div>
   </section>}
  </div>,target
 );
};
