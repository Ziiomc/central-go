import React,{useEffect,useRef}from'react';
import{DriverMobileView}from'./DriverMobileView';
import{DriverPushRegistration}from'./DriverPushRegistration';
import{DriverRealtimeRadioReceiver}from'./DriverRealtimeRadioReceiver';
import{DriverReservationsPanel}from'./DriverReservationsPanel';
import{DriverIdentityCompletionGate}from'../auth/DriverIdentityCompletionGate';
import{useApp}from'../../context/AppContext';
import{soundManager}from'../../lib/audio';
import{speakVHFDispatch}from'../../lib/audioService';

/**
 * Keep the driver screen mounted for the whole working session.
 * Trip changes must update in place: remounting the operational view restarts
 * GPS, audio, timers and transient UI and can feel like a frozen/reloaded app.
 *
 * Driver trip reconciliation already lives in CommercialAppProvider through
 * Realtime plus its lightweight visible-trip fallback. Do not request a full
 * commercial snapshot when Android fires focus/pageshow/visibility events:
 * that snapshot also loads clients, audit logs, vehicles and notifications and
 * can create a thundering herd when several drivers resume together.
 */
export const DriverMobileShell:React.FC=()=>{
 const{trips,drivers,currentUser,soundMuted}=useApp();
 const knownAssignedTripIds=useRef<Set<string>|null>(null);

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

 return <DriverIdentityCompletionGate><><DriverMobileView/><DriverReservationsPanel/><DriverRealtimeRadioReceiver/><DriverPushRegistration/></></DriverIdentityCompletionGate>;
};