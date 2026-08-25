import React,{useEffect,useRef}from'react';
import{DriverMobileView}from'./DriverMobileView';
import{DriverThemeCycleButton}from'./DriverThemeCycleButton';
import{DriverPushRegistration}from'./DriverPushRegistration';
import{DriverIdentityCompletionGate}from'../auth/DriverIdentityCompletionGate';
import{useApp}from'../../context/AppContext';
import{soundManager}from'../../lib/audio';
import{speakVHFDispatch}from'../../lib/audioService';

const FOREGROUND_RESYNC_COOLDOWN_MS=20000;

/**
 * Keep the driver screen mounted for the whole working session.
 * Trip changes must update in place: remounting the operational view restarts
 * GPS, audio, timers and transient UI and can feel like a frozen/reloaded app.
 * Foreground reconciliation is deliberately throttled because pwa.ts already
 * handles session and Android resume recovery.
 */
export const DriverMobileShell:React.FC=()=>{
 const{trips,drivers,currentUser,soundMuted}=useApp();
 const lastForegroundResyncAt=useRef(0);
 const knownAssignedTripIds=useRef<Set<string>|null>(null);

 useEffect(()=>{
  const requestResync=()=>{
   if(!navigator.onLine||document.visibilityState!=='visible')return;
   const now=Date.now();
   if(now-lastForegroundResyncAt.current<FOREGROUND_RESYNC_COOLDOWN_MS)return;
   lastForegroundResyncAt.current=now;
   window.dispatchEvent(new CustomEvent('centralgo:driver-resync',{detail:{reason:'driver-foreground'}}));
  };
  const handleVisibility=()=>{if(document.visibilityState==='visible')requestResync();};
  document.addEventListener('visibilitychange',handleVisibility);
  window.addEventListener('pageshow',requestResync);
  return()=>{
   document.removeEventListener('visibilitychange',handleVisibility);
   window.removeEventListener('pageshow',requestResync);
  };
 },[]);

 useEffect(()=>{
  const ownDriver=drivers.find(driver=>driver.userId===currentUser.id);
  if(!ownDriver)return;
  const assigned=trips.filter(trip=>trip.driverId===ownDriver.id&&['assigned','en_route'].includes(trip.status));
  const currentIds=new Set(assigned.map(trip=>trip.id));

  if(knownAssignedTripIds.current===null){
   knownAssignedTripIds.current=currentIds;
   return;
  }

  const newlyAssigned=assigned.find(trip=>!knownAssignedTripIds.current!.has(trip.id));
  knownAssignedTripIds.current=currentIds;
  if(!newlyAssigned)return;

  if(!soundMuted){
   soundManager.playDispatchChime();
   speakVHFDispatch(`Atención móvil ${ownDriver.unitNumber}, nueva carrera asignada en ${newlyAssigned.origin.address}`);
  }

  if('Notification'in window&&Notification.permission==='granted'){
   try{new Notification('Nueva carrera asignada',{body:`Móvil ${ownDriver.unitNumber} · ${newlyAssigned.origin.address}`,tag:`centralgo-trip-${newlyAssigned.id}`});}catch{}
  }
 },[trips,drivers,currentUser.id,soundMuted]);

 return <DriverIdentityCompletionGate><><DriverMobileView/><DriverPushRegistration/><DriverThemeCycleButton/></></DriverIdentityCompletionGate>;
};