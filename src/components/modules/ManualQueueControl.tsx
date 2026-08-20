import React,{useEffect,useMemo,useState}from'react';
import{Loader2,LogOut,Play,Radio,Search}from'lucide-react';
import{requireSupabase}from'../../lib/supabase';

type ManualDriverRow={
 id:string;
 unitNumber:string;
 name:string;
 status:'available'|'en_route'|'in_trip'|'paused'|'offline'|'sos';
 serviceEnabled:boolean;
};

export const ManualQueueControl:React.FC<{companyId:string;onChanged?:()=>void}>=({companyId,onChanged})=>{
 const[rows,setRows]=useState<ManualDriverRow[]>([]);
 const[query,setQuery]=useState('');
 const[busyId,setBusyId]=useState('');
 const[error,setError]=useState('');
 const[notice,setNotice]=useState('');
 const load=async()=>{if(!companyId||companyId==='network')return;try{const{data,error:e}=await requireSupabase().from('drivers').select('id,unit_number,display_name,status,service_enabled').eq('company_id',companyId).eq('operation_mode','traditional').order('unit_number',{ascending:true});if(e)throw e;setRows((data??[]).map((r:any)=>({id:r.id,unitNumber:r.unit_number??'',name:r.display_name??'Conductor',status:r.status,serviceEnabled:r.service_enabled??false})));setError('');}catch(e){setError(e instanceof Error?e.message:'No fue posible cargar los móviles sin App.');}};
 useEffect(()=>{void load();},[companyId]);
 const matches=useMemo(()=>{const q=query.trim().toLowerCase();if(!q)return rows.slice(0,5);return rows.filter(r=>`${r.unitNumber} ${r.name}`.toLowerCase().includes(q)).slice(0,8);},[rows,query]);
 const change=async(row:ManualDriverRow,inQueue:boolean)=>{setBusyId(row.id);setError('');setNotice('');try{const{error:e}=await requireSupabase().rpc('centralgo_operator_set_driver_daily_service',{p_driver_id:row.id,p_enabled:inQueue,p_mode:'traditional'});if(e)throw e;setNotice(`Móvil ${row.unitNumber}: ${inQueue?'incorporado a la fila':'retirado de la fila'}.`);await load();onChanged?.();}catch(e){setError(e instanceof Error?e.message:'No fue posible modificar la fila.');}finally{setBusyId('');}};
 if(companyId==='network')return null;
 return <div className="mb-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.035] p-2.5">
  <div className="flex items-start gap-2"><div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-amber-400/20 bg-amber-400/10"><Radio className="h-3.5 w-3.5 text-amber-300"/></div><div className="min-w-0 flex-1"><p className="text-[10px] font-black text-white">Agregar móvil sin App</p><p className="mt-0.5 text-[8px] leading-relaxed text-zinc-500">Busca un conductor registrado como Manual. El operador puede ingresarlo o sacarlo de la fila sin teléfono ni GPS.</p></div></div>
  <div className="relative mt-2"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar móvil o conductor…" className="w-full rounded-lg border border-white/[0.07] bg-black/25 py-2 pl-8 pr-2 text-[10px] font-semibold text-white outline-none placeholder:text-zinc-700 focus:border-amber-400/40"/></div>
  {notice&&<p className="mt-2 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-2 py-1.5 text-[8px] font-bold text-emerald-300">{notice}</p>}{error&&<p className="mt-2 rounded-lg border border-rose-400/15 bg-rose-400/[0.06] px-2 py-1.5 text-[8px] font-bold text-rose-300">{error}</p>}
  <div className="mt-2 space-y-1.5">{matches.map(row=>{const inQueue=row.serviceEnabled&&row.status==='available';const locked=['en_route','in_trip','sos'].includes(row.status);return <div key={row.id} className="flex items-center gap-2 rounded-lg border border-white/[0.055] bg-black/15 px-2 py-2"><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><span className="truncate text-[9px] font-black text-white">Móvil {row.unitNumber}</span><span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 text-[6px] font-black text-amber-200">SIN APP · MANUAL</span></div><p className="truncate text-[7px] text-zinc-600">{row.name}{inQueue?' · En fila':' · Fuera de la fila'}</p></div><button type="button" disabled={busyId===row.id||locked} onClick={()=>void change(row,!inQueue)} className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[7px] font-black disabled:opacity-40 ${inQueue?'border border-rose-400/20 bg-rose-400/[0.07] text-rose-200':'bg-emerald-400 text-emerald-950'}`} title={locked?'No se puede cambiar mientras el móvil está en carrera o SOS':inQueue?'Sacar de la fila':'Iniciar en la fila'}>{busyId===row.id?<Loader2 className="h-3 w-3 animate-spin"/>:inQueue?<LogOut className="h-3 w-3"/>:<Play className="h-3 w-3"/>}{locked?'En servicio':inQueue?'Sacar de la fila':'Iniciar en la fila'}</button></div>;})}{!matches.length&&<p className="py-2 text-center text-[8px] text-zinc-700">No hay móviles manuales que coincidan.</p>}</div>
 </div>;
};
