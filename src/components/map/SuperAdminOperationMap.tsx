import React,{useCallback,useEffect,useMemo,useRef,useState}from'react';
import L from'leaflet';
import{maplibreGL}from'@maplibre/maplibre-gl-leaflet';
import'maplibre-gl/dist/maplibre-gl.css';
import{Activity,Car,Clock3,Loader2,RefreshCw,ShieldCheck}from'lucide-react';
import{requireSupabase}from'../../lib/supabase';
import{useColorTheme}from'../../lib/theme';

type DriverRow={id:string;company_id:string;vehicle_id:string|null;unit_number:string|null;display_name:string|null;status:string};
type VehicleRow={id:string;company_id:string;unit_number:string|null;license_plate:string|null;brand:string|null;model:string|null;color:string|null;status:string};
type LocationRow={driver_id:string;company_id:string;lat:number;lng:number;address:string|null;speed_kmh:number|null;heading_degrees:number|null;accuracy_meters:number|null;recorded_at:string};
type PresenceRow={driver_id:string;company_id:string;last_seen_at:string;ended_at:string|null};
type CompanyRow={id:string;name:string};
type MapVehicle={driver:DriverRow;vehicle:VehicleRow|null;location:LocationRow;companyName:string;presenceFresh:boolean};

interface SuperAdminOperationMapProps{
 companyId?:string|null;
 companyName?:string;
 height?:string;
}

const DEFAULT_CENTER:[number,number]=[-35.8454,-71.5979];
const GPS_FRESH_MS=15*60*1000;
const OPENFREEMAP_STYLES={dark:'https://tiles.openfreemap.org/styles/dark',street:'https://tiles.openfreemap.org/styles/liberty'}as const;
const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]||character));
const statusLabel=(status:string)=>({available:'Disponible',en_route:'En camino',in_trip:'En viaje',paused:'Pausado',offline:'Desconectado',sos:'SOS'}[status]||status.replaceAll('_',' '));
const statusColor=(status:string)=>status==='sos'?'#ef4444':status==='in_trip'?'#3b82f6':status==='en_route'?'#f59e0b':status==='paused'?'#64748b':status==='offline'?'#71717a':'#10b981';
const fmtDate=(value:string)=>new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short'}).format(new Date(value));
const validCoordinate=(lat:number,lng:number)=>Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180;

