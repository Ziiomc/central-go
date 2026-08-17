import React,{useEffect,useRef}from'react';
import L from'leaflet';

interface PassengerLiveMapProps{
 driverLat:number;
 driverLng:number;
 originLat:number;
 originLng:number;
 driverHeading?:number;
 onRouteInfo?:(info:{etaMinutes:number;distanceKm:number})=>void;
}

const carIcon=L.divIcon({className:'',html:'<div style="width:38px;height:38px;border-radius:14px;background:#22d3ee;color:#07111f;display:grid;place-items:center;font-size:20px;font-weight:900;border:3px solid white;box-shadow:0 8px 25px rgba(0,0,0,.35)">🚕</div>',iconSize:[38,38],iconAnchor:[19,19]});
const pickupIcon=L.divIcon({className:'',html:'<div style="width:30px;height:30px;border-radius:999px;background:#10b981;border:4px solid white;box-shadow:0 8px 25px rgba(0,0,0,.35)"></div>',iconSize:[30,30],iconAnchor:[15,15]});

export const PassengerLiveMap:React.FC<PassengerLiveMapProps>=({driverLat,driverLng,originLat,originLng,onRouteInfo})=>{
 const hostRef=useRef<HTMLDivElement|null>(null),mapRef=useRef<L.Map|null>(null),driverRef=useRef<L.Marker|null>(null),routeRef=useRef<L.Polyline|null>(null),lastRouteAt=useRef(0),lastRoutedPoint=useRef<[number,number]|null>(null);

 useEffect(()=>{
  if(!hostRef.current||mapRef.current)return;
  const map=L.map(hostRef.current,{zoomControl:false,attributionControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
  L.control.zoom({position:'bottomright'}).addTo(map);
  const pickup=L.marker([originLat,originLng],{icon:pickupIcon}).addTo(map).bindTooltip('Tu punto de retiro',{direction:'top'});
  const driver=L.marker([driverLat,driverLng],{icon:carIcon}).addTo(map).bindTooltip('Tu taxi',{direction:'top'});
  driverRef.current=driver;
  map.fitBounds(L.latLngBounds([pickup.getLatLng(),driver.getLatLng()]),{padding:[34,34],maxZoom:16});
  mapRef.current=map;
  window.setTimeout(()=>map.invalidateSize(),80);
  return()=>{map.remove();mapRef.current=null;driverRef.current=null;routeRef.current=null;};
 },[]);

 useEffect(()=>{
  const map=mapRef.current,driver=driverRef.current;if(!map||!driver)return;
  driver.setLatLng([driverLat,driverLng]);
  const now=Date.now(),previous=lastRoutedPoint.current;
  const moved=!previous||Math.hypot(driverLat-previous[0],driverLng-previous[1])>.00035;
  if(now-lastRouteAt.current<7000&&!moved)return;
  lastRouteAt.current=now;lastRoutedPoint.current=[driverLat,driverLng];
  const controller=new AbortController();
  const url=`https://router.project-osrm.org/route/v1/driving/${driverLng},${driverLat};${originLng},${originLat}?overview=full&geometries=geojson&steps=false`;
  void fetch(url,{signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error('route');
   const data=await response.json()as any;const route=data?.routes?.[0];if(!route)return;
   const coords=(route.geometry?.coordinates??[]).map((point:[number,number])=>[point[1],point[0]] as [number,number]);
   if(coords.length>1){if(routeRef.current)routeRef.current.remove();routeRef.current=L.polyline(coords,{weight:5,opacity:.9}).addTo(map);map.fitBounds(routeRef.current.getBounds(),{padding:[32,32],maxZoom:16});}
   onRouteInfo?.({etaMinutes:Math.max(1,Math.ceil(Number(route.duration||60)/60)),distanceKm:Math.max(.1,Number(route.distance||0)/1000)});
  }).catch(()=>{
   const earthKm=6371;const dLat=(originLat-driverLat)*Math.PI/180,dLng=(originLng-driverLng)*Math.PI/180;const a=Math.sin(dLat/2)**2+Math.cos(driverLat*Math.PI/180)*Math.cos(originLat*Math.PI/180)*Math.sin(dLng/2)**2;const km=earthKm*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));onRouteInfo?.({etaMinutes:Math.max(1,Math.ceil(km/24*60)),distanceKm:km});
  });
  return()=>controller.abort();
 },[driverLat,driverLng,originLat,originLng,onRouteInfo]);

 return <div ref={hostRef} className="h-[240px] w-full overflow-hidden rounded-[24px] bg-slate-900" aria-label="Mapa en vivo del taxi"/>;
};
