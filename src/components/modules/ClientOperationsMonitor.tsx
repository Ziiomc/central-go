import React,{useCallback,useEffect,useMemo,useState}from'react';
import{Activity,ArrowLeft,CalendarClock,Car,Clock3,Loader2,Monitor,RefreshCw,Route,ShieldCheck,Smartphone,UserPlus,Users}from'lucide-react';
import{useApp}from'../../context/AppContext';
import{requireSupabase}from'../../lib/supabase';

type DriverRow={id:string;display_name:string|null;unit_number:string|null;status:string;user_id:string|null;created_at:string;service_enabled:boolean|null;vehicle_id:string|null};
type ApplicationRow={id:string;applicant_name:string|null;status:string;created_at:string;claimed_unit_number:string|null};
type TerminalRow={id:string;label:string|null;active:boolean;last_seen_at:string|null};
type TripRow={id:string;code:string;status:string;client_name:string|null;driver_name:string|null;driver_unit_number:string|null;scheduled_for:string|null;created_at:string;final_fare:number|null;estimated_fare:number|null;payment_method:string|null};
type Snapshot={vehiclesTotal:number;vehiclesActive:number;drivers:DriverRow[];applications:ApplicationRow[];operatorsActive:number;terminals:TerminalRow[];driversOnline:number;tripsTotal:number;trips24h:number;trips7d:number;tripsActive:number;reservationsOpen:number;recentTrips:TripRow[]};

const EMPTY:Snapshot={vehiclesTotal:0,vehiclesActive:0,drivers:[],applications:[],operatorsActive:0,terminals:[],driversOnline:0,tripsTotal:0,trips24h:0,trips7d:0,tripsActive:0,reservationsOpen:0,recentTrips:[]};
const ACTIVE_TRIP_STATUSES=['pending','assigned','en_route','arrived','in_progress'];
const fmtDate=(value?:string|null)=>value?new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'—';
const money=(value:number|null|undefined)=>`$${Math.round(Number(value)||0).toLocaleString('es-CL')}`;
const statusLabel=(status:string)=>({pending:'Pendiente',assigned:'Asignada',en_route:'En camino',arrived:'Llegó',in_progress:'En viaje',completed:'Completada',cancelled:'Cancelada',available:'Disponible',offline:'Desconectado',busy:'Ocupado'}[status]||status.replaceAll('_',' '));
const statusTone=(status:string)=>status==='completed'||status==='available'?'border-emerald-500/20 bg-emerald-500/10 text-emerald-300':status==='cancelled'?'border-rose-500/20 bg-rose-500/10 text-rose-300':status==='pending'?'border-amber-500/20 bg-amber-500/10 text-amber-300':'border-blue-500/20 bg-blue-500/10 text-blue-300';

