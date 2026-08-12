import React,{useEffect,useState}from'react';
import{BellRing,CheckCircle2}from'lucide-react';
import{useAuth}from'../../context/AuthContext';
import{requireSupabase}from'../../lib/supabase';

const VAPID_PUBLIC_KEY='BEN4b02sauQecZUH30sIRi_tubjuPEmL9sWmvFgmwgJLKIvEj1DtDdAfff4xbYi3nCvgfB0p40R-IIdE0aEGwys';
const toUint8=(value:string)=>{const padding='='.repeat((4-value.length%4)%4);const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));};

export const DriverPushRegistration:React.FC=()=>{
 const{authUser}=useAuth();
 const[supported,setSupported]=useState(false),[permission,setPermission]=useState<NotificationPermission>(()=>typeof Notification==='undefined'?'denied':Notification.permission),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState('');

 const persist=async(subscription:PushSubscription)=>{
  if(!authUser)return;
  const json=subscription.toJSON();
  const keys=json.keys;
  if(!keys?.p256dh||!keys.auth)throw new Error('El navegador no entregó las claves Push.');
  const{error}=await requireSupabase().from('driver_push_subscriptions').upsert({user_id:authUser.id,endpoint:subscription.endpoint,p256dh:keys.p256dh,auth_key:keys.auth,user_agent:navigator.userAgent,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
  if(error)throw error;
 };

 const subscribe=async(requestPermission:boolean)=>{
  if(!authUser||!('serviceWorker'in navigator)||!('PushManager'in window)||typeof Notification==='undefined')return;
  setBusy(true);setError('');
  try{
   let next=Notification.permission;
   if(requestPermission&&next==='default')next=await Notification.requestPermission();
   setPermission(next);
   if(next!=='granted')return;
   const registration=await navigator.serviceWorker.ready;
   let subscription=await registration.pushManager.getSubscription();
   if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toUint8(VAPID_PUBLIC_KEY)});
   await persist(subscription);setReady(true);
  }catch(e){setError(e instanceof Error?e.message:'No fue posible activar avisos de carreras.');}
  finally{setBusy(false);}
 };

 useEffect(()=>{
  const ok='serviceWorker'in navigator&&'PushManager'in window&&typeof Notification!=='undefined';setSupported(ok);if(ok&&Notification.permission==='granted')void subscribe(false);
 },[authUser?.id]);

 if(!supported||ready)return null;
 return <div className="fixed bottom-3 left-1/2 z-[170] w-[min(420px,calc(100vw-1rem))] -translate-x-1/2 rounded-2xl border border-amber-400/40 bg-[#111114]/95 p-3 shadow-2xl backdrop-blur-xl">
  <div className="flex items-start gap-3"><div className="rounded-xl bg-amber-400/10 p-2 text-amber-300">{permission==='granted'?<CheckCircle2 className="h-5 w-5"/>:<BellRing className="h-5 w-5"/>}</div><div className="min-w-0 flex-1"><p className="text-xs font-black text-white">Avisos de carreras con pantalla bloqueada</p><p className="mt-0.5 text-[10px] leading-relaxed text-zinc-400">Actívalos para que Android pueda avisarte aunque Central GO esté suspendido.</p>{error&&<p className="mt-1 text-[9px] text-rose-300">{error}</p>}</div><button disabled={busy||permission==='denied'} onClick={()=>void subscribe(true)} className="shrink-0 rounded-xl bg-amber-400 px-3 py-2 text-[9px] font-black text-zinc-950 disabled:opacity-40">{busy?'Activando…':permission==='denied'?'Bloqueado':'Activar'}</button></div>
 </div>;
};