export const SuperAdminOperationMap:React.FC<SuperAdminOperationMapProps>=({companyId,companyName,height='h-[460px]'})=>{
 const scopeCompanyId=companyId&&companyId!=='network'?companyId:null;
 const mapContainerRef=useRef<HTMLDivElement>(null);
 const mapRef=useRef<L.Map|null>(null);
 const baseLayerRef=useRef<L.Layer|null>(null);
 const markersRef=useRef<Record<string,L.Marker>>({});
 const didFitRef=useRef(false);
 const refreshTimerRef=useRef<number|null>(null);
 const{theme}=useColorTheme();
 const[tileMode,setTileMode]=useState<'dark'|'street'>(theme==='light'?'street':'dark');
 const[loading,setLoading]=useState(true);
 const[refreshing,setRefreshing]=useState(false);
 const[error,setError]=useState('');
 const[mapVehicles,setMapVehicles]=useState<MapVehicle[]>([]);
 const[lastUpdated,setLastUpdated]=useState<Date|null>(null);

 const load=useCallback(async(silent=false)=>{
  if(!silent)setLoading(true);else setRefreshing(true);
  setError('');
  try{
   const db=requireSupabase();
   const since15=new Date(Date.now()-GPS_FRESH_MS).toISOString();
   const locationsQuery=db.from('driver_locations').select('driver_id,company_id,lat,lng,address,speed_kmh,heading_degrees,accuracy_meters,recorded_at').gte('recorded_at',since15);
   const driversQuery=db.from('drivers').select('id,company_id,vehicle_id,unit_number,display_name,status').is('archived_at',null);
   const vehiclesQuery=db.from('vehicles').select('id,company_id,unit_number,license_plate,brand,model,color,status').is('archived_at',null);
   const presenceQuery=db.from('driver_presence_sessions').select('driver_id,company_id,last_seen_at,ended_at').is('ended_at',null).gte('last_seen_at',since15);
   const companiesQuery=db.from('companies').select('id,name').eq('active',true);
   if(scopeCompanyId){
    locationsQuery.eq('company_id',scopeCompanyId);
    driversQuery.eq('company_id',scopeCompanyId);
    vehiclesQuery.eq('company_id',scopeCompanyId);
    presenceQuery.eq('company_id',scopeCompanyId);
    companiesQuery.eq('id',scopeCompanyId);
   }
   const[locations,drivers,vehicles,presence,companies]=await Promise.all([locationsQuery,driversQuery,vehiclesQuery,presenceQuery,companiesQuery]);
   const failed=[locations,drivers,vehicles,presence,companies].find(result=>result.error);
   if(failed?.error)throw failed.error;
   const driverRows=(drivers.data??[])as DriverRow[];
   const vehicleRows=(vehicles.data??[])as VehicleRow[];
   const locationRows=(locations.data??[])as LocationRow[];
   const presenceRows=(presence.data??[])as PresenceRow[];
   const companyRows=(companies.data??[])as CompanyRow[];
   const driversById=new Map(driverRows.map(row=>[row.id,row]));
   const vehiclesById=new Map(vehicleRows.map(row=>[row.id,row]));
   const companiesById=new Map(companyRows.map(row=>[row.id,row.name]));
   const freshPresence=new Set(presenceRows.map(row=>row.driver_id));
   const now=Date.now();
   const merged=locationRows.flatMap((location):MapVehicle[]=>{
    const driver=driversById.get(location.driver_id);
    if(!driver||!validCoordinate(Number(location.lat),Number(location.lng)))return[];
    const age=now-new Date(location.recorded_at).getTime();
    if(!Number.isFinite(age)||age>GPS_FRESH_MS)return[];
    const presenceFresh=freshPresence.has(driver.id);
    const vehicle=driver.vehicle_id?vehiclesById.get(driver.vehicle_id)??null:null;
    return[{driver,vehicle,location:{...location,lat:Number(location.lat),lng:Number(location.lng)},companyName:companiesById.get(driver.company_id)||companyName||'Central',presenceFresh}];
   }).sort((a,b)=>a.driver.unit_number?.localeCompare(b.driver.unit_number||'',undefined,{numeric:true})??0);
   setMapVehicles(merged);
   setLastUpdated(new Date());
  }catch(err){setError(err instanceof Error?err.message:'No fue posible cargar las posiciones GPS.');}
  finally{setLoading(false);setRefreshing(false);}
 },[scopeCompanyId,companyName]);

 useEffect(()=>{void load();},[load]);
 useEffect(()=>{setTileMode(theme==='light'?'street':'dark');},[theme]);
 useEffect(()=>{didFitRef.current=false;Object.values(markersRef.current).forEach(marker=>marker.remove());markersRef.current={};},[scopeCompanyId]);

 useEffect(()=>{
  if(!mapContainerRef.current||mapRef.current)return;
  const map=L.map(mapContainerRef.current,{center:DEFAULT_CENTER,zoom:12,zoomControl:false});
  L.control.zoom({position:'bottomright'}).addTo(map);
  map.attributionControl.addAttribution('OpenFreeMap © OpenMapTiles · Datos © OpenStreetMap contributors');
  mapRef.current=map;
  const observer=new ResizeObserver(()=>map.invalidateSize());
  observer.observe(mapContainerRef.current);
  window.setTimeout(()=>map.invalidateSize(),150);
  return()=>{observer.disconnect();baseLayerRef.current=null;map.remove();mapRef.current=null;};
 },[]);

 useEffect(()=>{
  const map=mapRef.current;if(!map)return;
  baseLayerRef.current?.remove();
  baseLayerRef.current=maplibreGL({style:OPENFREEMAP_STYLES[tileMode],attributionControl:false}).addTo(map);
  return()=>{baseLayerRef.current?.remove();baseLayerRef.current=null;};
 },[tileMode]);

 useEffect(()=>{
  const map=mapRef.current;if(!map)return;
  const activeIds=new Set(mapVehicles.map(item=>item.driver.id));
  Object.keys(markersRef.current).forEach(id=>{if(!activeIds.has(id)){markersRef.current[id].remove();delete markersRef.current[id];}});
  mapVehicles.forEach(item=>{
   const{driver,vehicle,location}=item;
   const color=statusColor(driver.status),unit=driver.unit_number||vehicle?.unit_number||'—';
   const markerHtml=`<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 5px 8px rgba(0,0,0,.35))"><div style="width:32px;height:32px;border-radius:10px;border:2px solid white;background:${color};display:flex;align-items:center;justify-content:center;color:white;font-size:17px;transform:rotate(${Number(location.heading_degrees)||0}deg)">▲</div><div style="margin-top:2px;padding:2px 7px;border-radius:999px;background:#09090b;border:1px solid ${color};color:white;font:800 10px/1.2 ui-sans-serif,system-ui">${escapeHtml(unit)}</div></div>`;
   const icon=L.divIcon({html:markerHtml,className:'cg-superadmin-vehicle-pin',iconSize:[70,50],iconAnchor:[35,25]});
   const popup=`<div style="min-width:220px;font-family:ui-sans-serif,system-ui"><div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#64748b">Supervisión · solo lectura</div><div style="font-size:16px;font-weight:900;margin-top:4px">Móvil ${escapeHtml(unit)}</div><div style="font-size:12px;margin-top:3px">${escapeHtml(driver.display_name||'Conductor sin nombre')}</div>${scopeCompanyId?'':`<div style="font-size:11px;color:#64748b;margin-top:2px">${escapeHtml(item.companyName)}</div>`}<hr style="border:0;border-top:1px solid #e4e4e7;margin:8px 0"><div style="font-size:11px"><b>Estado:</b> ${escapeHtml(statusLabel(driver.status))}</div>${vehicle?`<div style="font-size:11px;margin-top:3px"><b>Vehículo:</b> ${escapeHtml([vehicle.brand,vehicle.model].filter(Boolean).join(' ')||'—')} · ${escapeHtml(vehicle.license_plate||'sin patente')}</div>`:''}<div style="font-size:11px;margin-top:3px"><b>Velocidad:</b> ${Math.round(Number(location.speed_kmh)||0)} km/h</div><div style="font-size:11px;margin-top:3px"><b>Último GPS:</b> ${escapeHtml(fmtDate(location.recorded_at))}</div>${location.address?`<div style="font-size:11px;margin-top:3px"><b>Ubicación:</b> ${escapeHtml(location.address)}</div>`:''}</div>`;
   const existing=markersRef.current[driver.id];
   if(existing){existing.setLatLng([location.lat,location.lng]);existing.setIcon(icon);existing.setPopupContent(popup);}
   else markersRef.current[driver.id]=L.marker([location.lat,location.lng],{icon}).addTo(map).bindPopup(popup,{maxWidth:320});
  });
  if(!didFitRef.current&&mapVehicles.length){
   const bounds=L.latLngBounds(mapVehicles.map(item=>[item.location.lat,item.location.lng]as[number,number]));
   if(mapVehicles.length===1)map.setView(bounds.getCenter(),15,{animate:false});
   else map.fitBounds(bounds,{padding:[45,45],maxZoom:15,animate:false});
   didFitRef.current=true;
  }
 },[mapVehicles,scopeCompanyId]);

 useEffect(()=>{
  const db=requireSupabase();
  const channel=db.channel(`superadmin-operation-map:${scopeCompanyId||'network'}`);
  const queueRefresh=()=>{
   if(refreshTimerRef.current!==null)return;
   refreshTimerRef.current=window.setTimeout(()=>{refreshTimerRef.current=null;void load(true);},2500);
  };
  if(scopeCompanyId){
   const filter=`company_id=eq.${scopeCompanyId}`;
   channel.on('postgres_changes',{event:'*',schema:'public',table:'driver_locations',filter},queueRefresh).on('postgres_changes',{event:'*',schema:'public',table:'drivers',filter},queueRefresh).on('postgres_changes',{event:'*',schema:'public',table:'driver_presence_sessions',filter},queueRefresh).on('postgres_changes',{event:'*',schema:'public',table:'vehicles',filter},queueRefresh);
  }else{
   channel.on('postgres_changes',{event:'*',schema:'public',table:'driver_locations'},queueRefresh).on('postgres_changes',{event:'*',schema:'public',table:'drivers'},queueRefresh).on('postgres_changes',{event:'*',schema:'public',table:'driver_presence_sessions'},queueRefresh).on('postgres_changes',{event:'*',schema:'public',table:'vehicles'},queueRefresh);
  }
  channel.subscribe();
  const fallback=window.setInterval(()=>void load(true),30000);
  return()=>{if(refreshTimerRef.current!==null){window.clearTimeout(refreshTimerRef.current);refreshTimerRef.current=null;}window.clearInterval(fallback);void db.removeChannel(channel);};
 },[scopeCompanyId,load]);

 const connectedCount=useMemo(()=>mapVehicles.filter(item=>item.presenceFresh).length,[mapVehicles]);
 const scopeLabel=scopeCompanyId?(companyName||'Central seleccionada'):'Toda la red';
 return <section className="overflow-hidden rounded-2xl border border-blue-500/20 bg-[#0d0d0f] shadow-[0_24px_60px_rgba(0,0,0,.24)]">
  <div className="flex flex-col gap-3 border-b border-zinc-800 p-4 lg:flex-row lg:items-center lg:justify-between">
   <div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-blue-300"><ShieldCheck className="h-4 w-4"/>Mapa de operación</div><h2 className="mt-1 text-lg font-black text-white">Vehículos visibles · {scopeLabel}</h2><p className="mt-1 text-[10px] text-zinc-500">Posiciones reales de `driver_locations` con GPS de los últimos 15 minutos. Vista de supervisión sin acciones de despacho.</p></div>
   <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-black text-emerald-300"><Car className="h-3.5 w-3.5"/>{mapVehicles.length} visibles</span><span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 text-[10px] font-black text-blue-300"><Activity className="h-3.5 w-3.5"/>{connectedCount} conectados</span><button onClick={()=>void load(true)} disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-black text-zinc-200 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${refreshing?'animate-spin':''}`}/>Actualizar</button></div>
  </div>
  {error&&<div className="border-b border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-200">{error}</div>}
  <div className={`relative w-full ${height}`}>
   <div ref={mapContainerRef} className="absolute inset-0"/>
   {loading&&<div className="absolute inset-0 z-[500] flex items-center justify-center gap-2 bg-zinc-950/75 text-xs font-bold text-zinc-300 backdrop-blur-sm"><Loader2 className="h-5 w-5 animate-spin text-blue-300"/>Cargando vehículos GPS…</div>}
   {!loading&&!mapVehicles.length&&!error&&<div className="pointer-events-none absolute inset-x-4 top-4 z-[500] rounded-xl border border-zinc-700 bg-zinc-950/90 px-4 py-3 text-xs text-zinc-300 shadow-xl">No hay vehículos con GPS reciente en esta vista.</div>}
   <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950/85 px-2.5 py-1.5 text-[9px] font-bold text-zinc-400 shadow-lg"><Clock3 className="h-3.5 w-3.5 text-blue-300"/>{lastUpdated?`Actualizado ${lastUpdated.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:'Sincronizando…'}</div>
  </div>
 </section>;
};
