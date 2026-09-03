import React,{useEffect,useRef,useState}from'react';
import{BellRing}from'lucide-react';
import{useAuth}from'../../context/AuthContext';
import{requireSupabase}from'../../lib/supabase';

const VAPID_PUBLIC_KEY='BEN4b02sauQecZUH30sIRi_tubjuPEmL9sWmvFgmwgJLKIvEj1DtDdAfff4xbYi3nCvgfB0p40R-IIdE0aEGwys';
const toUint8=(value:string)=>{const padding='='.repeat((4-value.length%4)%4);const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));};

export const DriverPushRegistration:React.FC=()=>{
 const{authUser}=useAuth();
 const[supported,setSupported]=useState(false);
 const[permission,setPermission]=useState<NotificationPermission>(()=>typeof Notification==='undefined'?'denied':Notification.permission);
 const[busy,setBusy]=useState(false);
 const[ready,setReady]=useState(false);
 const[hidden,setHidden]=useState(false);
 const subscribingRef=useRef(false);

 const persist=async(subscription:PushSubscription)=>{
  if(!authUser)return;
  const json=subscription.toJSON();
  const keys=json.keys;
  if(!keys?.p256dh||!keys.auth)throw new Error('push-keys-unavailable');
  const{error}=await requireSupabase().from('driver_push_subscriptions').upsert({user_id:authUser.id,endpoint:subscription.endpoint,p256dh:keys.p256dh,auth_key:keys.auth,user_agent:navigator.userAgent,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
  if(error)throw error;
 };

 const subscribe=async(requestPermission:boolean)=>{
  if(subscribingRef.current||!authUser||!('serviceWorker'in navigator)||!('PushManager'in window)||typeof Notification==='undefined')return;
  subscribingRef.current=true;setBusy(true);
  try{
   let next=Notification.permission;
   if(requestPermission&&next==='default')next=await Notification.requestPermission();
   setPermission(next);
   if(next!=='granted'){
    if(next==='denied')setHidden(true);
    return;
   }
   const registration=await navigator.serviceWorker.ready;
   let subscription=await registration.pushManager.getSubscription();
   if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toUint8(VAPID_PUBLIC_KEY)});
   await persist(subscription);
   setReady(true);
  }catch(error){
   // Push is an enhancement, never an operational blocker. Some Android/Chrome
   // builds reject PushManager registration even when normal app operation is
   // healthy. Keep that technical failure out of the driver's interface.
   console.warn('[Central GO] push registration unavailable',error);
   setHidden(true);
  }finally{subscribingRef.current=false;setBusy(false);}
 };

 useEffect(()=>{
  const ok='serviceWorker'in navigator&&'PushManager'in window&&typeof Notification!=='undefined';
  setSupported(ok);
  if(!ok)return;
  const syncPermission=()=>{
   const next=Notification.permission;
   setPermission(next);
   if(next==='granted')void subscribe(false);
   if(next==='denied')setHidden(true);
  };
  const onVisibility=()=>{if(document.visibilityState==='visible')syncPermission();};
  syncPermission();
  document.addEventListener('visibilitychange',onVisibility);
  window.addEventListener('focus',syncPermission);
  window.addEventListener('pageshow',syncPermission);
  return()=>{
   document.removeEventListener('visibilitychange',onVisibility);
   window.removeEventListener('focus',syncPermission);
   window.removeEventListener('pageshow',syncPermission);
  };
 },[authUser?.id]);

 if(!supported||ready||hidden||permission==='denied')return null;

 // Only a small optional action is shown while permission has not been decided.
 // No browser/Supabase error messages are ever rendered to the driver.
 return <button type="button" disabled={busy} onClick={()=>void subscribe(true)} className="fixed bottom-2 right-2 z-[170] flex max-w-[calc(100vw-1rem)] items-center gap-1.5 rounded-full border border-amber-400/35 bg-[#111114]/95 px-3 py-2 text-[10px] font-black text-amber-200 shadow-xl backdrop-blur-xl disabled:opacity-60" aria-label="Activar avisos de carreras">
  <BellRing className="h-4 w-4 shrink-0"/>
  <span>{busy?'Activando…':'Activar avisos'}</span>
 </button>;
};
