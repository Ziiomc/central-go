import React,{useMemo,useState}from'react';
import{Clipboard,Link2,UserPlus}from'lucide-react';
import{useApp}from'../../context/AppContext';
import{buildDriverInviteUrl}from'../../lib/driverInvite';

export const DriverInviteLinkPanel:React.FC<{companyId:string}>=({companyId})=>{
 const{currentCompany,currentRole}=useApp();
 const[message,setMessage]=useState('');
 const link=useMemo(()=>{if(!currentCompany?.code||currentCompany.id!==companyId)return'';try{return buildDriverInviteUrl(currentCompany.code);}catch{return'';}},[companyId,currentCompany?.code,currentCompany?.id]);
 if(currentRole!=='company_admin'||!link)return null;
 const copy=async()=>{try{await navigator.clipboard.writeText(link);setMessage('Enlace copiado. Envíalo al conductor por WhatsApp, correo o el canal que prefieras.');}catch{setMessage('No se pudo copiar automáticamente. Selecciona el enlace y cópialo manualmente.');}};
 return <section className="mb-4 rounded-2xl border border-blue-500/25 bg-blue-500/[0.06] p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="max-w-2xl"><p className="flex items-center gap-2 text-sm font-black text-blue-200"><UserPlus className="h-4 w-4"/>Reclutar nuevos conductores</p><p className="mt-1 text-[11px] leading-relaxed text-zinc-400">Comparte este enlace permanente. El conductor podrá crear su cuenta con Google o correo, completar su perfil y enviarte sus antecedentes. La invitación no lo incorpora automáticamente a la flota.</p></div><button type="button" onClick={()=>void copy()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white"><Clipboard className="h-4 w-4"/>Copiar enlace</button></div><div className="mt-3 flex min-w-0 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2.5"><Link2 className="h-4 w-4 shrink-0 text-blue-400"/><span className="min-w-0 flex-1 truncate text-[10px] text-zinc-400">{link}</span></div>{message&&<p className="mt-2 text-[10px] font-semibold text-emerald-300">{message}</p>}</section>;
};
