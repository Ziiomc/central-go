import React,{useEffect,useMemo,useState}from'react';
import{
  AlertTriangle,Cake,Car,CheckCircle2,ChevronDown,ChevronUp,Clipboard,Download,FileText,
  History,IdCard,Info,KeyRound,MailCheck,MapPin,Pencil,Phone,Plus,Radio,Search,Send,
  Smartphone,Star,Trash2,UserRound,Users,X
}from'lucide-react';
import{useApp}from'../../context/AppContext';
import{assignDriverVehicle,registerTraditionalDriver,releaseDriverVehicle}from'../../lib/driverManagementRepository';
import{removeCompanyDriver}from'../../lib/fleetRemovalRepository';
import{requestDriverAccess}from'../../lib/driverAccessRepository';
import{loadOperationalTripHistory}from'../../lib/operationsHistoryRepository';
import{loadDispatchEvents,registerDriverComplaint}from'../../lib/operationalIntelligenceRepository';
import{exportTableToExcel,printTableAsPdf}from'../../lib/exportUtils';
import{isValidChileanRut,normalizeIdentityDocument}from'../../lib/driverIdentity';
import{requireSupabase}from'../../lib/supabase';
import type{Driver,Trip,TripDispatchEvent}from'../../types';
import{DriverInviteLinkPanel}from'./DriverInviteLinkPanel';

type DriverMeta={
  nationalIdNumber:string;
  address:string;
  birthDate:string;
  complaintCount:number;
  dispatchPriorityCredit:number;
  rating:number;
  operationMode:'app'|'traditional';
  serviceEnabled:boolean;
};

type EditForm={
  name:string;
  phone:string;
  nationalIdNumber:string;
  address:string;
  birthDate:string;
  licenseNumber:string;
  licenseExpiry:string;
};

type ManualForm={
  name:string;
  phone:string;
  address:string;
  birthDate:string;
  licenseNumber:string;
  licenseExpiry:string;
};

const fiveYearsAgo=()=>{const d=new Date();d.setFullYear(d.getFullYear()-5);return d.toISOString();};
const mobileLabel=(driver:Driver,vehicle?:{unitNumber:string})=>vehicle?.unitNumber?`Móvil ${vehicle.unitNumber}`:'Sin móvil asignado';
const statusLabel=(driver:Driver,meta:DriverMeta)=>{
  if(!meta.serviceEnabled)return meta.operationMode==='traditional'?'Fuera de turno':'Suspendido';
  if(meta.operationMode==='traditional')return'Manual en turno';
  if(driver.status==='available')return'Disponible';
  if(driver.status==='paused')return'Pausa';
  if(driver.status==='en_route')return'En camino';
  if(driver.status==='in_trip')return'En viaje';
  if(driver.status==='sos')return'SOS';
  return'App desconectada';
};
const statusClass=(driver:Driver,meta:DriverMeta)=>{
  if(!meta.serviceEnabled)return'border-zinc-700 bg-zinc-800/70 text-zinc-400';
  if(meta.operationMode==='traditional')return'border-amber-400/25 bg-amber-400/10 text-amber-200';
  if(driver.status==='available')return'border-emerald-400/25 bg-emerald-400/10 text-emerald-200';
  if(driver.status==='paused')return'border-amber-400/25 bg-amber-400/10 text-amber-200';
  if(driver.status==='sos')return'border-rose-400/30 bg-rose-500/15 text-rose-200';
  if(driver.status==='offline')return'border-zinc-700 bg-zinc-800/70 text-zinc-400';
  return'border-blue-400/25 bg-blue-400/10 text-blue-200';
};
const emptyMeta:DriverMeta={nationalIdNumber:'',address:'',birthDate:'',complaintCount:0,dispatchPriorityCredit:0,rating:5,operationMode:'app',serviceEnabled:true};
const emptyManual:ManualForm={name:'',phone:'',address:'',birthDate:'',licenseNumber:'',licenseExpiry:''};

