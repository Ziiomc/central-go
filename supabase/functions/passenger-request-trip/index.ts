import{createClient}from'jsr:@supabase/supabase-js@2';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const text=(value:unknown,max=180)=>String(value??'').trim().slice(0,max);
const phoneKey=(value:unknown)=>text(value,40).replace(/\s+/g,' ');
const num=(value:unknown)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:null;};
const toRad=(v:number)=>v*Math.PI/180;
const distanceKm=(aLat:number,aLng:number,bLat:number,bLng:number)=>{const dLat=toRad(bLat-aLat),dLng=toRad(bLng-aLng),lat1=toRad(aLat),lat2=toRad(bLat);const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));};

type CompanyRow={id:string;name:string;code:string;city?:string|null;country_code?:string|null;center_lat?:number|null;center_lng?:number|null;active?:boolean};

async function resolveCompanyCenter(db:any,company:CompanyRow){
 const lat=num(company.center_lat),lng=num(company.center_lng);
 if(lat!==null&&lng!==null&&Math.abs(lat)<=90&&Math.abs(lng)<=180)return{lat,lng};
 const city=text(company.city,120),country=text(company.country_code,8);
 if(!city)return null;
 try{
  const params=new URLSearchParams({format:'jsonv2',limit:'1',q:[city,country].filter(Boolean).join(', ')});
  if(country.length===2)params.set('countrycodes',country.toLowerCase());
  const response=await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`,{headers:{Accept:'application/json','Accept-Language':'es','User-Agent':'CentralGO/2.0 (passenger central discovery)'},signal:AbortSignal.timeout(5000)});
  if(!response.ok)return null;
  const rows=await response.json()as Array<{lat:string;lon:string}>;
  const found=rows[0],resolvedLat=num(found?.lat),resolvedLng=num(found?.lon);
  if(resolvedLat===null||resolvedLng===null)return null;
  await db.from('companies').update({center_lat:resolvedLat,center_lng:resolvedLng}).eq('id',company.id);
  company.center_lat=resolvedLat;company.center_lng=resolvedLng;
  return{lat:resolvedLat,lng:resolvedLng};
 }catch{return null;}
}

async function nearbyCompanies(db:any,lat:number,lng:number){
 const{data,error}=await db.from('companies').select('id,name,code,city,country_code,center_lat,center_lng,active').eq('active',true);
 if(error)throw error;
 const found:Array<{id:string;name:string;city:string;distanceKm:number}>=[];
 for(const company of(data??[])as CompanyRow[]){
  const center=await resolveCompanyCenter(db,company);if(!center)continue;
  const distance=distanceKm(lat,lng,center.lat,center.lng);
  if(distance<=10.0001)found.push({id:company.id,name:company.name,city:text(company.city,120),distanceKm:Math.round(distance*10)/10});
 }
 return found.sort((a,b)=>a.distanceKm-b.distanceKm);
}

async function passengerSnapshot(db:any,trip:any){
 const[{data:company},{data:driver},{data:location}]=await Promise.all([
  db.from('companies').select('name,phone').eq('id',trip.company_id).maybeSingle(),
  trip.driver_id?db.from('drivers').select('id,vehicle_id,rating,photo_url,total_trips_completed').eq('id',trip.driver_id).maybeSingle():Promise.resolve({data:null}),
  trip.driver_id?db.from('driver_locations').select('lat,lng,speed_kmh,heading_degrees,recorded_at').eq('driver_id',trip.driver_id).maybeSingle():Promise.resolve({data:null}),
 ]);
 const vehicleId=trip.vehicle_id??driver?.vehicle_id??null;
 const{data:vehicle}=vehicleId?await db.from('vehicles').select('unit_number,license_plate,brand,model,color').eq('id',vehicleId).maybeSingle():{data:null};
 return{
  tripId:trip.id,code:trip.code,status:trip.status,centralName:company?.name??'Central GO',centralPhone:company?.phone??undefined,
  driverUnitNumber:trip.driver_unit_number??undefined,driverName:trip.driver_name??undefined,driverRating:driver?.rating==null?undefined:Number(driver.rating),driverPhotoUrl:driver?.photo_url??undefined,driverTripsCompleted:driver?.total_trips_completed??undefined,
  driverLat:location?.lat??undefined,driverLng:location?.lng??undefined,driverHeading:location?.heading_degrees==null?undefined:Number(location.heading_degrees),driverSpeedKmh:location?.speed_kmh==null?undefined:Number(location.speed_kmh),
  vehicleUnitNumber:trip.vehicle_unit_number??vehicle?.unit_number??undefined,vehiclePlate:trip.vehicle_plate??vehicle?.license_plate??undefined,vehicleBrand:vehicle?.brand??undefined,vehicleModel:vehicle?.model??undefined,vehicleColor:vehicle?.color??undefined,
  estimatedFare:trip.estimated_fare==null?undefined:Number(trip.estimated_fare),originAddress:trip.origin_address,originLat:trip.origin_lat,originLng:trip.origin_lng,destinationAddress:trip.destination_address,destinationLat:trip.destination_lat,destinationLng:trip.destination_lng,rating:trip.rating==null?undefined:Number(trip.rating),
 };
}

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Método no permitido'},405);
 try{
  const body=await req.json().catch(()=>null)as Record<string,unknown>|null;
  if(!body)return json({error:'Solicitud inválida'},400);
  const url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!serviceKey)return json({error:'Servicio temporalmente no disponible'},503);
  const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}),action=text(body.action,20);

  if(action==='nearby'){
   const lat=num(body.lat),lng=num(body.lng);
   if(lat===null||lng===null||Math.abs(lat)>90||Math.abs(lng)>180)return json({error:'Ubicación inválida'},400);
   return json({radiusKm:10,centrals:await nearbyCompanies(db,lat,lng)});
  }

  if(['status','cancel','rate'].includes(action)){
   const tripId=text(body.tripId,80),phone=phoneKey(body.phone);
   if(!tripId||phone.length<7)return json({error:'Datos de seguimiento inválidos'},400);
   const{data:trip,error}=await db.from('trips').select('*').eq('id',tripId).eq('client_phone',phone).maybeSingle();
   if(error||!trip)return json({error:'No encontramos esta carrera'},404);

   if(action==='cancel'){
    if(trip.status==='in_progress'||trip.status==='completed')return json({error:'La carrera ya comenzó y no puede cancelarse desde la app.'},409);
    if(trip.status!=='cancelled'){
     const{data:cancelled,error:cancelError}=await db.from('trips').update({status:'cancelled',cancelled_at:new Date().toISOString(),cancel_reason:'Cancelada por pasajero desde la app',cancel_source:'passenger'}).eq('id',trip.id).in('status',['pending','assigned','en_route']).select('*').maybeSingle();
     if(cancelError)return json({error:'No pudimos cancelar la carrera'},500);
     if(!cancelled)return json({error:'El estado de la carrera cambió. Actualiza el seguimiento.'},409);
     if(cancelled.driver_id)await db.from('drivers').update({status:'available'}).eq('id',cancelled.driver_id).eq('status','en_route');
     await db.from('notifications').insert({company_id:trip.company_id,title:'Carrera cancelada por pasajero',message:`${trip.client_name} canceló ${trip.code} desde la App Pasajero`,type:'trip',read:false,related_id:trip.id}).then(()=>undefined).catch(()=>undefined);
     return json(await passengerSnapshot(db,cancelled));
    }
   }

   if(action==='rate'){
    if(trip.status!=='completed')return json({error:'Podrás calificar cuando el viaje haya finalizado.'},409);
    const rating=Math.round(Number(body.rating));if(!Number.isFinite(rating)||rating<1||rating>5)return json({error:'Calificación inválida'},400);
    const{data:rated,error:ratingError}=await db.from('trips').update({rating}).eq('id',trip.id).select('*').single();
    if(ratingError)return json({error:'No pudimos guardar tu calificación'},500);
    if(rated.driver_id){const{data:ratings}=await db.from('trips').select('rating').eq('driver_id',rated.driver_id).not('rating','is',null).limit(1000);const values=(ratings??[]).map((row:any)=>Number(row.rating)).filter(Number.isFinite);if(values.length){const average=values.reduce((sum:number,value:number)=>sum+value,0)/values.length;await db.from('drivers').update({rating:Math.round(average*100)/100}).eq('id',rated.driver_id);}}
    return json(await passengerSnapshot(db,rated));
   }

   return json(await passengerSnapshot(db,trip));
  }

  if(action!=='request')return json({error:'Acción inválida'},400);
  const passengerName=text(body.passengerName,100),phone=phoneKey(body.phone),pickupAddress=text(body.pickupAddress,220),destinationAddress=text(body.destinationAddress,220)||'A convenir / Taxímetro',notes=text(body.notes,400);
  const pickupLat=num(body.pickupLat),pickupLng=num(body.pickupLng);
  if(passengerName.length<2||phone.length<7||pickupAddress.length<3||pickupLat===null||pickupLng===null)return json({error:'Completa nombre, teléfono y permite tu ubicación para encontrar una central cercana'},400);

  let company:CompanyRow|null=null;const companyId=text(body.companyId,80);
  if(companyId){const{data,error}=await db.from('companies').select('id,name,code,city,country_code,center_lat,center_lng,active').eq('id',companyId).eq('active',true).maybeSingle();if(error||!data)return json({error:'La central seleccionada ya no está disponible'},404);company=data as CompanyRow;}
  else{const legacyCode=text(body.centralCode,30).toUpperCase();if(legacyCode){const{data}=await db.from('companies').select('id,name,code,city,country_code,center_lat,center_lng,active').ilike('code',legacyCode).eq('active',true).maybeSingle();company=(data as CompanyRow|null)??null;}}
  if(!company){const nearby=await nearbyCompanies(db,pickupLat,pickupLng);if(!nearby.length)return json({error:'No hay una central Central GO disponible dentro de 10 km de tu ubicación'},404);const{data}=await db.from('companies').select('id,name,code,city,country_code,center_lat,center_lng,active').eq('id',nearby[0].id).single();company=data as CompanyRow;}
  const center=await resolveCompanyCenter(db,company);if(!center)return json({error:'No pudimos ubicar geográficamente esta central'},409);if(distanceKm(pickupLat,pickupLng,center.lat,center.lng)>10.0001)return json({error:'Solo puedes solicitar una central ubicada a un máximo de 10 km'},403);

  const destinationLat=num(body.destinationLat)??pickupLat,destinationLng=num(body.destinationLng)??pickupLng,code=`${company.code}-${Date.now().toString().slice(-7)}`;
  const payload={company_id:company.id,code,client_name:passengerName,client_phone:phone,origin_address:pickupAddress,origin_lat:pickupLat,origin_lng:pickupLng,destination_address:destinationAddress,destination_lat:destinationLat,destination_lng:destinationLng,status:'pending',operator_user_id:null,operator_name:'App Pasajero Central GO',vehicle_type_requested:'standard',estimated_distance_km:0,estimated_duration_mins:0,estimated_fare:0,payment_method:'efectivo',notes:[notes,'Solicitud directa desde App Pasajero'].filter(Boolean).join(' · '),dispatch_mode:'automatic'};
  const{data:created,error:insertError}=await db.from('trips').insert(payload).select('*').single();
  if(insertError||!created){console.error('[passenger-request-trip] insert',insertError);return json({error:'La central no pudo recibir la carrera. Intenta nuevamente.'},500);}
  let current=created;const{data:dispatched,error:dispatchError}=await db.rpc('centralgo_operator_auto_dispatch_trip',{p_trip_id:created.id});
  if(!dispatchError&&dispatched)current=dispatched;else if(dispatchError)console.warn('[passenger-request-trip] auto dispatch deferred',dispatchError.message);
  await db.from('notifications').insert({company_id:company.id,title:'Solicitud desde App Pasajero',message:`${passengerName} solicita móvil en ${pickupAddress}`,type:'trip',read:false,related_id:created.id}).then(()=>undefined).catch(()=>undefined);
  return json(await passengerSnapshot(db,current),201);
 }catch(error){console.error('[passenger-request-trip]',error);return json({error:'No fue posible procesar la solicitud'},500);}
});
