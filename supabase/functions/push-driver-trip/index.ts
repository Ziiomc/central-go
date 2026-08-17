import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import{createClient}from"npm:@supabase/supabase-js@2.57.4";
import webpush from"npm:web-push@3.6.7";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-centralgo-push-secret"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});

type PushRequest={tripId?:string;notificationId?:string;driverId?:string};

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const url=Deno.env.get("SUPABASE_URL")!;
  const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin=createClient(url,service);
  const body=await req.json() as PushRequest;
  const{tripId,notificationId,driverId}=body;
  if(!tripId&&!notificationId)throw new Error("tripId o notificationId requerido");

  const{data:secretRow}=await admin.from("centralgo_private_settings").select("value").eq("key","push_internal_secret").maybeSingle();
  const internalHeader=req.headers.get("x-centralgo-push-secret")??"";
  const internalCall=Boolean(internalHeader&&secretRow?.value&&internalHeader===secretRow.value);

  let companyId:string|undefined;
  let userId:string|undefined;
  let payload:Record<string,unknown>;
  let ttl=300;

  if(notificationId){
   const{data:note,error}=await admin.from("notifications").select("id,company_id,recipient_user_id,title,message").eq("id",notificationId).single();
   if(error||!note)throw new Error("Mensaje no encontrado");
   if(!String(note.title).startsWith("RADIO CENTRAL"))return json({sent:0,skipped:true});
   companyId=note.company_id;
   userId=note.recipient_user_id;
   payload={title:"Radio Central GO",body:note.message,tag:`radio-${note.id}`,notificationId:note.id,url:"/driver",kind:"radio"};
  }else{
   const{data:trip,error}=await admin.from("trips").select("id,company_id,code,driver_id,driver_unit_number,origin_address,destination_address,estimated_fare,status,cancel_reason").eq("id",tripId).single();
   if(error||!trip)throw new Error("Carrera no encontrada");
   companyId=trip.company_id;

   const targetDriverId=driverId??trip.driver_id;
   if(!targetDriverId)return json({sent:0,skipped:true,noDriver:true});
   const{data:driver,error:driverError}=await admin.from("drivers").select("id,user_id,company_id").eq("id",targetDriverId).single();
   if(driverError||!driver||driver.company_id!==trip.company_id)return json({sent:0,skipped:true,noDriver:true});
   userId=driver.user_id;

   const isCurrentAssignedDriver=trip.status==="assigned"&&trip.driver_id===targetDriverId;
   if(isCurrentAssignedDriver){
    payload={
     title:`Nueva carrera · ${trip.driver_unit_number??"Central GO"}`,
     body:`${trip.origin_address} → ${trip.destination_address}`,
     tag:`trip-${trip.id}`,
     tripId:trip.id,
     url:"/driver",
     fare:Number(trip.estimated_fare??0),
     status:trip.status,
     kind:"trip",
    };
   }else if(trip.status==="cancelled"){
    ttl=120;
    payload={
     title:"Carrera cancelada · Central GO",
     body:trip.cancel_reason?`Motivo: ${trip.cancel_reason}`:`La carrera ${trip.code} fue cancelada por la central.`,
     tag:`trip-${trip.id}`,
     tripId:trip.id,
     url:"/driver",
     status:trip.status,
     kind:"trip_cancelled",
    };
   }else{
    ttl=45;
    payload={
     title:"Oferta retirada · Central GO",
     body:`La carrera ${trip.code} ya no requiere tu respuesta.`,
     tag:`trip-${trip.id}`,
     tripId:trip.id,
     url:"/driver",
     status:trip.status,
     kind:"trip_cleared",
    };
   }
  }

  if(!internalCall){
   const authHeader=req.headers.get("Authorization")??"";
   if(!authHeader)return json({error:"No autorizado"},401);
   const caller=createClient(url,anon,{global:{headers:{Authorization:authHeader}}});
   const{data:authData,error:authError}=await caller.auth.getUser();
   if(authError||!authData.user)throw new Error("Sesión inválida");
   const{data:profile}=await admin.from("profiles").select("global_role").eq("id",authData.user.id).maybeSingle();
   if(profile?.global_role!=="super_admin"){
    const{data:membership}=await admin.from("company_memberships").select("role,active").eq("company_id",companyId).eq("user_id",authData.user.id).eq("active",true).maybeSingle();
    if(!membership||!["company_admin","operator"].includes(membership.role))throw new Error("Sin permiso para notificar esta central");
   }
  }

  if(!userId)return json({sent:0,noUser:true});
  const{data:setting}=await admin.from("centralgo_private_settings").select("value").eq("key","vapid_private_key").single();
  if(!setting?.value)throw new Error("VAPID no configurado");
  webpush.setVapidDetails("mailto:soporte@centralgo.app","BEN4b02sauQecZUH30sIRi_tubjuPEmL9sWmvFgmwgJLKIvEj1DtDdAfff4xbYi3nCvgfB0p40R-IIdE0aEGwys",setting.value);

  const{data:subs,error:subsError}=await admin.from("driver_push_subscriptions").select("id,endpoint,p256dh,auth_key").eq("user_id",userId);
  if(subsError)throw subsError;
  let sent=0;
  for(const sub of subs??[]){
   try{
    await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_key}},JSON.stringify(payload),{TTL:ttl,urgency:"high"});
    sent++;
   }catch(error:any){
    const status=Number(error?.statusCode??0);
    if(status===404||status===410)await admin.from("driver_push_subscriptions").delete().eq("id",sub.id);
    else console.error("push send",status,error?.message??error);
   }
  }
  return json({sent,kind:payload.kind});
 }catch(error){
  console.error(error);
  return json({error:error instanceof Error?error.message:"Error push"},400);
 }
});
