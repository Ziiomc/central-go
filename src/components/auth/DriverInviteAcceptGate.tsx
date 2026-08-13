import React,{useEffect,useRef,useState}from'react';
import{Loader2,LogOut,ShieldCheck}from'lucide-react';
import{useAuth}from'../../context/AuthContext';
import{acceptDriverInvite,clearDriverInvite}from'../../lib/driverInvite';
import{AuthShell}from'./AuthShell';

export const DriverInviteAcceptGate:React.FC<{token:string}>=({token})=>{
 const{authUser,profile,signOut}=useAuth();
 const started=useRef(false);
 const[error,setError]=useState('');
 useEffect(()=>{if(started.current)return;started.current=true;const metadata=authUser?.user_metadata??{};const name=profile?.name||metadata.full_name||metadata.name||authUser?.email?.split('@')[0]||'Conductor';const phone=profile?.phone||metadata.phone||null;void acceptDriverInvite(token,{name,phone}).then(()=>{clearDriverInvite();window.localStorage.removeItem('centralgo:onboarding-intent');window.location.replace('/driver');}).catch(err=>setError(err instanceof Error?err.message:'No fue posible activar la invitación de la central.'));},[authUser?.email,authUser?.user_metadata,profile?.name,profile?.phone,token]);
 const useAnother=async()=>{clearDriverInvite();await signOut();window.location.replace('/');};
 return <AuthShell compact eyebrow="Alta autorizada por la central" title="Activando tu acceso de conductor"><div className="text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--cg-primary-soft)] text-[var(--cg-primary)]"><Loader2 className={`h-7 w-7 ${error?'':'animate-spin'}`}/></span><h1 className="cg-card-title mt-4 text-2xl">{error?'No pudimos completar el alta':'Ingresando a tu central…'}</h1><p className="cg-card-copy mt-2">{error||'Tu invitación está autorizada. Estamos creando tu ficha operativa para que puedas entrar directamente a la aplicación del conductor.'}</p>{!error&&<div className="cg-alert cg-alert-success mt-5"><ShieldCheck className="mr-1.5 inline h-4 w-4"/>Acceso inmediato autorizado por la central</div>}{error&&<button type="button" onClick={()=>void useAnother()} className="cg-primary-button mt-5"><LogOut className="h-4 w-4"/>Cerrar sesión y usar otra cuenta</button>}</div></AuthShell>;
};
