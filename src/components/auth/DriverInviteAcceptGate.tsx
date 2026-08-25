import React,{useEffect,useState}from'react';
import{ArrowLeft,Building2,CarFront,IdCard,Loader2,MapPin,Phone,UserRound}from'lucide-react';
import{ONBOARDING_INTENT_KEY,useAuth}from'../../context/AuthContext';
import{acceptDriverInvite,clearDriverInvite,resolveDriverInvite,type DriverInviteTarget}from'../../lib/driverInvite';
import{normalizeIdentityDocument,validateDriverIdentity}from'../../lib/driverIdentity';
import{AuthShell}from'./AuthShell';

export const DriverInviteAcceptGate:React.FC<{token:string}>=({token})=>{
 const{authUser,profile,signOut}=useAuth();
 const metadata=authUser?.user_metadata??{};
 const[name,setName]=useState(profile?.name||metadata.full_name||metadata.name||'');
 const[phone,setPhone]=useState(profile?.phone||metadata.phone||'');
 const[nationalIdNumber,setNationalIdNumber]=useState('');
 const[address,setAddress]=useState('');
 const[target,setTarget]=useState<DriverInviteTarget|null>(null);
 const[checking,setChecking]=useState(true);
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState('');

 useEffect(()=>{let active=true;void resolveDriverInvite(token).then(result=>{if(!active)return;if(!result)throw new Error('Este enlace de invitación ya no está activo.');setTarget(result);}).catch(err=>{if(active)setError(err instanceof Error?err.message:'No fue posible validar la invitación.');}).finally(()=>{if(active)setChecking(false);});return()=>{active=false;};},[token]);

 const submit=async(event:React.FormEvent)=>{event.preventDefault();if(!target)return;const identity={name,phone,nationalIdNumber,address};const validationError=validateDriverIdentity(identity,target.countryCode||'CL');if(validationError){setError(validationError);return;}setBusy(true);setError('');try{await acceptDriverInvite(token,{...identity,nationalIdNumber:normalizeIdentityDocument(nationalIdNumber,target.countryCode||'CL')});clearDriverInvite();window.localStorage.removeItem(ONBOARDING_INTENT_KEY);window.location.replace('/driver');}catch(err){setError(err instanceof Error?err.message:'No fue posible activar la invitación de la central.');setBusy(false);}};
 const useAnother=async()=>{clearDriverInvite();await signOut();window.location.replace('/');};

 return <AuthShell compact eyebrow="Alta autorizada por la central" title="Completa tus datos de conductor">
  <div className="flex items-start justify-between gap-4"><div><p className="cg-card-kicker">Central GO · Alta directa</p><h1 className="cg-card-title text-2xl">Confirma tu identidad</h1><p className="cg-card-copy mt-2">El nombre de Google no reemplaza tu ficha. Registra los datos que necesita la central.</p></div><button type="button" onClick={()=>void useAnother()} className="cg-subtle-button inline-flex shrink-0 items-center gap-1"><ArrowLeft className="h-3.5 w-3.5"/>Salir</button></div>
  <div className="mt-5 rounded-2xl border border-[var(--cg-border)] bg-[var(--cg-primary-soft)] p-4">{checking?<p className="flex items-center gap-2 text-xs font-black text-[var(--cg-text)]"><Loader2 className="h-4 w-4 animate-spin"/>Validando invitación…</p>:target?<><p className="flex items-center gap-2 text-sm font-black text-[var(--cg-text)]"><Building2 className="h-4 w-4 text-[var(--cg-primary)]"/>{target.companyName}</p><p className="mt-1 text-[11px] text-[var(--cg-muted)]">Los datos quedarán disponibles para la administración autorizada de esta central.</p></>:null}</div>
  <form onSubmit={submit} className="cg-form mt-5">
   <label className="cg-field"><span>Correo de acceso</span><input readOnly value={authUser?.email??''} className="opacity-70"/></label>
   <label className="cg-field"><span className="flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5"/>Nombre completo</span><input required autoComplete="name" value={name} onChange={event=>setName(event.target.value)} placeholder="Nombres y apellidos"/></label>
   <label className="cg-field"><span className="flex items-center gap-1.5"><IdCard className="h-3.5 w-3.5"/>RUT o documento</span><input required value={nationalIdNumber} onChange={event=>setNationalIdNumber(event.target.value)} onBlur={()=>setNationalIdNumber(value=>normalizeIdentityDocument(value,target?.countryCode||'CL'))} placeholder="12.345.678-5"/></label>
   <label className="cg-field"><span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5"/>Teléfono</span><input required type="tel" autoComplete="tel" value={phone} onChange={event=>setPhone(event.target.value)} placeholder="+56 9 1234 5678"/></label>
   <label className="cg-field"><span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5"/>Dirección particular</span><input required autoComplete="street-address" value={address} onChange={event=>setAddress(event.target.value)} placeholder="Calle, número y sector"/></label>
   {error&&<div className="cg-alert cg-alert-error mt-0">{error}</div>}
   <button disabled={busy||checking||!target} className="cg-primary-button">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<CarFront className="h-4 w-4"/>}{busy?'Guardando y entrando…':'Guardar datos y entrar'}</button>
  </form>
 </AuthShell>;
};
