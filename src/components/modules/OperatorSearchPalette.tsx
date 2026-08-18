import React,{useEffect,useMemo,useRef,useState}from'react';
import{Car,Clock3,MapPin,Phone,Route,Search,UserRound,X}from'lucide-react';
import{useApp}from'../../context/AppContext';
import{TRIP_STATUS_LABELS}from'../../lib/labels';
import type{Driver,Trip}from'../../types';

const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const searchable=(values:Array<string|undefined>,term:string)=>values.some(value=>normalize(value??'').includes(term));

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
 const tripResults=useMemo(()=>term.length<2?[]:trips.filter(trip=>searchable([trip.code,trip.clientName,trip.clientPhone,trip.origin.address,trip.destination.address,trip.driverUnitNumber,trip.driverName,trip.operatorName],term)).slice(0,7),[trips,term]);
 const driverResults=useMemo(()=>term.length<2?[]:drivers.filter(driver=>searchable([driver.unitNumber,driver.name,driver.phone,driver.currentLocation.address],term)).slice(0,6),[drivers,term]);
 const clientResults=useMemo(()=>term.length<2?[]:clients.filter(client=>searchable([client.name,client.phone,client.email,...client.frequentAddresses.map(address=>address.address)],term)).slice(0,5),[clients,term]);
 const addressResults=useMemo(()=>{
  if(term.length<3)return[];
  const seen=new Set<string>();const values:string[]=[];
  const add=(value?:string)=>{const clean=value?.trim();if(!clean||/^a convenir/i.test(clean))return;const key=normalize(clean);if(!key.includes(term)||seen.has(key))return;seen.add(key);values.push(clean);};
  trips.slice(0,700).forEach(trip=>{add(trip.origin.address);add(trip.destination.address);});
  clients.forEach(client=>client.frequentAddresses.forEach(address=>add(address.address)));
  return values.slice(0,7);
 },[trips,clients,term]);
 const total=tripResults.length+driverResults.length+clientResults.length+addressResults.length;

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
 return <div className="fixed inset-0 z-[240] flex items-start justify-center bg-slate-950/72 px-3 pt-[9vh] backdrop-blur-md" onMouseDown={event=>{if(event.currentTarget===event.target)setOpen(false);}}>
  <section className="w-full max-w-3xl overflow-hidden rounded-[24px] border border-cyan-400/25 bg-[#091421]/98 shadow-[0_30px_100px_rgba(0,0,0,.58)]">
   <div className="flex items-center gap-3 border-b border-cyan-400/15 px-4 py-3">
    <Search className="h-5 w-5 shrink-0 text-cyan-300"/>
    <input ref={inputRef} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Carrera, móvil, cliente, teléfono o dirección…" className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"/>
    <kbd className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[9px] font-black text-slate-400">ESC</kbd>
    <button type="button" onClick={()=>setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Cerrar búsqueda"><X className="h-4 w-4"/></button>
   </div>
   <div className="max-h-[68vh] overflow-y-auto p-3">
    {term.length<2?<SearchHint/>:total===0?<div className="rounded-2xl border border-dashed border-slate-700 px-5 py-10 text-center"><p className="text-sm font-black text-white">Sin coincidencias</p><p className="mt-1 text-xs text-slate-500">Prueba con parte del nombre, número de móvil, teléfono, código o calle.</p></div>:<div className="space-y-3">
     {tripResults.length>0&&<ResultGroup title="Carreras" count={tripResults.length}>{tripResults.map(trip=><button key={trip.id} type="button" onClick={()=>openTrip(trip)} className="cg-search-result"><span className="cg-search-icon"><Route className="h-4 w-4"/></span><span className="min-w-0 flex-1 text-left"><strong>{trip.code} · {trip.clientName}</strong><small>{trip.origin.address} → {trip.destination.address}</small></span><span className="cg-search-meta">{TRIP_STATUS_LABELS[trip.status]}</span></button>)}</ResultGroup>}
     {driverResults.length>0&&<ResultGroup title="Móviles" count={driverResults.length}>{driverResults.map(driver=><button key={driver.id} type="button" onClick={()=>locateDriver(driver)} className="cg-search-result"><span className="cg-search-icon"><Car className="h-4 w-4"/></span><span className="min-w-0 flex-1 text-left"><strong>{driver.unitNumber} · {driver.name}</strong><small>{driver.currentLocation.address||'Ubicación GPS pendiente'}</small></span><span className="cg-search-meta">{driver.status}</span></button>)}</ResultGroup>}
     {clientResults.length>0&&<ResultGroup title="Clientes" count={clientResults.length}>{clientResults.map(client=><div key={client.id} className="cg-search-result cursor-default"><span className="cg-search-icon"><UserRound className="h-4 w-4"/></span><span className="min-w-0 flex-1"><strong>{client.name}</strong><small><Phone className="mr-1 inline h-3 w-3"/>{client.phone}{client.frequentAddresses[0]?` · ${client.frequentAddresses[0].address}`:''}</small></span></div>)}</ResultGroup>}
     {addressResults.length>0&&<ResultGroup title="Direcciones conocidas" count={addressResults.length}>{addressResults.map(address=><button key={address} type="button" onClick={()=>void navigator.clipboard?.writeText(address)} className="cg-search-result"><span className="cg-search-icon"><MapPin className="h-4 w-4"/></span><span className="min-w-0 flex-1 text-left"><strong>{address}</strong><small>Toca para copiar la dirección</small></span></button>)}</ResultGroup>}
    </div>}
   </div>
  </section>
 </div>;
};

const ResultGroup=({title,count,children}:{title:string;count:number;children:React.ReactNode})=><section><div className="mb-1.5 flex items-center justify-between px-1"><h3 className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-300/80">{title}</h3><span className="text-[9px] font-bold text-slate-600">{count}</span></div><div className="space-y-1">{children}</div></section>;
const SearchHint=()=> <div className="grid gap-2 sm:grid-cols-3"><Hint icon={Route} title="Carreras" text="Código, pasajero, origen o destino"/><Hint icon={Car} title="Móviles" text="Número, conductor o ubicación"/><Hint icon={MapPin} title="Direcciones" text="Historial y domicilios frecuentes"/></div>;
const Hint=({icon:Icon,title,text}:{icon:React.ComponentType<{className?:string}>;title:string;text:string})=><div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4"><Icon className="h-4 w-4 text-cyan-300"/><p className="mt-3 text-xs font-black text-white">{title}</p><p className="mt-1 text-[10px] leading-relaxed text-slate-500">{text}</p></div>;
