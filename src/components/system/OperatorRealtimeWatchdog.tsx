import React,{useEffect,useRef}from'react';
import{useApp}from'../../context/AppContext';
import{requireSupabase}from'../../lib/supabase';

type PulseTrip={id:string;status:string;driver_id:string|null};
const FALLBACK_RECONCILE_MS=12000;
const ORANGE_AFTER_MS=3*60*1000;
const RED_AFTER_MS=5*60*1000;
const AGE_MARK='data-centralgo-pending-age';

const clearPendingAgeStyle=(node:HTMLElement)=>{
 node.style.removeProperty('background-color');
 node.style.removeProperty('box-shadow');
 node.style.removeProperty('border-color');
 node.removeAttribute(AGE_MARK);
};

/**
 * Realtime is the primary transport. This guard only reconciles missed websocket
 * events after sleep, a network handoff or a browser/PWA suspension.
 *
 * It also gives pending trips a time-based visual escalation in the operator
 * queue: orange after 3 minutes without dispatch and red after 5 minutes.
 */
export const OperatorRealtimeWatchdog:React.FC=()=>{
 const{currentCompany,currentRole,trips}=useApp();
 const tripsRef=useRef(trips);
 const lastRecoveryRef=useRef(0);
 const busyRef=useRef(false);

 useEffect(()=>{tripsRef.current=trips;},[trips]);

 useEffect(()=>{
  if(!['operator','company_admin'].includes(currentRole))return;
  let stopped=false;

  const paintPendingAges=()=>{
   if(stopped)return;
   const now=Date.now();
   const byId=new Map(tripsRef.current.map(trip=>[trip.id,trip]));
   document.querySelectorAll<HTMLElement>('[data-dispatch-trip-id]').forEach(node=>{
    const id=node.dataset.dispatchTripId;
    const trip=id?byId.get(id):undefined;
    if(!trip||trip.status!=='pending'){
     clearPendingAgeStyle(node);
     return;
    }
    const age=now-new Date(trip.createdAt).getTime();
    if(age>=RED_AFTER_MS){
     node.style.setProperty('background-color','rgba(239,68,68,0.18)','important');
     node.style.setProperty('box-shadow','inset 4px 0 0 rgba(248,113,113,0.95), inset 0 0 0 1px rgba(239,68,68,0.28)','important');
     node.style.setProperty('border-color','rgba(239,68,68,0.45)','important');
     node.setAttribute(AGE_MARK,'red');
    }else if(age>=ORANGE_AFTER_MS){
     node.style.setProperty('background-color','rgba(249,115,22,0.16)','important');
     node.style.setProperty('box-shadow','inset 4px 0 0 rgba(251,146,60,0.95), inset 0 0 0 1px rgba(249,115,22,0.25)','important');
     node.style.setProperty('border-color','rgba(249,115,22,0.42)','important');
     node.setAttribute(AGE_MARK,'orange');
    }else{
     clearPendingAgeStyle(node);
    }
   });
  };

  paintPendingAges();
  const interval=window.setInterval(paintPendingAges,1000);
  return()=>{
   stopped=true;
   window.clearInterval(interval);
   document.querySelectorAll<HTMLElement>(`[${AGE_MARK}]`).forEach(clearPendingAgeStyle);
  };
 },[currentCompany.id,currentRole]);

 useEffect(()=>{
  if(currentCompany.id==='network'||!['operator','company_admin'].includes(currentRole))return;
  let stopped=false;

  const reconcile=async()=>{
   if(stopped||busyRef.current||!navigator.onLine||document.visibilityState!=='visible')return;
   busyRef.current=true;
   try{
    const{data,error}=await requireSupabase().from('trips').select('id,status,driver_id').eq('company_id',currentCompany.id).order('created_at',{ascending:false}).limit(24);
    if(error)throw error;
    const local=new Map(tripsRef.current.map(trip=>[trip.id,trip]));
    const mismatch=(data as PulseTrip[]|null|undefined)?.some(row=>{
     const trip=local.get(row.id);
     return !trip||trip.status!==row.status||(trip.driverId??null)!==(row.driver_id??null);
    })??false;
    if(!mismatch)return;
    const now=Date.now();
    if(now-lastRecoveryRef.current<4000)return;
    lastRecoveryRef.current=now;
    window.dispatchEvent(new CustomEvent('centralgo:driver-resync',{detail:{reason:'operator-realtime-reconciliation'}}));
   }catch(error){console.warn('[Central GO] Reconciliación operativa pendiente',error);}
   finally{busyRef.current=false;}
  };

  const initial=window.setTimeout(()=>void reconcile(),2200);
  const interval=window.setInterval(()=>void reconcile(),FALLBACK_RECONCILE_MS);
  const visible=()=>{if(document.visibilityState==='visible')void reconcile();};
  const online=()=>void reconcile();
  window.addEventListener('focus',online);
  window.addEventListener('online',online);
  document.addEventListener('visibilitychange',visible);
  return()=>{stopped=true;window.clearTimeout(initial);window.clearInterval(interval);window.removeEventListener('focus',online);window.removeEventListener('online',online);document.removeEventListener('visibilitychange',visible);};
 },[currentCompany.id,currentRole]);

 return null;
};
