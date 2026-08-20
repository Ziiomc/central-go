import React,{useEffect,useRef}from'react';
import{DriverMobileView}from'./DriverMobileView';
import{DriverThemeCycleButton}from'./DriverThemeCycleButton';
import{DriverPushRegistration}from'./DriverPushRegistration';

const FOREGROUND_RESYNC_COOLDOWN_MS=20000;

/**
 * Keep the driver screen mounted for the whole working session.
 * Trip changes must update in place: remounting the operational view restarts
 * GPS, audio, timers and transient UI and can feel like a frozen/reloaded app.
 * Foreground reconciliation is deliberately throttled because pwa.ts already
 * handles session and Android resume recovery.
 */
export const DriverMobileShell:React.FC=()=>{
 const lastForegroundResyncAt=useRef(0);
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
 return <><DriverMobileView/><DriverPushRegistration/><DriverThemeCycleButton/></>;
};