import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
const validCoord=(lat:unknown,lng:unknown)=>Number.isFinite(Number(lat))&&Number.isFinite(Number(lng))&&Math.abs(Number(lat))<=90&&Math.abs(Number(lng))<=180;
const roundKm=(meters:number)=>Math.round((meters/1000)*1000)/1000;
type DriverPoint={id:string;lat:number;lng:number;recordedAt:string|null};
type MatrixPayload={code?:string;distances?:Array<Array<number|null>>;durations?:Array<Array<number|null>>};

Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({error:"Método no permitido"},405);
 const url=Deno.env.get("SUPABASE_URL")!;
 const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const db=createClient(url,serviceKey,{auth:{persistSession:false}});
 let tripId="";
 let shouldDispatch=false;
 try{
  const body=await req.json().catch(()=>({})) as {tripId?:string};
  tripId=String(body.tripId??"");
  if(!tripId)return json({error:"tripId requerido"},400);

  const {data:secretRow}=await db.from("centralgo_private_settings").select("value").eq("key","push_internal_secret").maybeSingle();
  const supplied=req.headers.get("x-centralgo-routing-secret")??"";
  if(!secretRow?.value||!supplied||supplied!==secretRow.value)return json({error:"No autorizado"},401);

  const {data:trip,error:tripError}=await db.from("trips")
   .select("id,company_id,status,dispatch_mode,origin_lat,origin_lng,destination_lat,destination_lng,destination_address")
   .eq("id",tripId).single();
  if(tripError||!trip)return json({error:"Carrera no encontrada"},404);
  if(["completed","cancelled"].includes(String(trip.status)))return json({ok:true,skipped:true,status:trip.status});
  if(!validCoord(trip.origin_lat,trip.origin_lng))throw new Error("Retiro sin coordenadas válidas");
  shouldDispatch=trip.status==="pending"&&trip.dispatch_mode==="automatic";

  let points:DriverPoint[]=[];
  if(shouldDispatch){
   const presenceCutoff=new Date(Date.now()-4*60*1000).toISOString();
   const [{data:drivers,error:driversError},{data:locations,error:locationsError},{data:presence,error:presenceError}]=await Promise.all([
    db.from("drivers").select("id,status,sos_active").eq("company_id",trip.company_id).eq("status","available").eq("sos_active",false),
    db.from("driver_locations").select("driver_id,lat,lng,recorded_at").eq("company_id",trip.company_id),
    db.from("driver_presence_sessions").select("driver_id,last_seen_at").eq("company_id",trip.company_id).is("ended_at",null).gte("last_seen_at",presenceCutoff),
   ]);
   if(driversError)throw driversError;
   if(locationsError)throw locationsError;
   if(presenceError)throw presenceError;
   const connected=new Set((presence??[]).map((p:any)=>p.driver_id));
   const allowed=new Set((drivers??[]).filter((d:any)=>connected.has(d.id)).map((d:any)=>d.id));
   const cutoff=Date.now()-5*60*1000;
   points=(locations??[])
    .filter((l:any)=>allowed.has(l.driver_id)&&validCoord(l.lat,l.lng)&&(!l.recorded_at||new Date(l.recorded_at).getTime()>=cutoff))
    .map((l:any)=>({id:l.driver_id,lat:Number(l.lat),lng:Number(l.lng),recordedAt:l.recorded_at??null}));
  }

  const origin={lat:Number(trip.origin_lat),lng:Number(trip.origin_lng)};
  const hasDestination=!/^a convenir/i.test(String(trip.destination_address??""))&&validCoord(trip.destination_lat,trip.destination_lng);
  const destination=hasDestination?{lat:Number(trip.destination_lat),lng:Number(trip.destination_lng)}:origin;
  const routingBase=(Deno.env.get("ROUTING_BASE_URL")||"https://router.project-osrm.org").replace(/\/$/,"");
  const chunks:DriverPoint[][]=[];
  if(shouldDispatch){for(let i=0;i<points.length;i+=38)chunks.push(points.slice(i,i+38));}
  if(!chunks.length)chunks.push([]);

  if(shouldDispatch)await db.from("trip_driver_route_metrics").delete().eq("trip_id",tripId);
  const computedAt=new Date().toISOString();
  let tripDistanceKm:number|null=null;
  let tripDurationSeconds:number|null=null;
  let successfulChunks=0;
  const metricRows:any[]=[];

  for(const chunk of chunks){
   const coords=[origin,destination,...chunk].map(p=>`${p.lng},${p.lat}`).join(";");
   const sourceIndexes=[0,...chunk.map((_,i)=>i+2)].join(";");
   const params=new URLSearchParams({sources:sourceIndexes,destinations:"0;1",annotations:"distance,duration"});
   const endpoint=`${routingBase}/table/v1/driving/${coords}?${params.toString()}`;
   try{
    const response=await fetch(endpoint,{headers:{Accept:"application/json","User-Agent":"CentralGO/2.1 routing-matrix"},signal:AbortSignal.timeout(2200)});
    if(!response.ok)throw new Error(`Router HTTP ${response.status}`);
    const payload=await response.json() as MatrixPayload;
    if(payload.code!=="Ok"||!payload.distances)throw new Error(`Router ${payload.code??"sin respuesta"}`);
    successfulChunks++;
    if(hasDestination&&tripDistanceKm==null){
     const meters=payload.distances?.[0]?.[1];
     const seconds=payload.durations?.[0]?.[1];
     if(typeof meters==="number"&&Number.isFinite(meters))tripDistanceKm=roundKm(meters);
     if(typeof seconds==="number"&&Number.isFinite(seconds))tripDurationSeconds=Math.round(seconds);
    }
    if(shouldDispatch){
     chunk.forEach((driver,index)=>{
      const meters=payload.distances?.[index+1]?.[0];
      const seconds=payload.durations?.[index+1]?.[0];
      if(typeof meters!=="number"||!Number.isFinite(meters))return;
      metricRows.push({trip_id:tripId,driver_id:driver.id,company_id:trip.company_id,distance_km:roundKm(meters),duration_seconds:typeof seconds==="number"&&Number.isFinite(seconds)?Math.round(seconds):null,provider:"osrm-road",location_recorded_at:driver.recordedAt,computed_at:computedAt});
     });
    }
   }catch(error){console.warn("route-dispatch-matrix chunk fallback",error instanceof Error?error.message:error);}
  }

  if(metricRows.length){
   const {error}=await db.from("trip_driver_route_metrics").upsert(metricRows,{onConflict:"trip_id,driver_id"});
   if(error)throw error;
  }
  if(tripDistanceKm!=null){
   const {error}=await db.from("trips").update({
    estimated_distance_km:tripDistanceKm,
    estimated_duration_mins:tripDurationSeconds==null?0:Math.max(1,Math.round(tripDurationSeconds/60)),
    routing_provider:"osrm-road",
    routing_computed_at:computedAt,
    routing_is_fallback:false,
   }).eq("id",tripId).not("status","in",'(completed,cancelled)');
   if(error)throw error;
  }

  if(shouldDispatch){
   const {error:dispatchError}=await db.rpc("centralgo_internal_dispatch_trip",{p_trip_id:tripId});
   if(dispatchError)throw dispatchError;
  }
  return json({ok:true,tripId,provider:successfulChunks?"osrm-road":"fallback",driverRoutes:metricRows.length,tripDistanceKm,tripDurationSeconds,automaticDispatch:shouldDispatch,successfulChunks,totalChunks:chunks.length});
 }catch(error){
  console.error("route-dispatch-matrix",error);
  if(tripId&&shouldDispatch){try{await db.rpc("centralgo_internal_dispatch_trip",{p_trip_id:tripId});}catch{}}
  return json({error:error instanceof Error?error.message:"No fue posible calcular la matriz vial",fallbackDispatch:shouldDispatch},200);
 }
});
