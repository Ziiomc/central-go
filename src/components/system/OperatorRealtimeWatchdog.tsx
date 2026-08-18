import React,{useEffect,useRef}from'react';
import{useApp}from'../../context/AppContext';
import{requireSupabase}from'../../lib/supabase';

type PulseTrip={id:string;status:string;driver_id:string|null};

/**
 * Realtime remains the primary transport. This guard is only a lightweight
 * reconciliation path for operator screens that miss a websocket event after
 * sleep, network handoff or a browser/PWA suspension.
 */
export const OperatorRealtimeWatchdog:React.FC=()=>{
 const{currentCompany,currentRole,trips}=useApp();
 const tripsRef=useRef(trips);
 const lastRecoveryRef=useRef(0);
 const busyRef=useRef(false);

 useEffect(()=>{tripsRef.current=trips;},[trips]);

 useEffect(()=>{
  if(currentCompany.id==='network'||!['operator','company_admin'].includes(currentRole))return;
  let stopped=false;

  const reconcile=async()=>{
   if(stopped||busyRef.current||!navigator.onLine||document.visibilityState!=='visible')return;
   busyRef.current=true;
   try{
    const{data,error}=await requireSupabase().from('trips').select('id,status,driver_id').eq('company_id',currentCompany.id).order('created_at',{ascending:false}).limit(30);
    if(error)throw error;
    const local=new Map(tripsRef.current.map(trip=>[trip.id,trip]));
    const mismatch=(data as PulseTrip[]|null|undefined)?.some(row=>{
     const trip=local.get(row.id);
     return !trip||trip.status!==row.status||(trip.driverId??null)!==(row.driver_id??null);
    })??false;
    if(!mismatch)return;
    const now=Date.now();
    if(now-lastRecoveryRef.current<3000)return;
    lastRecoveryRef.current=now;
    window.dispatchEvent(new CustomEvent('centralgo:driver-resync',{detail:{reason:'operator-realtime-reconciliation'}}));
   }catch(error){console.warn('[Central GO] Reconciliación operativa pendiente',error);}
   finally{busyRef.current=false;}
  };

  const initial=window.setTimeout(()=>void reconcile(),1200);
  const interval=window.setInterval(()=>void reconcile(),4000);
  const visible=()=>{if(document.visibilityState==='visible')void reconcile();};
  const online=()=>void reconcile();
  window.addEventListener('focus',online);
  window.addEventListener('online',online);
  document.addEventListener('visibilitychange',visible);
  return()=>{stopped=true;window.clearTimeout(initial);window.clearInterval(interval);window.removeEventListener('focus',online);window.removeEventListener('online',online);document.removeEventListener('visibilitychange',visible);};
 },[currentCompany.id,currentRole]);

 return null;
};
