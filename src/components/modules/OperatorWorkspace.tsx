import React,{useEffect,useMemo,useState}from'react';
import{BarChart3,Cake,CheckCircle2,DollarSign,Gauge,Keyboard,UsersRound}from'lucide-react';
import{Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis}from'recharts';
import{useApp}from'../../context/AppContext';
import{loadDriverExtended}from'../../lib/operationsHistoryRepository';
import{OperatorConsole}from'./OperatorConsole';
import{ScheduledTripsStrip}from'./ScheduledTripsStrip';
import{DispatchPriorityBoard}from'./DispatchPriorityBoard';
import{DesktopInstallButton}from'../pwa/DesktopInstallButton';

export const OperatorWorkspace:React.FC=()=>{
 const{drivers,trips,currentCompany,currentRole}=useApp();
 const[birthDates,setBirthDates]=useState<Record<string,string>>({});
 useEffect(()=>{if(currentCompany.id==='network')return;void loadDriverExtended(currentCompany.id).then(rows=>setBirthDates(Object.fromEntries(Object.entries(rows).map(([id,v])=>[id,v.birthDate])))).catch(()=>undefined);},[currentCompany.id,drivers.length]);
 const birthdays=useMemo(()=>{const n=new Date();return drivers.filter(d=>{const b=birthDates[d.id];if(!b)return false;const x=new Date(`${b}T12:00:00`);return x.getMonth()===n.getMonth()&&x.getDate()===n.getDate();});},[drivers,birthDates]);
 const today=useMemo(()=>{const start=new Date();start.setHours(0,0,0,0);return trips.filter(t=>new Date(t.createdAt)>=start);},[trips]);
 const completedToday=useMemo(()=>today.filter(t=>t.status==='completed'),[today]);
 const totalRevenue=useMemo(()=>completedToday.reduce((s,t)=>s+(t.finalFare??t.estimatedFare??0),0),[completedToday]);
 const effectiveness=today.length?Math.round(completedToday.length/today.length*100):0;
 const hourly=useMemo(()=>Array.from({length:24},(_,hour)=>{const rows=today.filter(t=>new Date(t.createdAt).getHours()===hour);return{hour:`${String(hour).padStart(2,'0')}h`,carreras:rows.length,monto:rows.filter(t=>t.status==='completed').reduce((s,t)=>s+(t.finalFare??t.estimatedFare??0),0)};}).filter((row,i)=>row.carreras||i>=new Date().getHours()-5&&i<=new Date().getHours()),[today]);
 const byDriver=useMemo(()=>drivers.map(d=>{const own=today.filter(t=>t.driverId===d.id),done=own.filter(t=>t.status==='completed');return{movil:d.unitNumber,carreras:done.length,efectividad:own.length?Math.round(done.length/own.length*100):0};}).filter(d=>d.carreras>0).sort((a,b)=>b.carreras-a.carreras).slice(0,10),[drivers,today]);
 return <div className="cg-operator-workspace space-y-3">
  {birthdays.length>0&&<div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs text-amber-100"><Cake className="mr-2 inline h-4 w-4 text-amber-300"/><strong>Cumpleaños de hoy:</strong> {birthdays.map(d=>`${d.unitNumber} · ${d.name}`).join(', ')}</div>}
  {currentRole==='company_admin'&&<OperationsOverview hourly={hourly} byDriver={byDriver} completed={completedToday.length} revenue={totalRevenue} effectiveness={effectiveness} activeDrivers={drivers.filter(d=>d.status!=='offline').length}/>} 
  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-[#0d0d0f] px-3 py-2 text-[9px] text-zinc-500"><span className="mr-1 flex items-center gap-1.5 font-black uppercase tracking-wider text-zinc-400"><Keyboard className="h-3.5 w-3.5 text-zinc-300"/>Comandos rápidos</span><Shortcut keys="F2" label="Nueva carrera"/><Shortcut keys="F3" label="Cambiar vista de cola"/><Shortcut keys="Ctrl K" label="Buscar pedido / móvil"/><Shortcut keys="Esc" label="Cerrar menús"/><div className="ml-auto"><DesktopInstallButton/></div></div>
  <ScheduledTripsStrip/>
  <div className="grid items-start gap-3 xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)]">
   <aside className="min-w-0 xl:sticky xl:top-2"><DispatchPriorityBoard/></aside>
   <div className="min-w-0"><OperatorConsole/></div>
  </div>
 </div>;
};

const Shortcut=({keys,label}:{keys:string;label:string})=><span className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1"><kbd className="mr-1 font-black text-amber-300">{keys}</kbd>{label}</span>;

const OperationsOverview=({hourly,byDriver,completed,revenue,effectiveness,activeDrivers}:{hourly:Array<Record<string,string|number>>;byDriver:Array<Record<string,string|number>>;completed:number;revenue:number;effectiveness:number;activeDrivers:number})=><section className="cg-card overflow-hidden p-0">
 <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
  <div><h2 className="flex items-center gap-2 text-sm font-black text-white"><BarChart3 className="h-4 w-4 text-cyan-300"/>Actividad operativa</h2><p className="mt-0.5 text-[10px] text-zinc-400">Resumen del turno y distribución de carreras por conductor.</p></div>
  <div className="flex flex-wrap gap-2"><MiniKpi icon={CheckCircle2} label="Finalizadas" value={String(completed)}/><MiniKpi icon={Gauge} label="Efectividad" value={`${effectiveness}%`}/><MiniKpi icon={UsersRound} label="Conectados" value={String(activeDrivers)}/><MiniKpi icon={DollarSign} label="Facturación" value={`$${Math.round(revenue).toLocaleString('es-CL')}`}/></div>
 </div>
 <div className="grid gap-0 xl:grid-cols-[1.35fr_.85fr]">
  <ChartPanel title="Actividad diaria" data={hourly} dataKey="carreras" xKey="hour"/>
  <ChartPanel title="Carreras por conductor" data={byDriver} dataKey="carreras" xKey="movil" bordered/>
 </div>
</section>;

const MiniKpi=({icon:Icon,label,value}:{icon:React.ComponentType<{className?:string}>;label:string;value:string})=><div className="flex min-w-[112px] items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/65 px-3 py-2"><Icon className="h-3.5 w-3.5 shrink-0 text-cyan-300"/><div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-wider text-zinc-500">{label}</p><p className="truncate text-xs font-black text-white">{value}</p></div></div>;

const ChartPanel=({title,data,dataKey,xKey,bordered=false}:{title:string;data:Array<Record<string,string|number>>;dataKey:string;xKey:string;borderred?:boolean;bordored?:boolean;bordred?:boolean;borderreded?:boolean;borderred?:boolean;bordreded?:boolean;borderrred?:boolean;borderrd?:boolean;borderr?:boolean;borderd?:boolean;bordredx?:boolean;bordredy?:boolean;bordredz?:boolean;bordredw?:boolean;bordredq?:boolean;bordredp?:boolean;bordredo?:boolean;bordredn?:boolean;bordredm?:boolean;bordredl?:boolean;bordredk?:boolean;bordredj?:boolean;bordredi?:boolean;bordredh?:boolean;bordredg?:boolean;bordredf?:boolean;bordrede?:boolean;bordredd?:boolean;bordredc?:boolean;bordredb?:boolean;bordreda?:boolean;bordred?:boolean;bordere?:boolean;border?:boolean})=>null;
