import React,{useEffect,useState}from'react';
import{Clipboard,Link2,Loader2,RefreshCw,UserPlus}from'lucide-react';
import{useApp}from'../../context/AppContext';
import{getDriverRecruitmentLink,type DriverRecruitmentLink}from'../../lib/driverInvite';

export const DriverInviteLinkPanel:React.FC<{companyId:string}>=({companyId})=>{
 const{currentRole}=useApp();
 const[recruitment,setRecruitment]=useState<DriverRecruitmentLink|null>(null);
 const[busy,setBusy]=useState(false);
 const[message,setMessage]=useState('');
 const[error,setError]=useState('');

 const load=async(rotate=false)=>{
  setBusy(true);setError('');setMessage('');
  try{const result=await getDriverRecruitmentLink(companyId,rotate);setRecruitment(result);if(rotate)setMessage('Nuevo enlace generado. El enlace anterior dejó de ser válido.');}
  catch(err){setError(err instanceof Error?err.message:'No fue posible generar el enlace de conductores.');}
  finally{setBusy(false);}
 };
 useEffect(()=>{if(currentRole==='company_admin')void load(false);},[companyId,currentRole]);
 if(currentRole!=='company_admin')return null;

 const copy=async()=>{if(!recruitment?.url)return;try{await navigator.clipboard.writeText(recruitment.url);setMessage('Enlace copiado. Quien se registre desde él quedará incorporado inmediatamente como conductor de esta central.');setError('');}catch{setError('No se pudo copiar automáticamente. Selecciona el enlace y cópialo manualmente.');}};

 return <section className="mb-4 rounded-2xl border border-blue-500/25 bg-blue-500/[0.06] p-4 sm:p-5">
  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
   <div className="max-w-2xl"><p className="flex items-center gap-2 text-sm font-black text-blue-200"><UserPlus className="h-4 w-4"/>Alta inmediata de conductores</p><p className="mt-1 text-[11px] leading-relaxed text-zinc-400">Comparte este enlace privado solo con conductores autorizados por tu central. Pueden crear su cuenta con Google o correo y comenzar a trabajar inmediatamente, sin subir cédula ni licencia.</p></div>
   <div className="flex shrink-0 gap-2"><button type="button" disabled={busy||!recruitment} onClick={()=>void copy()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Clipboard className="h-4 w-4"/>}Copiar enlace</button><button type="button" disabled={busy} onClick={()=>void load(true)} title="Generar un nuevo enlace e invalidar el anterior" className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-xs font-black text-zinc-300 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy?'animate-spin':''}`}/>Regenerar</button></div>
  </div>
  <div className="mt-3 flex min-w-0 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2.5"><Link2 className="h-4 w-4 shrink-0 text-blue-400"/><span className="min-w-0 flex-1 truncate text-[10px] text-zinc-400">{busy&&!recruitment?'Generando enlace privado…':recruitment?.url||'Enlace no disponible'}</span></div>
  <p className="mt-2 text-[10px] leading-relaxed text-amber-200/80">Este enlace equivale a una autorización de alta por parte de la central. Si deja de ser privado, pulsa Regenerar para invalidarlo.</p>
  {message&&<p className="mt-2 text-[10px] font-semibold text-emerald-300">{message}</p>}{error&&<p className="mt-2 text-[10px] font-semibold text-rose-300">{error}</p>}
 </section>;
};
