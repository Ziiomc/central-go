import React,{useEffect,useMemo,useState}from'react';
import{BarChart3,Cake,Keyboard}from'lucide-react';
import{Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis}from'recharts';
import{useApp}from'../../context/AppContext';
import{loadDriverExtended}from'../../lib/operationsHistoryRepository';
import{OperatorConsole}from'./OperatorConsole';
import{ScheduledTripsStrip}from'./ScheduledTripsStrip';
import{DispatchPriorityBoard}from'./DispatchPriorityBoard';
import{DesktopInstallButton}from'../pwa/DesktopInstallButton';

export const OperatorWorkspace:React.FC=()=>{
 const{drivers,trips,currentCompany,currentRole}=useApp();const[birthDates,setBirthDates]=useState<Record<string,string>>({});
 useEffect(()=>{if(currentCompany.id==='network')return;void loadDriverExtended(currentCompany.id).then(rows=>setBirthDates(Object.fromEntries(Object.entries(rows).map(([id,v])=>[id,v.birthDate])))).catch(()=>undefined);},[currentCompany.id,drivers.length]);
 const birthdays=useMemo(()=>{const n=new Date();return drivers.filter(d=>{const b=birthDates[d.id];if(!b)return false;const x=new Date(`${b}T12:00:00`);return x.getMonth()===n.getMonth()&&x.getDate()===n.getDate();});},[drivers,birthDates]);
 const today=useMemo(()=>{const start=new Date();start.setHours(0,0,0,0);return trips.filter(t=>new Date(t.createdAt)>=start);},[trips]);
 const hourly=useMemo(()=>Array.from({length:24},(_,hour)=>{const rows=today.filter(t=>new Date(t.createdAt).getHours()===hour);return{hour:`${String(hour).padStart(2,'0')}h`,carreras:rows.length,monto:rows.filter(t=>t.status==='completed').reduce((s,t)=>s+(t.finalFare??t.estimatedFare??0),0)};}).filter((row,i)=>row.carreras||i>=new Date().getHours()-5&&i<=new Date().getHours()),[today]);
 const byDriver=useMemo(()=>drivers.map(d=>{const own=today.filter(t=>t.driverId===d.id),done=own.filter(t=>t.status==='completed');return{movil:d.unitNumber,carreras:done.length,efectividad:own.length?Math.round(done.length/own.length*100):0};}).filter(d=>d.carreras>0).sort((a,b)=>b.carreras-a.carreras).slice(0,12),[drivers,today]);
 return <div className="space-y-3">{birthdays.length>0&&<div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs text-amber-100"><Cake className="mr-2 inline h-4 w-4 text-amber-300"/><strong>Cumpleaños de hoy:</strong> {birthdays.map(d=>`${d.unitNumber} · ${d.name}`).join(', ')}</div>}{currentRole==='company_admin'&&<section className="grid gap-3 xl:grid-cols-2"><PerformanceChart title="Actividad diaria" data={hourly} dataKey="carreras"/><PerformanceChart title="Carreras por conductor" data={byDriver} dataKey="carreras" xKey="movil"/></section>}<div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-[#0d0d0f] px-3 py-2 text-[9px] text-zinc-500"><span className="mr-1 flex items-center gap-1.5 font-black uppercase tracking-wider text-zinc-400"><Keyboard className="h-3.5 w-3.5 text-zinc-300"/>Comandos rápidos</span><Shortcut keys="F2" label="Nueva carrera"/><Shortcut keys="F3" label="Cambiar vista de cola"/><Shortcut keys="Ctrl K" label="Buscar pedido / móvil"/><Shortcut keys="Esc" label="Cerrar menús"/><div className="ml-auto"><DesktopInstallButton/></div></div><ScheduledTripsStrip/><DispatchPriorityBoard/><OperatorConsole/></div>;
};
const Shortcut=({keys,label}:{keys:string;label:string})=><span className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1"><kbd className="mr-1 font-black text-amber-300">{keys}</kbd>{label}</span>;
const PerformanceChart=({title,data,dataKey,xKey='hour'}:{title:string;data:Array<Record<string,string|number>>;dataKey:string;xKey?:string})=><div className="cg-card p-3"><h2 className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-zinc-300"><BarChart3 className="h-4 w-4"/>{title}</h2><ResponsiveContainer width="100%" height={125}><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,.15)"/><XAxis dataKey={xKey} tick={{fontSize:8,fill:'#9ca3af'}}/><YAxis tick={{fontSize:8,fill:'#9ca3af'}}/><Tooltip/><Bar dataKey={dataKey} fill="#b9bec5" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>;
