import React,{useEffect,useRef}from'react';
import{useApp}from'../../context/AppContext';
import{requireSupabase}from'../../lib/supabase';
import{soundManager}from'../../lib/audio';
import{RESERVATION_ALARM_WINDOW_MS,synchronizedNow,synchronizeServerClock,tripDelayMs,tripUrgency}from'../../lib/tripTiming';

type PulseTrip={id:string;status:string;driver_id:string|null};
const FALLBACK_RECONCILE_MS=12000,AGE_MARK='data-centralgo-pending-age';
const clearPendingAgeStyle=(node:HTMLElement)=>{node.style.removeProperty('background-color');node.style.removeProperty('box-shadow');node.style.removeProperty('border-color');node.removeAttribute(AGE_MARK);};

export const OperatorRealtimeWatchdog:React.FC=()=>{
 const{currentCompany,currentRole,trips,soundMuted}=useApp();const tripsRef=useRef(trips),lastRecoveryRef=useRef(0),busyRef=useRef(false),knownTripIdsRef=useRef<Set<string>|null>(null);
 useEffect(()=>{tripsRef.current=trips;},[trips]);

 useEffect(()=>{if(!['operator','company_admin'].includes(currentRole))return;const unlock=()=>{void soundManager.prime();window.removeEventListener('pointerdown',unlock,true);window.removeEventListener('keydown',unlock,true);};window.addEventListener('pointerdown',unlock,true);window.addEventListener('keydown',unlock,true);return()=>{window.removeEventListener('pointerdown',unlock,true);window.removeEventListener('keydown',unlock,true);};},[currentRole]);

 useEffect(()=>{if(currentCompany.id==='network'||!['operator','company_admin'].includes(currentRole))return;void synchronizeServerClock().catch(()=>{});const resync=()=>{if(navigator.onLine)void synchronizeServerClock(true).catch(()=>{});};const timer=window.setInterval(()=>void synchronizeServerClock().catch(()=>{}),5*60*1000);window.addEventListener('online',resync);window.addEventListener('focus',resync);return()=>{window.clearInterval(timer);window.removeEventListener('online',resync);window.removeEventListener('focus',resync);};},[currentCompany.id,currentRole]);

 useEffect(()=>{
  if(!['operator','company_admin'].includes(currentRole))return;
  const currentIds=new Set(trips.map(t=>t.id));
  if(knownTripIdsRef.current===null){knownTripIdsRef.current=currentIds;return;}
  const fresh=trips.find(t=>!knownTripIdsRef.current!.has(t.id)&&Date.now()-new Date(t.createdAt).getTime()<45000);
  knownTripIdsRef.current=currentIds;
  if(fresh&&!soundMuted&&!fresh.scheduledFor)void soundManager.prime().then(ready=>{if(ready)soundManager.playDispatchChime();});
 },[trips,currentRole,soundMuted]);

 useEffect(()=>{
  if(currentCompany.id==='network'||!['operator','company_admin'].includes(currentRole)||soundMuted)return;
  let stopped=false;
  const check=()=>{
   if(stopped)return;
   const now=synchronizedNow();
   const due=tripsRef.current.filter(trip=>{
    if(!trip.scheduledFor||['completed','cancelled'].includes(trip.status))return false;
    const delay=tripDelayMs(trip,now);
    return delay>=-RESERVATION_ALARM_WINDOW_MS&&delay<0;
   });
   if(!due.length)return;
   void soundManager.prime().then(ready=>{
    if(!ready||stopped)return;
    due.forEach(trip=>{
     const remainingMs=Math.max(1,-tripDelayMs(trip,now));
     const remainingMinute=Math.max(1,Math.ceil(remainingMs/60000));
     if(remainingMinute<=10)soundManager.playReservationAlarmOnce(`countdown:${trip.id}:${remainingMinute}`);
    });
   });
  };
  check();
  const timer=window.setInterval(check,5000);
  return()=>{stopped=true;window.clearInterval(timer);};
 },[currentCompany.id,currentRole,soundMuted]);

 useEffect(()=>{if(!['operator','company_admin'].includes(currentRole))return;let stopped=false;const paint=()=>{if(stopped)return;const now=synchronizedNow(),light=document.documentElement.dataset.theme==='light',byId=new Map(tripsRef.current.map(t=>[t.id,t]));document.querySelectorAll<HTMLElement>('[data-dispatch-trip-id]').forEach(node=>{const trip=node.dataset.dispatchTripId?byId.get(node.dataset.dispatchTripId):undefined;if(!trip||trip.status!=='pending'){clearPendingAgeStyle(node);return;}const urgency=tripUrgency(trip,now);if(urgency==='scheduled'){node.style.setProperty('background-color',light?'rgba(207,250,254,.96)':'rgba(8,145,178,.16)','important');node.style.setProperty('box-shadow','inset 4px 0 0 #22d3ee, inset 0 0 0 1px rgba(34,211,238,.26)','important');node.style.setProperty('border-color','rgba(34,211,238,.46)','important');node.setAttribute(AGE_MARK,'cyan');}else if(urgency==='critical'){node.style.setProperty('background-color',light?'rgba(254,226,226,.96)':'rgba(127,29,29,.44)','important');node.style.setProperty('box-shadow','inset 4px 0 0 #ef4444, inset 0 0 0 1px rgba(239,68,68,.42)','important');node.style.setProperty('border-color','rgba(239,68,68,.62)','important');node.setAttribute(AGE_MARK,'red');}else if(urgency==='warning'){node.style.setProperty('background-color',light?'rgba(254,249,195,.98)':'rgba(120,53,15,.42)','important');node.style.setProperty('box-shadow','inset 4px 0 0 #eab308, inset 0 0 0 1px rgba(234,179,8,.44)','important');node.style.setProperty('border-color','rgba(202,138,4,.56)','important');node.setAttribute(AGE_MARK,'yellow');}else clearPendingAgeStyle(node);});};paint();const interval=window.setInterval(paint,1000);return()=>{stopped=true;window.clearInterval(interval);document.querySelectorAll<HTMLElement>(`[${AGE_MARK}]`).forEach(clearPendingAgeStyle);};},[currentCompany.id,currentRole]);

 useEffect(()=>{if(currentCompany.id==='network'||!['operator','company_admin'].includes(currentRole))return;let stopped=false;const reconcile=async()=>{if(stopped||busyRef.current||!navigator.onLine||document.visibilityState!=='visible')return;busyRef.current=true;try{const{data,error}=await requireSupabase().from('trips').select('id,status,driver_id').eq('company_id',currentCompany.id).order('created_at',{ascending:false}).limit(24);if(error)throw error;const local=new Map(tripsRef.current.map(t=>[t.id,t]));const mismatch=(data as PulseTrip[]|null|undefined)?.some(row=>{const t=local.get(row.id);return!t||t.status!==row.status||(t.driverId??null)!==(row.driver_id??null);})??false;if(!mismatch)return;const now=Date.now();if(now-lastRecoveryRef.current<4000)return;lastRecoveryRef.current=now;window.dispatchEvent(new CustomEvent('centralgo:driver-resync',{detail:{reason:'operator-realtime-reconciliation'}}));}catch(error){console.warn('[Central GO] Reconciliación operativa pendiente',error);}finally{busyRef.current=false;}};const initial=window.setTimeout(()=>void reconcile(),2200),interval=window.setInterval(()=>void reconcile(),FALLBACK_RECONCILE_MS);const visible=()=>{if(document.visibilityState==='visible')void reconcile();};const online=()=>void reconcile();window.addEventListener('focus',online);window.addEventListener('online',online);document.addEventListener('visibilitychange',visible);return()=>{stopped=true;window.clearTimeout(initial);window.clearInterval(interval);window.removeEventListener('focus',online);window.removeEventListener('online',online);document.removeEventListener('visibilitychange',visible);};},[currentCompany.id,currentRole]);
 return null;
};
