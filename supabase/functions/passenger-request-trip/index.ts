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
  const found=rows[0];const resolvedLat=num(found?.lat),resolvedLng=num(found?.lon);
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

  if(action==='nearby'){
   const lat=num(body.lat),lng=num(body.lng);
   if(lat===null||lng===null||Math.abs(lat)>90||Math.abs(lng)>180)return json({error:'Ubicación inválida'},400);
   const centrals=await nearbyCompanies(db,lat,lng);
   return json({radiusKm:10,centrals});
  }

  if(action==='status'){
   const tripId=text(body.tripId,80),phone=phoneKey(body.phone);
   if(!tripId||phone.length<7)return json({error:'Datos de seguimiento inválidos'},400);
   const{data:trip,error}=await db.from('trips').select('id,company_id,code,status,client_phone,origin_address,destination_address,driver_unit_number,driver_name,estimated_fare').eq('id',tripId).eq('client_phone',phone).maybeSingle();
   if(error||!trip)return json({error:'No encontramos esta carrera'},404);
   const{data:company}=await db.from('companies').select('name').eq('id',trip.company_id).maybeSingle();
   return json({tripId:trip.id,code:trip.code,status:trip.status,centralName:company?.name??'Central GO',driverUnitNumber:trip.driver_unit_number??undefined,driverName:trip.driver_name??undefined,estimatedFare:trip.estimated_fare??undefined,originAddress:trip.origin_address,destinationAddress:trip.destination_address});
  }

  if(action!=='request')return json({error:'Acción inválida'},400);
  const passengerName=text(body.passengerName,100),phone=phoneKey(body.phone),pickupAddress=text(body.pickupAddress,220),destinationAddress=text(body.destinationAddress,220)||'A convenir / Taxímetro',notes=text(body.notes,400);
  const pickupLat=num(body.pickupLat),pickupLng=num(body.pickupLng);
  if(passengerName.length<2||phone.length<7||pickupAddress.length<3||pickupLat===null||pickupLng===null)return json({error:'Completa nombre, teléfono y permite tu ubicación para encontrar una central cercana'},400);

  let company:CompanyRow|null=null;
  const companyId=text(body.companyId,80);
  if(companyId){
   const{data,error}=await db.from('companies').select('id,name,code,city,country_code,center_lat,center_lng,active').eq('id',companyId).eq('active',true).maybeSingle();
   if(error||!data)return json({error:'La central seleccionada ya no está disponible'},404);
   company=data as CompanyRow;
  }else{
   const legacyCode=text(body.centralCode,30).toUpperCase();
   if(legacyCode){const{data}=await db.from('companies').select('id,name,code,city,country_code,center_lat,center_lng,active').ilike('code',legacyCode).eq('active',true).maybeSingle();company=(data as CompanyRow|null)??null;}
  }
  if(!company){
   const nearby=await nearbyCompanies(db,pickupLat,pickupLng);
   if(!nearby.length)return json({error:'No hay una central Central GO disponible dentro de 10 km de tu ubicación'},404);
   const{data}=await db.from('companies').select('id,name,code,city,country_code,center_lat,center_lng,active').eq('id',nearby[0].id).single();
   company=data as CompanyRow;
  }

  const center=await resolveCompanyCenter(db,company);
  if(!center)return json({error:'No pudimos ubicar geográficamente esta central'},409);
  if(distanceKm(pickupLat,pickupLng,center.lat,center.lng)>10.0001)return json({error:'Solo puedes solicitar una central ubicada a un máximo de 10 km'},403);

  const destinationLat=num(body.destinationLat)??pickupLat,destinationLng=num(body.destinationLng)??pickupLng;
  const code=`${company.code}-${Date.now().toString().slice(-7)}`;
  const payload={company_id:company.id,code,client_name:passengerName,client_phone:phone,origin_address:pickupAddress,origin_lat:pickupLat,origin_lng:pickupLng,destination_address:destinationAddress,destination_lat:destinationLat,destination_lng:destinationLng,status:'pending',operator_user_id:null,operator_name:'App Pasajero Central GO',vehicle_type_requested:'standard',estimated_distance_km:0,estimated_duration_mins:0,estimated_fare:0,payment_method:'efectivo',notes:[notes,'Solicitud directa desde App Pasajero'].filter(Boolean).join(' · '),dispatch_mode:'automatic'};
  const{data:created,error:insertError}=await db.from('trips').insert(payload).select('*').single();
  if(insertError||!created){console.error('[passenger-request-trip] insert',insertError);return json({error:'La central no pudo recibir la carrera. Intenta nuevamente.'},500);}
  let current=created;
  const{data:dispatched,error:dispatchError}=await db.rpc('centralgo_operator_auto_dispatch_trip',{p_trip_id:created.id});
  if(!dispatchError&&dispatched)current=dispatched;else if(dispatchError)console.warn('[passenger-request-trip] auto dispatch deferred',dispatchError.message);
  await db.from('notifications').insert({company_id:company.id,title:'Solicitud desde App Pasajero',message:`${passengerName} solicita móvil en ${pickupAddress}`,type:'trip',read:false,related_id:created.id}).then(()=>undefined).catch(()=>undefined);
  return json({tripId:current.id,code:current.code,status:current.status,centralName:company.name,driverUnitNumber:current.driver_unit_number??undefined,driverName:current.driver_name??undefined,estimatedFare:current.estimated_fare??undefined,originAddress:current.origin_address,destinationAddress:current.destination_address},201);
 }catch(error){console.error('[passenger-request-trip]',error);return json({error:'No fue posible procesar la solicitud'},500);}
});
