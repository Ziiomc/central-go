import React from 'react';
import{CheckCircle2,HelpCircle,Keyboard,MonitorDown,Search,ShieldCheck,XCircle,Zap}from'lucide-react';
import{DesktopInstallButton}from'../pwa/DesktopInstallButton';

export const HelpModule:React.FC=()=>{
 return <div className="mx-auto max-w-5xl space-y-5">
  <div><h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-white"><HelpCircle className="h-6 w-6 text-cyan-400"/>Ayuda de operación</h1><p className="mt-1 text-xs text-zinc-400">Atajos, instalación y protocolos esenciales de Central GO.</p></div>

  <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
   <div className="rounded-2xl border border-cyan-500/20 bg-[#0d1722] p-5 shadow-xl">
    <div className="flex items-center gap-2"><Keyboard className="h-5 w-5 text-cyan-300"/><h2 className="text-sm font-black text-white">Comandos rápidos</h2></div>
    <p className="mt-1 text-[10px] text-zinc-500">Los atajos ya no ocupan espacio permanente en la consola.</p>
    <div className="mt-4 grid gap-2 sm:grid-cols-2"><Shortcut keys="F2" label="Nueva carrera"/><Shortcut keys="F3" label="Cambiar vista de cola"/><Shortcut keys="Ctrl K" label="Búsqueda operativa global" icon={<Search className="h-3.5 w-3.5"/>}/><Shortcut keys="Esc" label="Cerrar búsqueda y menús"/></div>
   </div>
   <div className="rounded-2xl border border-blue-500/20 bg-[#0d1722] p-5 shadow-xl">
    <div className="flex items-center gap-2"><MonitorDown className="h-5 w-5 text-blue-300"/><h2 className="text-sm font-black text-white">Aplicación de escritorio</h2></div><p className="mt-2 text-xs leading-relaxed text-zinc-400">Instala Central GO como aplicación para abrir la central sin pestañas del navegador y mantener una experiencia más limpia.</p><div className="mt-4"><DesktopInstallButton/></div>
   </div>
  </section>

  <section className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-5 shadow-xl">
   <h2 className="flex items-center gap-2 text-sm font-extrabold text-white"><Zap className="h-5 w-5 text-blue-400"/>Modernización del trabajo tradicional</h2>
   <div className="mt-4 grid gap-4 text-xs md:grid-cols-2">
    <div className="space-y-2 rounded-xl border border-rose-500/20 bg-[#121215] p-4"><div className="flex items-center gap-1.5 text-sm font-bold text-rose-400"><XCircle className="h-4 w-4"/>Problemas de radio tradicional</div><ul className="list-inside list-disc space-y-1.5 text-zinc-400"><li>Conductores hablando al mismo tiempo.</li><li>Direcciones repetidas o mal escuchadas.</li><li>Sin ubicación exacta de taxis libres.</li><li>Asignación lenta y sin registro digital.</li></ul></div>
    <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-[#121215] p-4"><div className="flex items-center gap-1.5 text-sm font-bold text-emerald-400"><CheckCircle2 className="h-4 w-4"/>Operación Central GO</div><ul className="list-inside list-disc space-y-1.5 text-zinc-300"><li>Despacho directo a la pantalla del móvil.</li><li>GPS de la flota en tiempo real.</li><li>Asignación rápida con prioridad equitativa.</li><li>SOS con coordenadas y registro operacional.</li><li>La operadora conserva el control total.</li></ul></div>
   </div>
  </section>

  <section className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-5"><div className="flex items-center gap-2 text-sm font-black text-white"><ShieldCheck className="h-5 w-5 text-emerald-300"/>Regla de operación segura</div><p className="mt-2 text-xs leading-relaxed text-zinc-400">Antes de forzar el estado de un móvil, reasignar una carrera o cancelar un servicio en curso, confirma que la acción corresponde a la operación real. Central GO conserva el registro para trazabilidad.</p></section>
 </div>;
};

const Shortcut=({keys,label,icon}:{keys:string;label:string;icon?:React.ReactNode})=><div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/65 px-3 py-2.5">{icon}<kbd className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-black text-cyan-300">{keys}</kbd><span className="text-[10px] font-bold text-zinc-300">{label}</span></div>;
