import React,{useCallback,useEffect,useMemo,useState}from'react';
import{CarFront,CheckCircle2,Loader2,RefreshCw,ShieldCheck}from'lucide-react';
import{requireSupabase}from'../../lib/supabase';
import{AuthShell}from'../auth/AuthShell';

type VehicleOption={
 driver_id:string;company_id:string;current_vehicle_id:string|null;vehicle_id:string;unit_number:string;license_plate:string;brand:string;model:string;year:number;color:string|null;vehicle_status:string;assigned:boolean;assigned_to_me:boolean;
};

export const DriverVehicleSelectionGate:React.FC<React.PropsWithChildren>=({children})=>{
 const[options,setOptions]=useState<VehicleOption[]>([]);const[loading,setLoading]=useState(true);const[busy,setBusy]=useState(false);const[error,setError]=useState('');const[selected,setSelected]=useState('');
 const load=useCallback(async()=>{setLoading(true);setError('');try{const{data,error:rpcError}=await requireSupabase().rpc('centralgo_driver_vehicle_options');if(rpcError)throw rpcError;const rows=(data??[]) as VehicleOption[];setOptions(rows);const available=rows.find(row=>!row.assigned&&!row.assigned_to_me);setSelected(current=>current||available?.vehicle_id||'');}catch(err){setError(err instanceof Error?err.message:'No fue posible cargar los vehículos de tu central.');}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 const current=useMemo(()=>options.find(row=>row.assigned_to_me),[options]);
 if(!loading&&current)return <>{children}</>;
 const choose=async()=>{if(!selected)return;setBusy(true);setError('');try{const{error:rpcError}=await requireSupabase().rpc('centralgo_driver_select_vehicle',{p_vehicle_id:selected});if(rpcError)throw rpcError;await load();}catch(err){setError(err instanceof Error?err.message:'No fue posible asignar el vehículo.');setBusy(false);}};
 const availableCount=options.filter(row=>!row.assigned).length;
 return <AuthShell compact eyebrow="Central GO · Conductor" title="Selecciona tu móvil">
  <div className="flex items-center gap-3"><span className="cg-role-icon h-12 w-12"><CarFront className="h-6 w-6"/></span><div><p className="cg-card-kicker">Asignación de vehículo</p><h1 className="cg-card-title text-xl">¿Qué vehículo vas a conducir?</h1></div></div>
  <p className="cg-card-copy mt-4">Elige uno de los vehículos que tu central ya registró. Al confirmarlo, tu número de móvil quedará vinculado automáticamente y no tendrás que pedir un cambio manual.</p>
  {error&&<div className="cg-alert cg-alert-error mt-4">{error}</div>}
  {loading?<div className="mt-5 flex items-center justify-center gap-2 py-8 text-sm font-bold text-[var(--cg-muted)]"><Loader2 className="h-5 w-5 animate-spin"/>Cargando flota…</div>:options.length===0?<div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4"><p className="text-sm font-black text-[var(--cg-text)]">La central todavía no tiene vehículos disponibles.</p><p className="mt-1 text-xs text-[var(--cg-muted)]">Pide al administrador que registre primero el vehículo en Flota → Vehículos. Después pulsa actualizar.</p></div>:<div className="mt-5 space-y-2">{options.map(vehicle=><button key={vehicle.vehicle_id} type="button" disabled={vehicle.assigned} onClick={()=>setSelected(vehicle.vehicle_id)} className={`w-full rounded-2xl border p-4 text-left transition ${selected===vehicle.vehicle_id?'border-[var(--cg-primary)] bg-[var(--cg-primary-soft)]':'border-[var(--cg-border)] bg-[var(--cg-surface)]'} ${vehicle.assigned?'cursor-not-allowed opacity-45':''}`}><div className="flex items-start justify-between gap-3"><div><p className="text-base font-black text-[var(--cg-text)]">Móvil {vehicle.unit_number}</p><p className="mt-1 text-xs font-bold text-[var(--cg-muted)]">{vehicle.brand} {vehicle.model} · {vehicle.year}</p><p className="mt-1 text-xs text-[var(--cg-muted)]">Patente {vehicle.license_plate}{vehicle.color?` · ${vehicle.color}`:''}</p></div>{vehicle.assigned?<span className="rounded-full bg-zinc-500/15 px-2 py-1 text-[10px] font-black text-[var(--cg-muted)]">ASIGNADO</span>:selected===vehicle.vehicle_id?<CheckCircle2 className="h-5 w-5 text-[var(--cg-primary)]"/>:null}</div></button>)}</div>}
  <div className="mt-5 grid gap-2"><button type="button" disabled={busy||loading||!selected||availableCount===0} onClick={()=>void choose()} className="cg-primary-button">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<ShieldCheck className="h-4 w-4"/>}{busy?'Asignando…':'Confirmar vehículo'}</button><button type="button" disabled={busy} onClick={()=>void load()} className="cg-subtle-button"><RefreshCw className="h-4 w-4"/>Actualizar lista</button></div>
  <p className="cg-auth-hint">Los vehículos ya asignados aparecen bloqueados para evitar duplicidades.</p>
 </AuthShell>;
};
