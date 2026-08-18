import React,{useEffect,useMemo,useRef,useState}from'react';
import{Car,Clock3,History,MapPin,Phone,Route,Search,UserRound,X}from'lucide-react';
import{useApp}from'../../context/AppContext';
import{TRIP_STATUS_LABELS}from'../../lib/labels';
import type{Driver,Trip}from'../../types';

const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const searchable=(values:Array<string|undefined>,term:string)=>values.some(value=>normalize(value??'').includes(term));
const tripTimestamp=(trip:Trip)=>new Date(trip.completedAt??trip.createdAt).getTime();

export const OperatorSearchPalette:React.FC=()=>{
 const{trips,drivers,clients,setSelectedTripForDetail}=useApp();
 const[open,setOpen]=useState(false);
 const[query,setQuery]=useState('');
 const inputRef=useRef<HTMLInputElement>(null);

 useEffect(()=>{
  const openSearch=()=>{setOpen(true);window.setTimeout(()=>inputRef.current?.focus(),30);};
  const keyboard=(event:KeyboardEvent)=>{
   if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
    event.preventDefault();event.stopPropagation();openSearch();
   }else if(event.key==='Escape'&&open){event.preventDefault();setOpen(false);}
  };
  window.addEventListener('keydown',keyboard,true);
  window.addEventListener('centralgo:open-operator-search',openSearch);
  return()=>{window.removeEventListener('keydown',keyboard,true);window.removeEventListener('centralgo:open-operator-search',openSearch);};
 },[open]);

 useEffect(()=>{if(!open)setQuery('');},[open]);
 const term=normalize(query);
 const completedResults=useMemo(()=>trips.filter(trip=>trip.status==='completed').filter(trip=>!term||searchable([trip.code,trip.clientName,trip.clientPhone,trip.origin.address,trip.destination.address,trip.driverUnitNumber,trip.driverName,trip.operatorName],term)).sort((a,b)=>tripTimestamp(b)-tripTimestamp(a)).slice(0,9),[trips,term]);
 const activeTripResults=useMemo(()=>term.length<2?[]:trips.filter(trip=>!['completed','cancelled'].includes(trip.status)).filter(trip=>searchable([trip.code,trip.clientName,trip.clientPhone,trip.origin.address,trip.destination.address,trip.driverUnitNumber,trip.driverName,trip.operatorName],term)).sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,5),[trips,term]);
 const driverResults=useMemo(()=>term.length<2?[]:drivers.filter(driver=>searchable([driver.unitNumber,driver.name,driver.phone,driver.currentLocation.address],term)).slice(0,5),[drivers,term]);
 const clientResults=useMemo(()=>term.length<2?[]:clients.filter(client=>searchable([client.name,client.phone,client.email,...client.frequentAddresses.map(address=>address.address)],term)).slice(0,4),[clients,term]);
 const addressResults=useMemo(()=>{
  if(term.length<3)return[];
  const seen=new Set<string>();const values:string[]=[];
  const add=(value?:string)=>{const clean=value?.trim();if(!clean||/^a convenir/i.test(clean))return;const key=normalize(clean);if(!key.includes(term)||seen.has(key))return;seen.add(key);values.push(clean);};
  trips.slice(0,700).forEach(trip=>{add(trip.origin.address);add(trip.destination.address);});
  clients.forEach(client=>client.frequentAddresses.forEach(address=>add(address.address)));
  return values.slice(0,6);
 },[trips,clients,term]);
 const total=completedResults.length+activeTripResults.length+driverResults.length+clientResults.length+addressResults.length;

 const locateDriver=(driver:Driver)=>{
  setOpen(false);
  window.setTimeout(()=>{
   const mapHeading=Array.from(document.querySelectorAll<HTMLElement>('h2')).find(element=>element.textContent?.includes('Mapa operativo'));
   mapHeading?.closest('div[class*="rounded-2xl"]')?.scrollIntoView({behavior:'smooth',block:'center'});
   const marker=Array.from(document.querySelectorAll<HTMLElement>('.custom-taxi-pin')).find(element=>element.textContent?.includes(driver.unitNumber));
   marker?.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  },100);
 };
 const openTrip=(trip:Trip)=>{setSelectedTripForDetail(trip);setOpen(false);};

 if(!open)return null;
 return <div className="fixed inset-0 z-[240] flex items-start justify-center bg-slate-950/72 px-3 pt-[7vh] backdrop-blur-md" onMouseDown={event=>{if(event.currentTarget===event.target)setOpen(false);}}>
  <section className="w-full max-w-3xl overflow-hidden rounded-[24px] border border-cyan-400/25 bg-[#091421]/98 shadow-[0_30px_100px_rgba(0,0,0,.58)]">
   <div className="flex items-center gap-3 border-b border-cyan-400/15 px-4 py-3">
    <History className="h-5 w-5 shrink-0 text-cyan-300"/>
    <div className="min-w-0 flex-1"><input ref={inputRef} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar una carrera realizada: código, cliente, teléfono, dirección o móvil…" className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"/><p className="mt-0.5 text-[9px] text-slate-600">El historial de carreras tiene prioridad. También puedes encontrar móviles y clientes.</p></div>
    <kbd className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[9px] font-black text-slate-400">ESC</kbd>
    <button type="button" onClick={()=>setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Cerrar búsqueda"><X className="h-4 w-4"/></button>
   </div>
   <div className="max-h-[72vh] overflow-y-auto p-3">
    {total===0?<div className="rounded-2xl border border-dashed border-slate-700 px-5 py-10 text-center"><Search className="mx-auto h-5 w-5 text-slate-600"/><p className="mt-3 text-sm font-black text-white">Sin coincidencias</p><p className="mt-1 text-xs text-slate-500">Prueba con parte del nombre, teléfono, código de carrera, móvil o calle.</p></div>:<div className="space-y-3">
     {completedResults.length>0&&<ResultGroup title={term?'Carreras realizadas encontradas':'Últimas carreras realizadas'} count={completedResults.length} featured>{completedResults.map(trip=><button key={trip.id} type="button" onClick={()=>openTrip(trip)} className="cg-search-result"><span className="cg-search-icon"><History className="h-4 w-4"/></span><span className="min-w-0 flex-1 text-left"><strong>{trip.code} · {trip.clientName}</strong><small>{trip.origin.address} → {trip.destination.address}</small></span><span className="hidden shrink-0 text-right sm:block"><span className="block text-[9px] font-black text-emerald-300">FINALIZADA</span><span className="mt-0.5 block text-[8px] text-slate-600"><Clock3 className="mr-1 inline h-3 w-3"/>{new Date(trip.completedAt??trip.createdAt).toLocaleString('es-CL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span></span></button>)}</ResultGroup>}
     {activeTripResults.length>0&&<ResultGroup title="Carreras activas" count={activeTripResults.length}>{activeTripResults.map(trip=><button key={trip.id} type="button" onClick={()=>openTrip(trip)} className="cg-search-result"><span className="cg-search-icon"><Route className="h-4 w-4"/></span><span className="min-w-0 flex-1 text-left"><strong>{trip.code} · {trip.clientName}</strong><small>{trip.origin.address} → {trip.destination.address}</small></span><span className="cg-search-meta">{TRIP_STATUS_LABELS[trip.status]}</span></button>)}</ResultGroup>}
     {driverResults.length>0&&<ResultGroup title="Móviles" count={driverResults.length}>{driverResults.map(driver=><button key={driver.id} type="button" onClick={()=>locateDriver(driver)} className="cg-search-result"><span className="cg-search-icon"><Car className="h-4 w-4"/></span><span className="min-w-0 flex-1 text-left"><strong>{driver.unitNumber} · {driver.name}</strong><small>{driver.currentLocation.address||'Ubicación GPS pendiente'}</small></span><span className="cg-search-meta">{driver.status}</span></button>)}</ResultGroup>}
     {clientResults.length>0&&<ResultGroup title="Clientes" count={clientResults.length}>{clientResults.map(client=><div key={client.id} className="cg-search-result cursor-default"><span className="cg-search-icon"><UserRound className="h-4 w-4"/></span><span className="min-w-0 flex-1"><strong>{client.name}</strong><small><Phone className="mr-1 inline h-3 w-3"/>{client.phone}{client.frequentAddresses[0]?` · ${client.frequentAddresses[0].address}`:''}</small></span></div>)}</ResultGroup>}
     {addressResults.length>0&&<ResultGroup title="Direcciones conocidas" count={addressResults.length}>{addressResults.map(address=><button key={address} type="button" onClick={()=>void navigator.clipboard?.writeText(address)} className="cg-search-result"><span className="cg-search-icon"><MapPin className="h-4 w-4"/></span><span className="min-w-0 flex-1 text-left"><strong>{address}</strong><small>Toca para copiar la dirección</small></span></button>)}</ResultGroup>}
    </div>}
   </div>
  </section>
 </div>;
};

const ResultGroup=({title,count,children,featured=false}:{title:string;count:number;children:React.ReactNode;featured?:boolean})=><section className={featured?'rounded-2xl border border-cyan-400/10 bg-cyan-500/[.025] p-2':''}><div className="mb-1.5 flex items-center justify-between px-1"><h3 className={`text-[9px] font-black uppercase tracking-[.16em] ${featured?'text-cyan-200':'text-cyan-300/80'}`}>{title}</h3><span className="text-[9px] font-bold text-slate-600">{count}</span></div><div className="space-y-1">{children}</div></section>;