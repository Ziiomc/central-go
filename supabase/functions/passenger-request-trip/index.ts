import{createClient}from'jsr:@supabase/supabase-js@2';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const text=(value:unknown,max=180)=>String(value??'').trim().slice(0,max);
const phoneKey=(value:unknown)=>text(value,40).replace(/\s+/g,' ');

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Método no permitido'},405);
 try{
  const body=await req.json().catch(()=>null)as Record<string,unknown>|null;
  if(!body)return json({error:'Solicitud inválida'},400);
  const url=Deno.env.get('SUPABASE_URL');const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!serviceKey)return json({error:'Servicio temporalmente no disponible'},503);
  const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const action=text(body.action,20);

  if(action==='status'){
   const tripId=text(body.tripId,80),phone=phoneKey(body.phone);
   if(!tripId||phone.length<7)return json({error:'Datos de seguimiento inválidos'},400);
   const{data:trip,error}=await db.from('trips').select('id,company_id,code,status,client_phone,origin_address,destination_address,driver_unit_number,driver_name,estimated_fare').eq('id',tripId).eq('client_phone',phone).maybeSingle();
   if(error||!trip)return json({error:'No encontramos esta carrera'},404);
   const{data:company}=await db.from('companies').select('name').eq('id',trip.company_id).maybeSingle();
   return json({tripId:trip.id,code:trip.code,status:trip.status,centralName:company?.name??'Central GO',driverUnitNumber:trip.driver_unit_number??undefined,driverName:trip.driver_name??undefined,estimatedFare:trip.estimated_fare??undefined,originAddress:trip.origin_address,destinationAddress:trip.destination_address});
  }

  if(action!=='request')return json({error:'Acción inválida'},400);
  const centralCode=text(body.centralCode,30).toUpperCase();const passengerName=text(body.passengerName,100);const phone=phoneKey(body.phone);const pickupAddress=text(body.pickupAddress,220);const destinationAddress=text(body.destinationAddress,220)||'A convenir / Taxímetro';const notes=text(body.notes,400);
  if(centralCode.length<2||passengerName.length<2||phone.length<7||pickupAddress.length<3)return json({error:'Completa central, nombre, teléfono y lugar de retiro'},400);
  const{data:company,error:companyError}=await db.from('companies').select('id,name,code,active,center_lat,center_lng').ilike('code',centralCode).eq('active',true).maybeSingle();
  if(companyError||!company)return json({error:'No encontramos una central activa con ese código'},404);
  const number=(value:unknown,fallback:number)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback;};
  const centerLat=number(company.center_lat,0),centerLng=number(company.center_lng,0);const originLat=number(body.pickupLat,centerLat),originLng=number(body.pickupLng,centerLng);const destinationLat=number(body.destinationLat,originLat),destinationLng=number(body.destinationLng,originLng);
  const code=`${company.code}-${Date.now().toString().slice(-7)}`;
  const payload={company_id:company.id,code,client_name:passengerName,client_phone:phone,origin_address:pickupAddress,origin_lat:originLat,origin_lng:originLng,destination_address:destinationAddress,destination_lat:destinationLat,destination_lng:destinationLng,status:'pending',operator_user_id:null,operator_name:'App Pasajero Central GO',vehicle_type_requested:'standard',estimated_distance_km:0,estimated_duration_mins:0,estimated_fare:0,payment_method:'efectivo',notes:[notes,'Solicitud directa desde App Pasajero'].filter(Boolean).join(' · '),dispatch_mode:'automatic'};
  const{data:created,error:insertError}=await db.from('trips').insert(payload).select('*').single();
  if(insertError||!created){console.error('[passenger-request-trip] insert',insertError);return json({error:'La central no pudo recibir la carrera. Intenta nuevamente.'},500);}
  let current=created;
  const{data:dispatched,error:dispatchError}=await db.rpc('centralgo_operator_auto_dispatch_trip',{p_trip_id:created.id});
  if(!dispatchError&&dispatched)current=dispatched;else if(dispatchError)console.warn('[passenger-request-trip] auto dispatch deferred',dispatchError.message);
  await db.from('notifications').insert({company_id:company.id,title:'Solicitud desde App Pasajero',message:`${passengerName} solicita móvil en ${pickupAddress}`,type:'trip',read:false,related_id:created.id}).then(()=>undefined).catch(()=>undefined);
  return json({tripId:current.id,code:current.code,status:current.status,centralName:company.name,driverUnitNumber:current.driver_unit_number??undefined,driverName:current.driver_name??undefined,estimatedFare:current.estimated_fare??undefined,originAddress:current.origin_address,destinationAddress:current.destination_address},201);
 }catch(error){console.error('[passenger-request-trip]',error);return json({error:'No fue posible procesar la solicitud'},500);}
});