export const ClientOperationsMonitor:React.FC=()=>{
 const{currentCompany,currentRole,setActiveModule}=useApp();
 const[loading,setLoading]=useState(true),[error,setError]=useState(''),[snapshot,setSnapshot]=useState<Snapshot>(EMPTY);
 const companyId=currentCompany.id;
 const load=useCallback(async()=>{
  if(currentRole!=='super_admin'||companyId==='network')return;
  setLoading(true);setError('');
  try{
   const db=requireSupabase(),now=Date.now(),since24=new Date(now-24*60*60*1000).toISOString(),since7=new Date(now-7*24*60*60*1000).toISOString(),since15=new Date(now-15*60*1000).toISOString();
   const[vehicles,drivers,applications,memberships,terminals,presence,tripsTotal,trips24,trips7,tripsActive,reservations,recentTrips]=await Promise.all([
    db.from('vehicles').select('id,status').eq('company_id',companyId).is('archived_at',null),
    db.from('drivers').select('id,display_name,unit_number,status,user_id,created_at,service_enabled,vehicle_id').eq('company_id',companyId).is('archived_at',null).order('created_at',{ascending:false}),
    db.from('driver_applications').select('id,applicant_name,status,created_at,claimed_unit_number').eq('company_id',companyId).order('created_at',{ascending:false}).limit(50),
    db.from('company_memberships').select('id,role,active').eq('company_id',companyId).eq('active',true),
    db.from('operator_terminals').select('id,label,active,last_seen_at').eq('company_id',companyId).order('last_seen_at',{ascending:false}),
    db.from('driver_presence_sessions').select('driver_id,last_seen_at,ended_at').eq('company_id',companyId).is('ended_at',null).gte('last_seen_at',since15),
    db.from('trips').select('id',{count:'exact',head:true}).eq('company_id',companyId),
    db.from('trips').select('id',{count:'exact',head:true}).eq('company_id',companyId).gte('created_at',since24),
    db.from('trips').select('id',{count:'exact',head:true}).eq('company_id',companyId).gte('created_at',since7),
    db.from('trips').select('id',{count:'exact',head:true}).eq('company_id',companyId).in('status',ACTIVE_TRIP_STATUSES),
    db.from('trips').select('id',{count:'exact',head:true}).eq('company_id',companyId).not('scheduled_for','is',null).in('status',ACTIVE_TRIP_STATUSES),
    db.from('trips').select('id,code,status,client_name,driver_name,driver_unit_number,scheduled_for,created_at,final_fare,estimated_fare,payment_method').eq('company_id',companyId).order('created_at',{ascending:false}).limit(20),
   ]);
   const results=[vehicles,drivers,applications,memberships,terminals,presence,tripsTotal,trips24,trips7,tripsActive,reservations,recentTrips];
   const failed=results.find(result=>result.error);
   if(failed?.error)throw failed.error;
   const vehicleRows=(vehicles.data??[])as Array<{status:string}>;
   const membershipRows=(memberships.data??[])as Array<{role:string;active:boolean}>;
   const onlineDriverIds=new Set(((presence.data??[])as Array<{driver_id:string}>).map(row=>row.driver_id));
   setSnapshot({
    vehiclesTotal:vehicleRows.length,
    vehiclesActive:vehicleRows.filter(row=>row.status==='active').length,
    drivers:(drivers.data??[])as DriverRow[],
    applications:(applications.data??[])as ApplicationRow[],
    operatorsActive:membershipRows.filter(row=>row.role==='operator').length,
    terminals:(terminals.data??[])as TerminalRow[],
    driversOnline:onlineDriverIds.size,
    tripsTotal:tripsTotal.count??0,
    trips24h:trips24.count??0,
    trips7d:trips7.count??0,
    tripsActive:tripsActive.count??0,
    reservationsOpen:reservations.count??0,
    recentTrips:(recentTrips.data??[])as TripRow[],
   });
  }catch(err){setError(err instanceof Error?err.message:'No fue posible cargar la operación de esta central.');}
  finally{setLoading(false);}
 },[companyId,currentRole]);
 useEffect(()=>{void load();},[load]);
 const driversWithApp=useMemo(()=>snapshot.drivers.filter(driver=>Boolean(driver.user_id)).length,[snapshot.drivers]);
 const pendingApplications=useMemo(()=>snapshot.applications.filter(item=>item.status==='pending').length,[snapshot.applications]);
 const lastTerminalSeen=useMemo(()=>snapshot.terminals.map(t=>t.last_seen_at).filter(Boolean).sort().at(-1)??null,[snapshot.terminals]);
 if(currentRole!=='super_admin')return null;
 if(companyId==='network')return <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-200">Selecciona una central desde el panel de clientes.</div>;
 return <div className="space-y-5">
  <div className="flex flex-col gap-4 rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-950/35 via-[#0d0d0f] to-cyan-950/20 p-5 md:flex-row md:items-center md:justify-between">
   <div><button onClick={()=>setActiveModule('dashboard')} className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 hover:text-white"><ArrowLeft className="h-3.5 w-3.5"/>Volver a clientes</button><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-blue-300"><ShieldCheck className="h-4 w-4"/>Supervisión de cliente</div><h1 className="mt-2 text-2xl font-black text-white md:text-3xl">{currentCompany.name}</h1><p className="mt-1 text-xs text-zinc-400">Panel de solo lectura para revisar adopción, flota y actividad operativa real.</p></div>
   <button onClick={()=>void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-xs font-black text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>Actualizar operación</button>
  </div>
  {error&&<div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{error}</div>}
  {loading?<div className="flex min-h-56 items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-[#0d0d0f] text-xs font-bold text-zinc-400"><Loader2 className="h-5 w-5 animate-spin text-blue-400"/>Leyendo operación real…</div>:<>
   <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
    <Metric icon={Car} label="Vehículos" value={String(snapshot.vehiclesTotal)} detail={`${snapshot.vehiclesActive} activos`}/>
    <Metric icon={Users} label="Conductores" value={String(snapshot.drivers.length)} detail={`${driversWithApp} con app`}/>
    <Metric icon={Activity} label="Conectados" value={String(snapshot.driversOnline)} detail="últimos 15 min"/>
    <Metric icon={Monitor} label="Operadores" value={String(snapshot.operatorsActive)} detail={`${snapshot.terminals.filter(t=>t.active).length} terminales`}/>
    <Metric icon={Route} label="Carreras 24 h" value={String(snapshot.trips24h)} detail={`${snapshot.trips7d} en 7 días`}/>
    <Metric icon={CalendarClock} label="Reservas" value={String(snapshot.reservationsOpen)} detail={`${snapshot.tripsActive} carreras activas`}/>
   </div>
   <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
    <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0d0f]"><div className="flex items-center justify-between border-b border-zinc-800 p-4"><div><h2 className="text-sm font-black text-white">Conductores inscritos</h2><p className="mt-1 text-[10px] text-zinc-500">Registro real de la central y vinculación con la app.</p></div><span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[9px] font-black text-blue-300">{snapshot.drivers.length} registrados</span></div><div className="overflow-x-auto"><table className="w-full min-w-[620px]"><thead><tr className="text-left text-[9px] uppercase tracking-wider text-zinc-600"><th className="p-3">Conductor</th><th className="p-3">Móvil</th><th className="p-3">Estado</th><th className="p-3">App</th><th className="p-3">Alta</th></tr></thead><tbody>{snapshot.drivers.map(driver=><tr key={driver.id} className="border-t border-zinc-900"><td className="p-3 text-xs font-bold text-white">{driver.display_name||'Sin nombre'}</td><td className="p-3 text-xs font-black text-zinc-300">{driver.unit_number||'—'}</td><td className="p-3"><span className={`rounded-full border px-2 py-1 text-[9px] font-black ${statusTone(driver.status)}`}>{statusLabel(driver.status)}</span></td><td className="p-3"><span className={`inline-flex items-center gap-1 text-[10px] font-bold ${driver.user_id?'text-emerald-300':'text-zinc-600'}`}><Smartphone className="h-3.5 w-3.5"/>{driver.user_id?'Vinculada':'Sin cuenta'}</span></td><td className="p-3 text-[10px] text-zinc-500">{fmtDate(driver.created_at)}</td></tr>)}{!snapshot.drivers.length&&<tr><td colSpan={5} className="p-8 text-center text-xs text-zinc-600">Todavía no hay conductores registrados.</td></tr>}</tbody></table></div></section>
    <div className="space-y-4"><section className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-4"><h2 className="text-sm font-black text-white">Acceso y adopción</h2><div className="mt-4 grid grid-cols-2 gap-2"><Small label="Conductores con app" value={`${driversWithApp}/${snapshot.drivers.length}`}/><Small label="Solicitudes pendientes" value={String(pendingApplications)}/><Small label="Operadores activos" value={String(snapshot.operatorsActive)}/><Small label="Terminales activas" value={String(snapshot.terminals.filter(t=>t.active).length)}/></div><div className="mt-3 flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-[10px] text-zinc-500"><Clock3 className="h-4 w-4 text-blue-300"/><span>Última actividad de terminal: <strong className="text-zinc-300">{fmtDate(lastTerminalSeen)}</strong></span></div></section><section className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-4"><div className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-amber-300"/><h2 className="text-sm font-black text-white">Solicitudes de conductor</h2></div><div className="mt-3 space-y-2">{snapshot.applications.slice(0,5).map(item=><div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"><div><p className="text-xs font-bold text-white">{item.applicant_name||'Solicitud'}</p><p className="mt-0.5 text-[9px] text-zinc-600">{item.claimed_unit_number?`Móvil ${item.claimed_unit_number} · `:''}{fmtDate(item.created_at)}</p></div><span className={`rounded-full border px-2 py-1 text-[9px] font-black ${statusTone(item.status)}`}>{statusLabel(item.status)}</span></div>)}{!snapshot.applications.length&&<p className="rounded-xl border border-zinc-800 p-4 text-center text-xs text-zinc-600">Sin solicitudes registradas.</p>}</div></section></div>
   </div>
   <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0d0f]"><div className="flex flex-col gap-2 border-b border-zinc-800 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-black text-white">Actividad de carreras</h2><p className="mt-1 text-[10px] text-zinc-500">{snapshot.tripsTotal} carreras históricas · últimas 20 registradas.</p></div></div><div className="overflow-x-auto"><table className="w-full min-w-[850px]"><thead><tr className="text-left text-[9px] uppercase tracking-wider text-zinc-600"><th className="p-3">Código</th><th className="p-3">Cliente</th><th className="p-3">Conductor</th><th className="p-3">Estado</th><th className="p-3">Reserva</th><th className="p-3">Valor</th><th className="p-3">Hora</th></tr></thead><tbody>{snapshot.recentTrips.map(trip=><tr key={trip.id} className="border-t border-zinc-900"><td className="p-3 text-xs font-black text-blue-300">{trip.code}</td><td className="p-3 text-xs text-zinc-300">{trip.client_name||'—'}</td><td className="p-3 text-xs text-zinc-400">{trip.driver_unit_number?`${trip.driver_unit_number} · `:''}{trip.driver_name||'Sin asignar'}</td><td className="p-3"><span className={`rounded-full border px-2 py-1 text-[9px] font-black ${statusTone(trip.status)}`}>{statusLabel(trip.status)}</span></td><td className="p-3 text-[10px] text-zinc-500">{trip.scheduled_for?fmtDate(trip.scheduled_for):'No'}</td><td className="p-3 text-xs font-black text-emerald-300">{money(trip.final_fare??trip.estimated_fare)}</td><td className="p-3 text-[10px] text-zinc-500">{fmtDate(trip.created_at)}</td></tr>)}{!snapshot.recentTrips.length&&<tr><td colSpan={7} className="p-8 text-center text-xs text-zinc-600">Esta central todavía no registra carreras.</td></tr>}</tbody></table></div></section>
  </>}
 </div>;
};

const Metric=({icon:Icon,label,value,detail}:{icon:React.ElementType;label:string;value:string;detail:string})=><div className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-4"><div className="flex items-center justify-between"><Icon className="h-4 w-4 text-blue-300"/><span className="text-[8px] font-black uppercase tracking-wider text-zinc-600">Real</span></div><p className="mt-3 text-2xl font-black text-white">{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-1 text-[10px] text-zinc-600">{detail}</p></div>;
const Small=({label,value}:{label:string;value:string})=><div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"><p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">{label}</p><p className="mt-1 text-lg font-black text-white">{value}</p></div>;
