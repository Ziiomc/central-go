import React,{useEffect,useState}from'react';
import{IdCard,Loader2,MapPin,Phone,Save,ShieldCheck,UserRound}from'lucide-react';
import{normalizeIdentityDocument,validateDriverIdentity}from'../../lib/driverIdentity';
import{requireSupabase}from'../../lib/supabase';
import{AuthShell}from'./AuthShell';

type DriverIdentityStatus={found:boolean;complete:boolean;name:string;phone:string;nationalIdNumber:string;address:string;countryCode:string};

type DriverIdentityForm={name:string;phone:string;nationalIdNumber:string;address:string};

export const DriverIdentityCompletionGate:React.FC<{children:React.ReactNode}>=({children})=>{
 const[status,setStatus]=useState<DriverIdentityStatus|null>(null);
 const[form,setForm]=useState<DriverIdentityForm>({name:'',phone:'',nationalIdNumber:'',address:''});
 const[loading,setLoading]=useState(true);
 const[saving,setSaving]=useState(false);
 const[error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   setLoading(true);setError('');
   try{
    const{data,error:rpcError}=await requireSupabase().rpc('centralgo_get_my_driver_identity_status');
    if(rpcError)throw rpcError;
    if(!active)return;
    const next=(data??{})as DriverIdentityStatus;
    setStatus(next);
    setForm({name:next.name??'',phone:next.phone??'',nationalIdNumber:next.nationalIdNumber??'',address:next.address??''});
   }catch(err){if(active)setError(err instanceof Error?err.message:'No fue posible revisar tu ficha de conductor.');}
   finally{if(active)setLoading(false);}
  };
  void load();
  return()=>{active=false;};
 },[]);

 if(loading)return <main className="cg-auth-shell items-center justify-center"><div className="cg-card flex items-center gap-3 px-5 py-4"><Loader2 className="h-5 w-5 animate-spin text-[var(--cg-primary)]"/><span className="text-xs font-black text-[var(--cg-muted)]">Validando ficha de conductor…</span></div></main>;
 if(status?.complete||status?.found===false)return <>{children}</>;

 const countryCode=status?.countryCode??'CL';
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();
  const validationError=validateDriverIdentity(form,countryCode);
  if(validationError){setError(validationError);return;}
  setSaving(true);setError('');
  try{
   const normalizedDocument=normalizeIdentityDocument(form.nationalIdNumber,countryCode);
   const{data,error:rpcError}=await requireSupabase().rpc('centralgo_complete_my_driver_identity',{
    p_name:form.name.trim(),
    p_phone:form.phone.trim(),
    p_national_id_number:normalizedDocument,
    p_address:form.address.trim(),
   });
   if(rpcError)throw rpcError;
   const next=(data??{})as DriverIdentityStatus;
   setStatus({found:true,complete:true,name:next.name??form.name,phone:next.phone??form.phone,nationalIdNumber:next.nationalIdNumber??normalizedDocument,address:next.address??form.address,countryCode:next.countryCode??countryCode});
  }catch(err:any){setError(err?.code==='23505'?'Ese RUT o documento ya pertenece a otro conductor.':err instanceof Error?err.message:'No fue posible guardar tus datos.');}
  finally{setSaving(false);}
 };

 return <AuthShell compact eyebrow="Central GO · Conductor" title="Completa tus datos antes de continuar">
  <div className="rounded-2xl border border-[var(--cg-border)] bg-[var(--cg-primary-soft)] p-4">
   <p className="flex items-center gap-2 text-sm font-black text-[var(--cg-text)]"><ShieldCheck className="h-4 w-4 text-[var(--cg-primary)]"/>Ficha obligatoria de conductor</p>
   <p className="mt-1 text-[11px] leading-relaxed text-[var(--cg-muted)]">Tu cuenta de Google confirma el correo de acceso, pero no reemplaza tus datos personales. La central necesita estos antecedentes para identificarte correctamente.</p>
  </div>
  <form onSubmit={submit} className="cg-form mt-5">
   <label className="cg-field"><span className="flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5"/>Nombre completo</span><input required autoComplete="name" value={form.name} onChange={event=>setForm(current=>({...current,name:event.target.value}))} placeholder="Nombres y apellidos"/></label>
   <label className="cg-field"><span className="flex items-center gap-1.5"><IdCard className="h-3.5 w-3.5"/>{countryCode==='CL'?'RUT':'Documento de identidad'}</span><input required autoComplete="off" value={form.nationalIdNumber} onChange={event=>setForm(current=>({...current,nationalIdNumber:event.target.value}))} onBlur={()=>setForm(current=>({...current,nationalIdNumber:normalizeIdentityDocument(current.nationalIdNumber,countryCode)}))} placeholder={countryCode==='CL'?'12.345.678-5':'Documento de identidad'}/></label>
   <label className="cg-field"><span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5"/>Teléfono</span><input required type="tel" autoComplete="tel" value={form.phone} onChange={event=>setForm(current=>({...current,phone:event.target.value}))} placeholder="+56 9 1234 5678"/></label>
   <label className="cg-field"><span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5"/>Dirección particular</span><input required autoComplete="street-address" value={form.address} onChange={event=>setForm(current=>({...current,address:event.target.value}))} placeholder="Calle, número y sector"/></label>
   {error&&<div className="cg-alert cg-alert-error mt-0">{error}</div>}
   <button disabled={saving} className="cg-primary-button">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}{saving?'Guardando datos…':'Guardar datos y continuar'}</button>
   <p className="cg-auth-hint">Estos datos quedarán disponibles para la administración autorizada de tu central y podrán corregirse posteriormente desde la ficha del conductor.</p>
  </form>
 </AuthShell>;
};