export const DriversModule:React.FC=()=>{
 const{drivers,vehicles,currentCompany}=useApp();
 const[meta,setMeta]=useState<Record<string,DriverMeta>>({});
 const[countryCode,setCountryCode]=useState('CL');
 const[search,setSearch]=useState('');
 const[openInfoId,setOpenInfoId]=useState<string>('');
 const[notice,setNotice]=useState('');
 const[error,setError]=useState('');
 const[busyId,setBusyId]=useState<string|null>(null);
 const[selectedVehicle,setSelectedVehicle]=useState<Record<string,string>>({});
 const[manualOpen,setManualOpen]=useState(false);
 const[manual,setManual]=useState<ManualForm>(emptyManual);
 const[manualSaving,setManualSaving]=useState(false);
 const[editing,setEditing]=useState<Driver|null>(null);
 const[edit,setEdit]=useState<EditForm>({name:'',phone:'',nationalIdNumber:'',address:'',birthDate:'',licenseNumber:'',licenseExpiry:''});
 const[editSaving,setEditSaving]=useState(false);
 const[accessBusyId,setAccessBusyId]=useState<string|null>(null);
 const[accessLinks,setAccessLinks]=useState<Record<string,string>>({});
 const[accessMessages,setAccessMessages]=useState<Record<string,string>>({});
 const[complaintDriver,setComplaintDriver]=useState<Driver|null>(null);
 const[complaintReason,setComplaintReason]=useState('');
 const[complaintPenalty,setComplaintPenalty]=useState('0.25');
 const[complaintBusy,setComplaintBusy]=useState(false);
 const[historyDriver,setHistoryDriver]=useState<Driver|null>(null);
 const[historyTrips,setHistoryTrips]=useState<Trip[]>([]);
 const[historyEvents,setHistoryEvents]=useState<TripDispatchEvent[]>([]);
 const[historyLoading,setHistoryLoading]=useState(false);
 const[historyError,setHistoryError]=useState('');

 const reloadMeta=async()=>{
  if(!currentCompany.id||currentCompany.id==='network')return;
  try{
   const db=requireSupabase();
   const[driversResult,companyResult]=await Promise.all([
    db.from('drivers').select('id,national_id_number,address,birth_date,complaint_count,dispatch_priority_credit,rating,operation_mode,service_enabled').eq('company_id',currentCompany.id).is('archived_at',null),
    db.from('companies').select('country_code').eq('id',currentCompany.id).maybeSingle(),
   ]);
   if(driversResult.error)throw driversResult.error;
   if(companyResult.error)throw companyResult.error;
   setCountryCode(companyResult.data?.country_code??'CL');
   setMeta(Object.fromEntries((driversResult.data??[]).map((row:any)=>[row.id,{
    nationalIdNumber:row.national_id_number??'',
    address:row.address??'',
    birthDate:row.birth_date??'',
    complaintCount:Number(row.complaint_count??0),
    dispatchPriorityCredit:Number(row.dispatch_priority_credit??0),
    rating:Number(row.rating??5),
    operationMode:row.operation_mode==='traditional'?'traditional':'app',
    serviceEnabled:row.service_enabled??true,
   } satisfies DriverMeta])));
  }catch(err){setError(err instanceof Error?err.message:'No fue posible cargar la información de conductores.');}
 };
 useEffect(()=>{void reloadMeta();},[currentCompany.id,drivers.length]);

 const rows=useMemo(()=>{
  const term=search.trim().toLowerCase();
  return [...drivers].sort((a,b)=>{
   const av=vehicles.find(v=>v.id===a.vehicleId)?.unitNumber??'';
   const bv=vehicles.find(v=>v.id===b.vehicleId)?.unitNumber??'';
   return av.localeCompare(bv,'es',{numeric:true})||a.name.localeCompare(b.name,'es');
  }).filter(driver=>{
   if(!term)return true;
   const m=meta[driver.id]??emptyMeta;
   const vehicle=vehicles.find(v=>v.id===driver.vehicleId);
   return[driver.name,driver.phone,m.nationalIdNumber,m.address,driver.licenseNumber,vehicle?.unitNumber??'',vehicle?.licensePlate??''].join(' ').toLowerCase().includes(term);
  });
 },[drivers,vehicles,meta,search]);

 const occupiedVehicleIds=useMemo(()=>new Set(drivers.map(d=>d.vehicleId).filter(Boolean) as string[]),[drivers]);
 const vehicleFor=(driver:Driver)=>vehicles.find(v=>v.id===driver.vehicleId);
 const optionsFor=(driver:Driver)=>vehicles.filter(v=>v.status==='active'&&(v.id===driver.vehicleId||!occupiedVehicleIds.has(v.id)));

 const clearMessages=()=>{setNotice('');setError('');};

 const assign=async(driver:Driver)=>{
  const vehicleId=selectedVehicle[driver.id]||'';
  if(!vehicleId){setError('Selecciona un móvil registrado antes de asignar.');return;}
  setBusyId(driver.id);clearMessages();
  try{
   const result=await assignDriverVehicle(driver.id,currentCompany.id,vehicleId);
   const vehicle=vehicles.find(v=>v.id===result.vehicleId);
   setNotice(`${driver.name} quedó asignado a ${vehicle?.unitNumber?`móvil ${vehicle.unitNumber}`:'su nuevo móvil'}.`);
   setSelectedVehicle(current=>({...current,[driver.id]:''}));
   await reloadMeta();
  }catch(err){setError(err instanceof Error?err.message:'No fue posible asignar el móvil.');}
  finally{setBusyId(null);}
 };

 const release=async(driver:Driver)=>{
  const vehicle=vehicleFor(driver);if(!vehicle)return;
  if(!window.confirm(`¿Liberar el móvil ${vehicle.unitNumber} de ${driver.name}?`))return;
  setBusyId(driver.id);clearMessages();
  try{await releaseDriverVehicle(driver.id,currentCompany.id);setNotice(`${driver.name} quedó sin móvil asignado.`);await reloadMeta();}
  catch(err){setError(err instanceof Error?err.message:'No fue posible liberar el móvil.');}
  finally{setBusyId(null);}
 };

 const changeOperation=async(driver:Driver,mode:'app'|'traditional',enabled:boolean)=>{
  setBusyId(driver.id);clearMessages();
  try{
   const{error:rpcError}=await requireSupabase().rpc('centralgo_operator_set_driver_daily_service',{p_driver_id:driver.id,p_enabled:enabled,p_mode:mode});
   if(rpcError)throw rpcError;
   setMeta(current=>({...current,[driver.id]:{...(current[driver.id]??emptyMeta),operationMode:mode,serviceEnabled:enabled}}));
   setNotice(`${driver.name}: operación actualizada.`);
  }catch(err){setError(err instanceof Error?err.message:'No fue posible cambiar la operación del conductor.');}
  finally{setBusyId(null);}
 };

 const openEdit=(driver:Driver)=>{
  const m=meta[driver.id]??emptyMeta;
  setEditing(driver);setEdit({name:driver.name,phone:driver.phone,nationalIdNumber:m.nationalIdNumber,address:m.address||driver.address||'',birthDate:m.birthDate||driver.birthDate||'',licenseNumber:driver.licenseNumber,licenseExpiry:driver.licenseExpiry||''});clearMessages();
 };

 const saveEdit=async(event:React.FormEvent)=>{
  event.preventDefault();if(!editing)return;
  const name=edit.name.trim().replace(/\s+/g,' '),phone=edit.phone.trim(),address=edit.address.trim().replace(/\s+/g,' '),licenseNumber=edit.licenseNumber.trim();
  if(name.length<3){setError('Ingresa el nombre completo del conductor.');return;}
  if(phone.replace(/\D/g,'').length<8){setError('Ingresa un teléfono válido.');return;}
  if(!licenseNumber){setError('Ingresa el número de licencia.');return;}
  if(edit.nationalIdNumber.trim()&&countryCode.toUpperCase()==='CL'&&!isValidChileanRut(edit.nationalIdNumber)){setError('Ingresa un RUT chileno válido.');return;}
  setEditSaving(true);clearMessages();
  try{
   const normalizedDocument=edit.nationalIdNumber.trim()?normalizeIdentityDocument(edit.nationalIdNumber,countryCode):null;
   const{error:updateError}=await requireSupabase().from('drivers').update({
    display_name:name,phone,national_id_number:normalizedDocument,address:address||null,birth_date:edit.birthDate||null,
    license_number:licenseNumber,license_expiry:edit.licenseExpiry||null,updated_at:new Date().toISOString(),
   }).eq('company_id',currentCompany.id).eq('id',editing.id);
   if(updateError)throw updateError;
   setNotice(`Información de ${name} actualizada.`);setEditing(null);window.dispatchEvent(new Event('centralgo:driver-resync'));await reloadMeta();
  }catch(err:any){setError(err?.code==='23505'?'Ese RUT/documento o licencia ya pertenece a otro conductor.':err instanceof Error?err.message:'No fue posible guardar la información.');}
  finally{setEditSaving(false);}
 };

 const createManual=async(event:React.FormEvent)=>{
  event.preventDefault();setManualSaving(true);clearMessages();
  try{
   const created=await registerTraditionalDriver({companyId:currentCompany.id,...manual});
   setNotice(`${created.name} fue registrado sin número de móvil. Puedes asignarle uno desde su fila.`);setManual(emptyManual);setManualOpen(false);window.dispatchEvent(new Event('centralgo:driver-resync'));await reloadMeta();
  }catch(err){setError(err instanceof Error?err.message:'No fue posible registrar al conductor manual.');}
  finally{setManualSaving(false);}
 };

 const remove=async(driver:Driver)=>{
  const vehicle=vehicleFor(driver);const label=vehicle?.unitNumber?`móvil ${vehicle.unitNumber} · `:'';
  if(!window.confirm(`¿Eliminar ${label}${driver.name} de esta central?\n\nSe quitará de la operación, pero su historial se conservará.`))return;
  setBusyId(driver.id);clearMessages();
  try{await removeCompanyDriver(driver.id);setNotice(`${driver.name} fue retirado de la operación. Su historial quedó conservado.`);}
  catch(err){setError(err instanceof Error?err.message:'No fue posible eliminar al conductor.');}
  finally{setBusyId(null);}
 };

 const access=async(driver:Driver)=>{
  if(!driver.userId)return;setAccessBusyId(driver.id);clearMessages();
  try{const result=await requestDriverAccess({companyId:currentCompany.id,userId:driver.userId,action:'send'});if(result.actionLink)setAccessLinks(current=>({...current,[driver.id]:result.actionLink!}));setAccessMessages(current=>({...current,[driver.id]:result.message}));}
  catch(err){setAccessMessages(current=>({...current,[driver.id]:err instanceof Error?err.message:'No fue posible generar acceso.'}));}
  finally{setAccessBusyId(null);}
 };
 const copyAccess=async(driver:Driver)=>{const link=accessLinks[driver.id];if(!link)return;await navigator.clipboard.writeText(link);setAccessMessages(current=>({...current,[driver.id]:'Enlace seguro copiado.'}));};

 const submitComplaint=async(event:React.FormEvent)=>{
  event.preventDefault();if(!complaintDriver)return;setComplaintBusy(true);clearMessages();
  try{await registerDriverComplaint(complaintDriver.id,complaintReason,undefined,Number(complaintPenalty));setNotice(`Reclamo registrado para ${complaintDriver.name}.`);setComplaintDriver(null);setComplaintReason('');await reloadMeta();}
  catch(err){setError(err instanceof Error?err.message:'No fue posible registrar el reclamo.');}
  finally{setComplaintBusy(false);}
 };

 const openHistory=async(driver:Driver)=>{
  setHistoryDriver(driver);setHistoryLoading(true);setHistoryError('');
  try{const[trips,events]=await Promise.all([loadOperationalTripHistory(currentCompany.id,{driverId:driver.id,from:fiveYearsAgo()}),loadDispatchEvents(currentCompany.id,driver.id)]);setHistoryTrips(trips);setHistoryEvents(events);}
  catch(err){setHistoryError(err instanceof Error?err.message:'No fue posible cargar el historial.');}
  finally{setHistoryLoading(false);}
 };
 const rejected=historyEvents.filter(event=>event.eventType==='rejected');
 const historyHeaders=['Fecha','Código','Vehículo','Patente','Cliente','Origen','Destino','Estado','Pago','Tarifa'];
 const historyRows=historyTrips.map(trip=>[new Date(trip.createdAt).toLocaleString('es-CL'),trip.code,trip.vehicleUnitNumber??'',trip.vehiclePlate??'',trip.clientName,trip.origin.address,trip.destination.address,trip.status,trip.paymentMethod,trip.finalFare??trip.estimatedFare]);

 return <div className="space-y-4">
  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="flex items-center gap-2 text-2xl font-extrabold text-white"><Users className="h-6 w-6 text-blue-400"/>Conductores</h1><p className="mt-1 text-xs text-zinc-400">Alta, información y operación en una sola lista.</p></div><p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{drivers.length} conductores registrados</p></div>

  <DriverInviteLinkPanel companyId={currentCompany.id}/>

  {notice&&<div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-200"><MailCheck className="mr-2 inline h-4 w-4"/>{notice}</div>}
  {error&&<div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs font-bold text-rose-200"><AlertTriangle className="mr-2 inline h-4 w-4"/>{error}</div>}

  <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0d0f] shadow-xl shadow-black/20">
   <div className="border-b border-zinc-800 p-4 sm:p-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-base font-black text-white">Lista completa de conductores</h2><p className="mt-1 text-[10px] text-zinc-500">Datos personales, móvil, modo de trabajo, acceso, historial y gestión están dentro de cada fila.</p></div><button type="button" onClick={()=>{setManual(emptyManual);setManualOpen(true);clearMessages();}} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-2.5 text-xs font-black text-amber-200"><Radio className="h-4 w-4"/>Agregar conductor manual</button></div>
    <div className="relative mt-4 max-w-2xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600"/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar por nombre, móvil, patente, RUT, teléfono, licencia o dirección…" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 pl-9 pr-3 text-xs text-white outline-none placeholder:text-zinc-700 focus:border-blue-500"/></div>
   </div>

   <div className="divide-y divide-zinc-800/80">{rows.map(driver=>{const m=meta[driver.id]??{...emptyMeta,operationMode:driver.operationMode??'app'};const vehicle=vehicleFor(driver);const open=openInfoId===driver.id;const accessMessage=accessMessages[driver.id];const birthday=m.birthDate&&(()=>{const b=new Date(`${m.birthDate}T12:00:00`),n=new Date();return b.getDate()===n.getDate()&&b.getMonth()===n.getMonth();})();return <article key={driver.id} className="bg-[#0d0d0f] transition hover:bg-white/[0.015]">
    <div className="grid gap-3 p-4 lg:grid-cols-[minmax(220px,1.25fr)_minmax(160px,.8fr)_minmax(150px,.65fr)_auto] lg:items-center sm:p-5">
     <div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-blue-400/15 bg-blue-400/[0.07]"><UserRound className="h-5 w-5 text-blue-300"/></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-black text-white">{driver.name}</p>{birthday&&<Cake className="h-4 w-4 text-amber-300"/>}</div><p className="mt-0.5 truncate text-[10px] text-zinc-500">{driver.phone||'Teléfono pendiente'} · {m.nationalIdNumber||'Documento pendiente'}</p></div></div>
     <div><p className={`text-sm font-black ${vehicle?'text-amber-200':'text-zinc-500'}`}>{mobileLabel(driver,vehicle)}</p><p className="mt-0.5 text-[10px] text-zinc-600">{vehicle?`${vehicle.licensePlate} · ${vehicle.brand} ${vehicle.model}`:'Asigna un vehículo registrado para obtener número de móvil'}</p></div>
     <div className="flex flex-wrap gap-2"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${m.operationMode==='app'?'border-blue-400/25 bg-blue-400/10 text-blue-200':'border-amber-400/25 bg-amber-400/10 text-amber-200'}`}>{m.operationMode==='app'?'APP':'MANUAL'}</span><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${statusClass(driver,m)}`}>{statusLabel(driver,m)}</span></div>
     <button type="button" onClick={()=>setOpenInfoId(open?'':driver.id)} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-black ${open?'border-blue-400/30 bg-blue-500 text-white':'border-zinc-700 bg-zinc-900 text-zinc-300'}`}><Info className="h-4 w-4"/>Información{open?<ChevronUp className="h-3.5 w-3.5"/>:<ChevronDown className="h-3.5 w-3.5"/>}</button>
    </div>

    {open&&<div className="border-t border-white/[0.05] bg-black/20 p-4 sm:p-5">
     <div className="grid gap-4 xl:grid-cols-3">
      <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Datos personales</p><button type="button" onClick={()=>openEdit(driver)} className="inline-flex items-center gap-1 rounded-lg border border-blue-400/20 bg-blue-400/[0.07] px-2.5 py-1.5 text-[9px] font-black text-blue-200"><Pencil className="h-3.5 w-3.5"/>Editar</button></div><div className="mt-3 space-y-2"><Detail icon={<IdCard className="h-3.5 w-3.5"/>} label={countryCode==='CL'?'RUT':'Documento'} value={m.nationalIdNumber}/><Detail icon={<Phone className="h-3.5 w-3.5"/>} label="Teléfono" value={driver.phone}/><Detail icon={<MapPin className="h-3.5 w-3.5"/>} label="Dirección" value={m.address||driver.address}/><Detail icon={<Cake className="h-3.5 w-3.5"/>} label="Nacimiento" value={m.birthDate?new Date(`${m.birthDate}T12:00:00`).toLocaleDateString('es-CL'):''}/><Detail icon={<CheckCircle2 className="h-3.5 w-3.5"/>} label="Licencia" value={`${driver.licenseNumber||'Pendiente'}${driver.licenseExpiry?` · vence ${new Date(`${driver.licenseExpiry}T12:00:00`).toLocaleDateString('es-CL')}`:''}`}/></div></div>

      <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Operación y móvil</p><div className="mt-3 grid grid-cols-2 gap-2"><button disabled={busyId===driver.id} type="button" onClick={()=>void changeOperation(driver,'app',true)} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-black ${m.operationMode==='app'?'bg-blue-600 text-white':'border border-zinc-700 bg-zinc-900 text-zinc-400'}`}><Smartphone className="h-3.5 w-3.5"/>App</button><button disabled={busyId===driver.id} type="button" onClick={()=>void changeOperation(driver,'traditional',false)} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-black ${m.operationMode==='traditional'?'bg-amber-400 text-zinc-950':'border border-zinc-700 bg-zinc-900 text-zinc-400'}`}><Radio className="h-3.5 w-3.5"/>Manual</button></div><button disabled={busyId===driver.id} type="button" onClick={()=>void changeOperation(driver,m.operationMode,!m.serviceEnabled)} className={`mt-2 w-full rounded-lg px-3 py-2 text-[10px] font-black ${m.serviceEnabled?'border border-rose-500/25 bg-rose-500/10 text-rose-200':'bg-emerald-500 text-emerald-950'}`}>{m.serviceEnabled?(m.operationMode==='traditional'?'Finalizar turno':'Suspender de la operación'):(m.operationMode==='traditional'?'Iniciar turno':'Habilitar App')}</button>
       <div className="mt-3 border-t border-white/[0.06] pt-3">{vehicle?<div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-amber-200">Móvil {vehicle.unitNumber}</p><p className="text-[9px] text-zinc-600">{vehicle.licensePlate} · {vehicle.brand} {vehicle.model}</p></div><button disabled={busyId===driver.id} type="button" onClick={()=>void release(driver)} className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-2 text-[9px] font-black text-rose-200">Liberar</button></div>:<div className="flex gap-2"><select value={selectedVehicle[driver.id]??''} onChange={event=>setSelectedVehicle(current=>({...current,[driver.id]:event.target.value}))} className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-[10px] text-white outline-none"><option value="">Seleccionar móvil inscrito…</option>{optionsFor(driver).map(option=><option key={option.id} value={option.id}>Móvil {option.unitNumber} · {option.licensePlate}</option>)}</select><button disabled={busyId===driver.id||!selectedVehicle[driver.id]} type="button" onClick={()=>void assign(driver)} className="rounded-lg bg-emerald-500 px-3 py-2 text-[9px] font-black text-emerald-950 disabled:opacity-40">Asignar</button></div>}</div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Gestión</p><div className="mt-3 grid grid-cols-2 gap-2"><Metric label="Calificación" value={`★ ${(m.rating||driver.rating||5).toFixed(2)}`}/><Metric label="Reclamos" value={String(m.complaintCount)}/><Metric label="Prioridad" value={m.dispatchPriorityCredit>0?`+${m.dispatchPriorityCredit}`:'Normal'}/><Metric label="Carreras" value={String(driver.totalTripsCompleted??0)}/></div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={()=>void openHistory(driver)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-[9px] font-black text-zinc-300"><History className="h-3.5 w-3.5"/>Historial</button><button type="button" onClick={()=>{setComplaintDriver(driver);setComplaintReason('');}} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-2 text-[9px] font-black text-rose-200"><AlertTriangle className="h-3.5 w-3.5"/>Reclamo</button>{driver.userId&&<button disabled={accessBusyId===driver.id} type="button" onClick={()=>void access(driver)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-2 py-2 text-[9px] font-black text-blue-200"><Send className="h-3.5 w-3.5"/>{accessBusyId===driver.id?'Preparando…':'Reenviar acceso'}</button>}{accessLinks[driver.id]&&<button type="button" onClick={()=>void copyAccess(driver)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-2 text-[9px] font-black text-amber-200"><Clipboard className="h-3.5 w-3.5"/>Copiar link</button>}<button disabled={busyId===driver.id} type="button" onClick={()=>void remove(driver)} className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/[0.06] px-2 py-2 text-[9px] font-black text-rose-300"><Trash2 className="h-3.5 w-3.5"/>Retirar conductor de la central</button></div>{accessMessage&&<p className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-2 text-[9px] leading-relaxed text-zinc-400"><KeyRound className="mr-1 inline h-3 w-3"/>{accessMessage}</p>}</div>
     </div>
    </div>}
   </article>;})}{!rows.length&&<div className="p-10 text-center text-xs text-zinc-600">No se encontraron conductores.</div>}</div>
  </section>

  {manualOpen&&<Modal title="Agregar conductor manual" onClose={()=>setManualOpen(false)}><form onSubmit={createManual} className="grid gap-3 sm:grid-cols-2"><p className="sm:col-span-2 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">Se registrará sin número de móvil. Después podrás asignarle cualquier móvil inscrito directamente desde su fila.</p><Field label="Nombre completo" value={manual.name} onChange={value=>setManual(current=>({...current,name:value}))}/><Field label="Teléfono" value={manual.phone} onChange={value=>setManual(current=>({...current,phone:value}))}/><Field label="Dirección" value={manual.address} onChange={value=>setManual(current=>({...current,address:value}))} required={false}/><DateField label="Fecha de nacimiento" value={manual.birthDate} onChange={value=>setManual(current=>({...current,birthDate:value}))} required={false}/><Field label="N° licencia" value={manual.licenseNumber} onChange={value=>setManual(current=>({...current,licenseNumber:value}))}/><DateField label="Vencimiento licencia" value={manual.licenseExpiry} onChange={value=>setManual(current=>({...current,licenseExpiry:value}))} required={false}/><button disabled={manualSaving} className="sm:col-span-2 rounded-xl bg-amber-400 py-3 text-xs font-black text-zinc-950">{manualSaving?'Registrando…':'Registrar conductor manual'}</button></form></Modal>}

  {editing&&<Modal title={`Información · ${editing.name}`} onClose={()=>setEditing(null)}><form onSubmit={saveEdit} className="grid gap-3 sm:grid-cols-2"><Field label="Nombre completo" value={edit.name} onChange={value=>setEdit(current=>({...current,name:value}))}/><Field label="Teléfono" value={edit.phone} onChange={value=>setEdit(current=>({...current,phone:value}))}/><Field label={countryCode==='CL'?'RUT':'Documento'} value={edit.nationalIdNumber} onChange={value=>setEdit(current=>({...current,nationalIdNumber:value}))} required={false}/><Field label="Dirección" value={edit.address} onChange={value=>setEdit(current=>({...current,address:value}))} required={false}/><DateField label="Fecha de nacimiento" value={edit.birthDate} onChange={value=>setEdit(current=>({...current,birthDate:value}))} required={false}/><Field label="N° licencia" value={edit.licenseNumber} onChange={value=>setEdit(current=>({...current,licenseNumber:value}))}/><DateField label="Vencimiento licencia" value={edit.licenseExpiry} onChange={value=>setEdit(current=>({...current,licenseExpiry:value}))} required={false}/><button disabled={editSaving} className="sm:col-span-2 rounded-xl bg-blue-600 py-3 text-xs font-black text-white">{editSaving?'Guardando…':'Guardar información'}</button></form></Modal>}

  {complaintDriver&&<Modal title={`Reclamo · ${complaintDriver.name}`} onClose={()=>setComplaintDriver(null)}><form onSubmit={submitComplaint} className="space-y-3"><textarea required value={complaintReason} onChange={event=>setComplaintReason(event.target.value)} placeholder="Motivo del reclamo" className={`${inputClass} min-h-24`}/><label><span className="text-[9px] font-black uppercase text-zinc-500">Descuento de estrellas</span><select value={complaintPenalty} onChange={event=>setComplaintPenalty(event.target.value)} className={inputClass}><option value="0.10">-0,10</option><option value="0.25">-0,25</option><option value="0.50">-0,50</option><option value="1">-1,00</option></select></label><button disabled={complaintBusy} className="w-full rounded-xl bg-rose-600 py-3 text-xs font-black text-white">{complaintBusy?'Guardando…':'Registrar reclamo'}</button></form></Modal>}

  {historyDriver&&<div className="fixed inset-0 z-[120] overflow-y-auto bg-black/85 p-4 backdrop-blur-md"><section className="mx-auto my-8 max-w-6xl rounded-3xl border border-zinc-700 bg-[#0d0d0f] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-widest text-blue-300">Historial profesional</p><h2 className="mt-1 text-xl font-black text-white">{historyDriver.name}</h2><p className="mt-1 text-xs text-zinc-500">{historyTrips.length} carreras · {rejected.length} ofertas rechazadas</p></div><div className="flex gap-2"><button disabled={!historyTrips.length} onClick={()=>exportTableToExcel(`chofer-${historyDriver.name}.xls`,historyHeaders,historyRows)} className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-2 text-emerald-300"><Download className="h-4 w-4"/></button><button disabled={!historyTrips.length} onClick={()=>printTableAsPdf(`Historial ${historyDriver.name}`,historyHeaders,historyRows)} className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-2 text-rose-300"><FileText className="h-4 w-4"/></button><button onClick={()=>setHistoryDriver(null)} className="rounded-xl border border-zinc-800 p-2 text-zinc-500"><X className="h-4 w-4"/></button></div></div>{historyError&&<p className="mt-4 text-xs text-rose-300">{historyError}</p>}<div className="mt-5 max-h-[65vh] overflow-auto rounded-xl border border-zinc-800"><table className="w-full min-w-[850px] text-left text-[10px]"><thead className="sticky top-0 bg-zinc-950 text-zinc-500"><tr><th className="p-2">Fecha</th><th className="p-2">Carrera</th><th className="p-2">Vehículo</th><th className="p-2">Cliente</th><th className="p-2">Origen</th><th className="p-2">Destino</th><th className="p-2">Estado</th></tr></thead><tbody className="divide-y divide-zinc-900">{historyTrips.map(trip=><tr key={trip.id}><td className="p-2 text-zinc-500">{new Date(trip.createdAt).toLocaleString('es-CL')}</td><td className="p-2 font-bold text-blue-300">{trip.code}</td><td className="p-2 text-amber-300">{trip.vehicleUnitNumber??'—'}<span className="block text-zinc-600">{trip.vehiclePlate??''}</span></td><td className="p-2 text-white">{trip.clientName}</td><td className="max-w-40 truncate p-2 text-zinc-400">{trip.origin.address}</td><td className="max-w-40 truncate p-2 text-zinc-500">{trip.destination.address}</td><td className="p-2 text-zinc-300">{trip.status}</td></tr>)}{!historyTrips.length&&!historyLoading&&<tr><td colSpan={7} className="p-8 text-center text-zinc-600">Sin carreras registradas.</td></tr>}</tbody></table>{historyLoading&&<p className="p-5 text-center text-xs text-zinc-500">Cargando…</p>}</div></section></div>}
 </div>;
};

const inputClass='mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500';
const Field=({label,value,onChange,type='text',required=true}:{label:string;value:string;onChange:(value:string)=>void;type?:string;required?:boolean})=><label><span className="text-[9px] font-black uppercase text-zinc-500">{label}</span><input required={required} type={type} value={value} onChange={event=>onChange(event.target.value)} className={inputClass}/></label>;
const DateField=({label,value,onChange,required=true}:{label:string;value:string;onChange:(value:string)=>void;required?:boolean})=><label><span className="text-[9px] font-black uppercase text-zinc-500">{label}</span><input required={required} type="date" value={value} onChange={event=>onChange(event.target.value)} className={`${inputClass} [color-scheme:dark]`}/></label>;
const Detail=({icon,label,value}:{icon:React.ReactNode;label:string;value?:string})=><div className={`flex items-start gap-2 rounded-lg border p-2.5 ${value?'border-white/[0.06] bg-white/[0.02]':'border-amber-400/15 bg-amber-400/[0.04]'}`}><span className="mt-0.5 text-blue-300">{icon}</span><div><p className="text-[7px] font-black uppercase tracking-wider text-zinc-600">{label}</p><p className={`mt-0.5 text-[10px] font-semibold ${value?'text-zinc-300':'text-amber-200'}`}>{value||'Dato pendiente'}</p></div></div>;
const Metric=({label,value}:{label:string;value:string})=><div className="rounded-lg border border-white/[0.06] bg-zinc-950/60 p-2.5"><p className="text-[7px] font-black uppercase tracking-wider text-zinc-600">{label}</p><p className="mt-1 text-xs font-black text-white">{value}</p></div>;
const Modal=({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode})=><div className="fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto bg-black/85 p-2 backdrop-blur-md sm:p-4"><section className="my-auto w-full max-w-xl rounded-2xl border border-zinc-700 bg-[#0d0d0f] p-4 sm:rounded-3xl sm:p-6"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black text-white">{title}</h2><button type="button" onClick={onClose} className="p-2 text-zinc-500"><X className="h-4 w-4"/></button></div>{children}</section></div>;
