import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const valid=(p:any)=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))&&Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lng))<=180;

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Método no permitido"},405);
 try{
  const authorization=req.headers.get("Authorization")??"";
  if(!authorization)return json({error:"Sesión requerida"},401);
  const body=await req.json().catch(()=>null) as {companyId?:string;start?:{lat:number;lng:number};end?:{lat:number;lng:number}}|null;
  if(!body?.companyId||!valid(body.start)||!valid(body.end))return json({error:"Coordenadas inválidas"},400);
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!;
  const user=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const {data:company,error:companyError}=await user.from("companies").select("id").eq("id",body.companyId).maybeSingle();
  if(companyError||!company)return json({error:"Sin acceso a esta central"},403);
  const routingBase=(Deno.env.get("ROUTING_BASE_URL")||"https://router.project-osrm.org").replace(/\/$/,"");
  const start=body.start!,end=body.end!;
  const endpoint=`${routingBase}/route/v1/driving/${Number(start.lng)},${Number(start.lat)};${Number(end.lng)},${Number(end.lat)}?overview=false&steps=false`;
  const response=await fetch(endpoint,{headers:{Accept:"application/json","User-Agent":"CentralGO/2.0 route-distance"},signal:AbortSignal.timeout(2200)});
  if(!response.ok)return json({error:`Router HTTP ${response.status}`},503);
  const payload=await response.json() as {code?:string;routes?:Array<{distance?:number;duration?:number}>};
  const route=payload.routes?.[0];
  if(payload.code!=="Ok"||!route||!Number.isFinite(route.distance))return json({error:"Ruta vial no disponible"},503);
  return json({distanceKm:Math.round((Number(route.distance)/1000)*1000)/1000,durationSeconds:Number.isFinite(route.duration)?Math.round(Number(route.duration)):null,provider:"osrm-road",exactRoadRoute:true});
 }catch(error){
  console.warn("route-distance",error);
  return json({error:"No fue posible calcular la ruta vial"},503);
 }
});
