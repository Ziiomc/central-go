import React,{useEffect,useMemo,useState}from'react';
import{Cake,Keyboard}from'lucide-react';
import{useApp}from'../../context/AppContext';
import{loadDriverExtended}from'../../lib/operationsHistoryRepository';
import{OperatorConsole}from'./OperatorConsole';
import{ScheduledTripsStrip}from'./ScheduledTripsStrip';

export const OperatorWorkspace:React.FC=()=>{
 const{drivers,currentCompany}=useApp();const[birthDates,setBirthDates]=useState<Record<string,string>>({});
 useEffect(()=>{if(currentCompany.id==='network')return;void loadDriverExtended(currentCompany.id).then(rows=>setBirthDates(Object.fromEntries(Object.entries(rows).map(([id,v])=>[id,v.birthDate])))).catch(()=>undefined);},[currentCompany.id,drivers.length]);
 const birthdays=useMemo(()=>{const n=new Date();return drivers.filter(d=>{const b=birthDates[d.id];if(!b)return false;const x=new Date(`${b}T12:00:00`);return x.getMonth()===n.getMonth()&&x.getDate()===n.getDate();});},[drivers,birthDates]);
 return <div className="space-y-3">{birthdays.length>0&&<div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs text-amber-100"><Cake className="mr-2 inline h-4 w-4 text-amber-300"/><strong>Cumpleaños de hoy:</strong> {birthdays.map(d=>`${d.unitNumber} · ${d.name}`).join(', ')}</div>}<div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-[#0d0d0f] px-3 py-2 text-[9px] text-zinc-500"><span className="mr-1 flex items-center gap-1.5 font-black uppercase tracking-wider text-zinc-400"><Keyboard className="h-3.5 w-3.5 text-amber-300"/>Comandos rápidos</span><Shortcut keys="F2" label="Nueva carrera"/><Shortcut keys="F3" label="Cambiar vista de cola"/><Shortcut keys="Ctrl K" label="Buscar pedido / móvil"/><Shortcut keys="Esc" label="Cerrar menús"/></div><ScheduledTripsStrip/><OperatorConsole/></div>;
};
const Shortcut=({keys,label}:{keys:string;label:string})=><span className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1"><kbd className="mr-1 font-black text-amber-300">{keys}</kbd>{label}</span>;
