import React,{useEffect,useRef,useState}from'react';
import{BellRing,ShieldAlert,X}from'lucide-react';
import{useAuth}from'../../context/AuthContext';
import{requireSupabase}from'../../lib/supabase';

const VAPID_PUBLIC_KEY='BEN4b02sauQecZUH30sIRi_tubjuPEmL9sWmvFgmwgJLKIvEj1DtDdAfff4xbYi3nCvgfB0p40R-IIdE0aEGwys';
const toUint8=(value:string)=>{const padding='='.repeat((4-value.length%4)%4);const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));};
const errorMessage=(value:unknown,fallback:string)=>{
 if(value instanceof Error&&value.message.trim())return value.message;
 if(value&&typeof value==='object'&&'message'in value&&typeof(value as{message?:unknown}).message==='string'){
  const message=String((value as{message:string}).message).trim();
  if(message)return message;
 }
 return fallback;
};

export const DriverPushRegistration:React.FC=()=>{
 const{authUser}=useAuth();
 const[supported,setSupported]=useState(false),[permission,setPermission]=useState<NotificationPermission>(()=>typeof Notification==='undefined'?'denied':Notification.permission),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[expanded,setExpanded]=useState(false),[error,setError]=useState('');
 const subscribingRef=useRef(false);

 const persist=async(subscription:PushSubscription)=>{
  if(!authUser)return;
  const json=subscription.toJSON();
  const keys=json.keys;
  if(!keys?.p256dh||!keys.auth)throw new Error('El navegador no entregó las claves Push.');
  const{error}=await requireSupabase().from('driver_push_subscriptions').upsert({user_id:authUser.id,endpoint:subscription.endpoint,p256dh:keys.p256dh,auth_key:keys.auth,user_agent:navigator.userAgent,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
  if(error)throw error;
 };

 const subscribe=async(requestPermission:boolean)=>{
  if(subscribingRef.current||!authUser||!('serviceWorker'in navigator)||!('PushManager'in window)||typeof Notification==='undefined')return;
  subscribingRef.current=true;setBusy(true);setError('');
  try{
   let next=Notification.permission;
   if(requestPermission&&next==='default'){
    try{next=await Notification.requestPermission();}catch{}
   }
   setPermission(next);
   if(next!=='granted'){
    if(next==='denied')setError('Chrome tiene las notificaciones bloqueadas. En los permisos de este sitio cambia Notificaciones a Permitir y vuelve a Central GO.');
    setExpanded(next==='denied');
    return;
   }
   const registration=await navigator.serviceWorker.ready;
   let subscription=await registration.pushManager.getSubscription();
   if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toUint8(VAPID_PUBLIC_KEY)});
   await persist(subscription);
   setReady(true);setExpanded(false);setError('');
  }catch(value){setError(errorMessage(value,'No fue posible activar avisos de carreras.'));setExpanded(true);}
  finally{subscribingRef.current=false;setBusy(false);}
 };

 useEffect(()=>{
  const ok='serviceWorker'in navigator&&'PushManager'in window&&typeof Notification!=='undefined';
  setSupported(ok);
  if(!ok)return;
  const syncPermission=()=>{
   const next=Notification.permission;
   setPermission(next);
   if(next==='granted')void subscribe(false);
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

 if(!supported||ready)return null;
 const blocked=permission==='denied';
 const checkAgain=()=>{
  if(typeof Notification==='undefined'||busy)return;
  const next=Notification.permission;
  setPermission(next);
  if(next==='granted')void subscribe(false);
  else{
   setError(next==='denied'?'Las notificaciones siguen bloqueadas. Permítelas en los ajustes/permisos de este sitio y regresa a Central GO.':'Toca Activar para autorizar los avisos de carreras.');
   setExpanded(true);
  }
 };

 if(!expanded){
  return <button type="button" disabled={busy} onClick={()=>blocked?setExpanded(true):void subscribe(true)} className={`fixed bottom-2 right-2 z-[170] flex max-w-[calc(100vw-1rem)] items-center gap-1.5 rounded-full border px-3 py-2 text-[10px] font-black shadow-xl backdrop-blur-xl disabled:opacity-60 ${blocked?'border-rose-400/35 bg-[#171115]/95 text-rose-200':'border-amber-400/35 bg-[#111114]/95 text-amber-200'}`} aria-label={blocked?'Avisos bloqueados':'Activar avisos de carreras'}>
   {blocked?<ShieldAlert className="h-4 w-4 shrink-0"/>:<BellRing className="h-4 w-4 shrink-0"/>}
   <span>{busy?'Activando…':blocked?'Avisos bloqueados':'Activar avisos'}</span>
  </button>;
 }

 return <div className={`fixed bottom-2 right-2 z-[170] w-[min(330px,calc(100vw-1rem))] rounded-2xl border p-3 shadow-2xl backdrop-blur-xl ${blocked?'border-rose-400/35 bg-[#171115]/95':'border-amber-400/35 bg-[#111114]/95'}`}>
  <div className="flex items-start gap-2.5">
   <div className={`mt-0.5 rounded-xl p-2 ${blocked?'bg-rose-500/10 text-rose-300':'bg-amber-400/10 text-amber-300'}`}>{blocked?<ShieldAlert className="h-4 w-4"/>:<BellRing className="h-4 w-4"/>}</div>
   <div className="min-w-0 flex-1">
    <p className="text-xs font-black text-white">Avisos de carreras</p>
    <p className={`mt-1 text-[10px] leading-relaxed ${blocked?'text-rose-200':'text-zinc-300'}`}>{error||'Activa las notificaciones para recibir carreras con la pantalla bloqueada.'}</p>
   </div>
   <button type="button" onClick={()=>setExpanded(false)} className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Cerrar aviso"><X className="h-4 w-4"/></button>
  </div>
  <div className="mt-2.5 flex justify-end gap-2">
   {blocked?<button type="button" disabled={busy} onClick={checkAgain} className="rounded-xl border border-rose-300/25 px-3 py-2 text-[10px] font-black text-rose-100 disabled:opacity-60">Comprobar</button>:<button type="button" disabled={busy} onClick={()=>void subscribe(true)} className="rounded-xl bg-amber-400 px-3 py-2 text-[10px] font-black text-zinc-950 disabled:opacity-60">{busy?'Activando…':'Activar'}</button>}
  </div>
 </div>;
};
