import React,{useEffect,useMemo,useState}from'react';
import{BarChart3,Cake,CheckCircle2,ChevronDown,ChevronUp,DollarSign,Gauge,Search,Timer,Trophy,UsersRound}from'lucide-react';
import{Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis}from'recharts';
import{useApp}from'../../context/AppContext';
import{loadDriverExtended}from'../../lib/operationsHistoryRepository';
import{OperatorConsole}from'./OperatorConsole';
import{OperatorSearchPalette}from'./OperatorSearchPalette';
import{ScheduledTripsStrip}from'./ScheduledTripsStrip';
import{DispatchPriorityBoard}from'./DispatchPriorityBoard';
import{FleetRadioBroadcast}from'../radio/FleetRadioBroadcast';
import{OperatorRealtimeWatchdog}from'../system/OperatorRealtimeWatchdog';
import'../../operatorWorkspaceClean.css';

const ACTIVITY_COLLAPSED_KEY='centralgo:operator-activity-collapsed';
type OperatorPerformance={key:string;name:string;total:number;completed:number;effectiveness:number;avgDispatchSeconds:number};
type DriverPerformance={key:string;label:string;completed:number;revenue:number;effectiveness:number};

export const OperatorWorkspace:React.FC=()=>{
 const{drivers,trips,currentCompany,currentRole,currentUser}=useApp();
 const[birthDates,setBirthDates]=useState<Record<string,string>>({});
 const[activityCollapsed,setActivityCollapsed]=useState(()=>{try{return window.localStorage.getItem(ACTIVITY_COLLAPSED_KEY)==='1';}catch{return false;}});
 useEffect(()=>{if(currentCompany.id==='network')return;void loadDriverExtended(currentCompany.id).then(rows=>setBirthDates(Object.fromEntries(Object.entries(rows).map(([id,v])=>[id,v.birthDate])))).catch(()=>undefined);},[currentCompany.id,drivers.length]);
 useEffect(()=>{try{window.localStorage.setItem(ACTIVITY_COLLAPSED_KEY,activityCollapsed?'1':'0');}catch{}},[activityCollapsed]);
 const birthdays=useMemo(()=>{const n=new Date();return drivers.filter(d=>{const b=birthDates[d.id];if(!b)return false;const x=new Date(`${b}T12:00:00`);return x.getMonth()===n.getMonth()&&x.getDate()===n.getDate();});},[drivers,birthDates]);
 const today=useMemo(()=>{const start=new Date();start.setHours(0,0,0,0);return trips.filter(t=>new Date(t.createdAt)>=start);},[trips]);
 const completedToday=useMemo(()=>today.filter(t=>t.status==='completed'),[today]);
 const totalRevenue=useMemo(()=>completedToday.reduce((sum,trip)=>sum+(trip.finalFare??trip.estimatedFare??0),0),[completedToday]);
 const effectiveness=today.length?Math.round(completedToday.length/today.length*100):0;
 const activeDrivers=drivers.filter(driver=>driver.status!=='offline').length;
 const hourly=useMemo(()=>Array.from({length:24},(_,hour)=>{const rows=today.filter(t=>new Date(t.createdAt).getHours()===hour);return{hour:`${String(hour).padStart(2,'0')}h`,carreras:rows.length};}).filter((row,index)=>row.carreras||index>=new Date().getHours()-5&&index<=new Date().getHours()),[today]);
 const byDriver=useMemo(()=>drivers.map(driver=>{const own=today.filter(t=>t.driverId===driver.id),done=own.filter(t=>t.status==='completed');return{movil:driver.unitNumber,carreras:done.length};}).filter(item=>item.carreras>0).sort((a,b)=>b.carreras-a.carreras).slice(0,8),[drivers,today]);
 const operatorRanking=useMemo<OperatorPerformance[]>(()=>{
  const map=new Map<string,{key:string;name:string;total:number;completed:number;dispatchSeconds:number[]}>();
  today.forEach(trip=>{
   const key=trip.operatorId||trip.operatorName||'sin-operador';
   const current=map.get(key)??{key,name:trip.operatorName||'Operador',total:0,completed:0,dispatchSeconds:[]};
   current.total+=1;if(trip.status==='completed')current.completed+=1;
   if(trip.assignedAt){const seconds=Math.max(0,Math.round((new Date(trip.assignedAt).getTime()-new Date(trip.createdAt).getTime())/1000));if(Number.isFinite(seconds)&&seconds<3600)current.dispatchSeconds.push(seconds);}
   map.set(key,current);
  });
  return Array.from(map.values()).map(item=>({key:item.key,name:item.name,total:item.total,completed:item.completed,effectiveness:item.total?Math.round(item.completed/item.total*100):0,avgDispatchSeconds:item.dispatchSeconds.length?Math.round(item.dispatchSeconds.reduce((a,b)=>a+b,0)/item.dispatchSeconds.length):0})).sort((a,b)=>b.completed-a.completed||b.effectiveness-a.effectiveness||a.avgDispatchSeconds-b.avgDispatchSeconds);
 },[today]);
 const driverRanking=useMemo<DriverPerformance[]>(()=>drivers.map(driver=>{const own=today.filter(trip=>trip.driverId===driver.id),done=own.filter(trip=>trip.status==='completed');return{key:driver.id,label:`${driver.unitNumber} · ${driver.name}`,completed:done.length,revenue:done.reduce((sum,trip)=>sum+(trip.finalFare??trip.estimatedFare??0),0),effectiveness:own.length?Math.round(done.length/own.length*100):0};}).filter(item=>item.completed>0).sort((a,b)=>b.completed-a.completed||b.revenue-a.revenue).slice(0,6),[drivers,today]);
 const currentOperator=operatorRanking.find(item=>item.key===currentUser.id||item.name===currentUser.name)??{key:currentUser.id,name:currentUser.name,total:today.filter(t=>t.operatorId===currentUser.id).length,completed:today.filter(t=>t.operatorId===currentUser.id&&t.status==='completed').length,effectiveness:0,avgDispatchSeconds:0};
 const currentOperatorEffectiveness=currentOperator.total?Math.round(currentOperator.completed/currentOperator.total*100):0;
 const effectiveOperator={...currentOperator,effectiveness:currentOperator.effectiveness||currentOperatorEffectiveness};
 return <div className="cg-operator-workspace space-y-2.5">
  <OperatorRealtimeWatchdog/>
  <OperatorSearchPalette/>
  {birthdays.length>0&&<div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-xs text-amber-100"><Cake className="mr-2 inline h-4 w-4 text-amber-300"/><strong>Cumpleaños de hoy:</strong> {birthdays.map(driver=>`${driver.unitNumber} · ${driver.name}`).join(', ')}</div>}
  <OperationsOverview hourly={hourly} byDriver={byDriver} operators={operatorRanking} driverRanking={driverRanking} currentOperator={effectiveOperator} completed={completedToday.length} revenue={totalRevenue} effectiveness={effectiveness} activeDrivers={activeDrivers} collapsed={activityCollapsed} onToggle={()=>setActivityCollapsed(value=>!value)}/>
  <ScheduledTripsStrip/>
  <FleetRadioBroadcast/>
  <div className="cg-operator-main-grid grid items-start gap-2.5 xl:grid-cols-[220px_minmax(0,1fr)]">
   <aside className="min-w-0 xl:sticky xl:top-2"><DispatchPriorityBoard/></aside>
   <div className="cg-console-clean min-w-0"><OperatorConsole/></div>
  </div>
 </div>;
};

const OperationsOverview=({hourly,byDriver,operators,driverRanking,currentOperator,completed,revenue,effectiveness,activeDrivers,collapsed,onToggle}:{hourly:Array<Record<string,string|number>>;byDriver:Array<Record<string,string|number>>;operators:OperatorPerformance[];driverRanking:DriverPerformance[];currentOperator:OperatorPerformance;completed:number;revenue:number;effectiveness:number;activeDrivers:number;collapsed:boolean;onToggle:()=>void})=><section className="cg-card cg-performance-pulse overflow-hidden p-0">
 <div className={`flex flex-wrap items-center gap-2 px-3 py-2.5 ${collapsed?'':'border-b border-zinc-800/80'}`}>
  <button type="button" onClick={onToggle} className="cg-op-accent grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-300" title={collapsed?'Mostrar rendimiento':'Minimizar rendimiento'}>{collapsed?<ChevronDown className="h-4 w-4"/>:<ChevronUp className="h-4 w-4"/>}</button>
  <div className="min-w-[170px] flex-1"><div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-cyan-300"/><h2 className="truncate text-sm font-black text-white">{currentOperator.name}</h2><span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase text-emerald-300">Operación en vivo</span></div><div className="mt-0.5 flex flex-wrap gap-x-3 text-[9px] text-zinc-500"><span>{currentOperator.total} despachos hoy</span><span><Timer className="mr-1 inline h-3 w-3 text-cyan-300"/>Prom. {currentOperator.avgDispatchSeconds}s</span><span><Gauge className="mr-1 inline h-3 w-3 text-blue-300"/>{currentOperator.effectiveness}% efectividad</span></div></div>
  <button type="button" onClick={()=>window.dispatchEvent(new Event('centralgo:open-operator-search'))} className="cg-op-accent flex h-8 items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2.5 text-[9px] font-black text-cyan-200"><Search className="h-3.5 w-3.5"/>Buscar <kbd className="rounded border border-cyan-300/20 px-1 text-[8px]">Ctrl K</kbd></button>
  <div className="ml-auto flex flex-wrap items-center gap-1.5"><MiniKpi icon={CheckCircle2} label="Finalizadas" value={String(completed)}/><MiniKpi icon={Gauge} label="Efectividad" value={`${effectiveness}%`}/><MiniKpi icon={UsersRound} label="En línea" value={String(activeDrivers)}/><MiniKpi icon={DollarSign} label="Facturación" value={`$${Math.round(revenue).toLocaleString('es-CL')}`}/></div>
 </div>
 {!collapsed&&<div className="grid gap-0 xl:grid-cols-[1.15fr_.85fr]">
  <div className="grid min-w-0 md:grid-cols-2"><ChartPanel title="Carreras por hora" data={hourly} dataKey="carreras" xKey="hour"/><ChartPanel title="Móviles más activos" data={byDriver} dataKey="carreras" xKey="movil" bordered/></div>
  <div className="grid border-t border-zinc-800 xl:border-l xl:border-t-0"><RankingPanel title="Rendimiento de operadoras" icon={Trophy}>{operators.length?operators.slice(0,5).map((operator,index)=><RankingRow key={operator.key} position={index+1} label={operator.name} value={`${operator.completed} finalizadas · ${operator.effectiveness}%`} width={operators[0]?.completed?Math.max(12,operator.completed/operators[0].completed*100):12}/>):<EmptyRanking text="Aún no hay despachos suficientes"/>}</RankingPanel><RankingPanel title="Rendimiento de conductores" icon={Gauge} topBorder>{driverRanking.length?driverRanking.map((driver,index)=><RankingRow key={driver.key} position={index+1} label={driver.label} value={`${driver.completed} viajes · $${Math.round(driver.revenue).toLocaleString('es-CL')}`} width={driverRanking[0]?.completed?Math.max(12,driver.completed/driverRanking[0].completed*100):12}/>):<EmptyRanking text="Aún no hay carreras finalizadas"/>}</RankingPanel></div>
 </div>}
</section>;

const MiniKpi=({icon:Icon,label,value}:{icon:React.ComponentType<{className?:string}>;label:string;value:string})=><div className="flex min-w-[86px] items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/55 px-2 py-1.5"><Icon className="h-3 w-3 shrink-0 text-cyan-300"/><div className="min-w-0"><p className="text-[7px] font-black uppercase tracking-wider text-zinc-600">{label}</p><p className="truncate text-[10px] font-black text-white">{value}</p></div></div>;
const ChartPanel=({title,data,dataKey,xKey,bordered=false}:{title:string;data:Array<Record<string,string|number>>;dataKey:string;xKey:string;bordered?:boolean})=><div className={`min-w-0 p-2.5 ${bordered?'border-t border-zinc-800 md:border-l md:border-t-0':''}`}><h3 className="mb-1 text-[9px] font-black uppercase tracking-wider text-zinc-500">{title}</h3>{data.length?<ResponsiveContainer width="100%" height={96}><BarChart data={data} margin={{top:4,right:4,bottom:0,left:-22}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,.11)"/><XAxis dataKey={xKey} tick={{fontSize:9,fill:'#7890a4'}} tickLine={false}/><YAxis allowDecimals={false} tick={{fontSize:9,fill:'#7890a4'}} tickLine={false}/><Tooltip contentStyle={{background:'#071521',border:'1px solid rgba(56,189,248,.2)',borderRadius:10,fontSize:11}}/><Bar dataKey={dataKey} fill="#38bdf8" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>:<div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-zinc-800 text-[10px] text-zinc-600">Sin datos todavía</div>}</div>;
const RankingPanel=({title,icon:Icon,children,topBorder=false}:{title:string;icon:React.ComponentType<{className?:string}>;children:React.ReactNode;topBorder?:boolean})=><div className={`p-2.5 ${topBorder?'border-t border-zinc-800':''}`}><h3 className="mb-2 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-zinc-500"><Icon className="h-3.5 w-3.5 text-cyan-300"/>{title}</h3><div className="space-y-1.5">{children}</div></div>;
const RankingRow=({position,label,value,width}:{position:number;label:string;value:string;width:number})=><div className="relative overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-950/45 px-2 py-1.5"><div className="cg-rank-bar absolute inset-y-0 left-0 bg-cyan-500/[.08]" style={{width:`${Math.min(100,width)}%`}}/><div className="relative flex items-center gap-2"><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md text-[9px] font-black ${position===1?'bg-amber-400 text-zinc-950':'bg-zinc-800 text-zinc-300'}`}>{position}</span><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-black text-white">{label}</p><p className="truncate text-[8px] text-zinc-500">{value}</p></div></div></div>;
const EmptyRanking=({text}:{text:string})=><div className="rounded-lg border border-dashed border-zinc-800 px-3 py-3 text-center text-[9px] text-zinc-600">{text}</div>;
