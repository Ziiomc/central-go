import React from 'react';
import{BrainCircuit,CheckCircle2,Clock3,Headphones,HelpCircle,Keyboard,MapPinned,MonitorDown,Radio,Search,ShieldCheck,TrendingUp,UsersRound,XCircle,Zap}from'lucide-react';
import{DesktopInstallButton}from'../pwa/DesktopInstallButton';

export const HelpModule:React.FC=()=>{
 return <div className="mx-auto max-w-5xl space-y-5">
  <div><h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-white"><HelpCircle className="h-6 w-6 text-cyan-400"/>Soporte e información</h1><p className="mt-1 text-xs text-zinc-400">Ventajas operativas, despacho inteligente, instalación y ayuda para aprovechar Central GO.</p></div>

  <section className="overflow-hidden rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/[0.13] via-[#0d1722] to-cyan-500/[0.08] p-5 shadow-xl">
   <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-400 text-emerald-950"><BrainCircuit className="h-6 w-6"/></div><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-300">Fortaleza principal</p><h2 className="mt-1 text-lg font-black text-white">Despacho automático inteligente</h2><p className="mt-2 max-w-3xl text-xs leading-relaxed text-zinc-300">Central GO puede asignar cada solicitud usando disponibilidad, posición GPS, orden de fila y condiciones reales de la operación. Reduce pasos repetitivos, evita depender solamente de la radio y ayuda a responder antes, sin quitarle a la operadora el control para cambiar a modo manual.</p></div></div>
   <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Benefit icon={<Clock3/>} title="Respuesta más ágil" text="La solicitud entra y comienza su asignación sin esperar búsquedas manuales."/><Benefit icon={<MapPinned/>} title="Decisión con GPS" text="Considera la ubicación real y la cercanía al punto de retiro."/><Benefit icon={<UsersRound/>} title="Fila equitativa" text="Respeta disponibilidad y prioridad operativa de los móviles."/><Benefit icon={<Radio/>} title="Menos congestión" text="La información llega completa a la aplicación del conductor."/></div>
  </section>

  <section className="grid gap-3 md:grid-cols-3">
   <InfoCard icon={<TrendingUp/>} title="Más eficiencia para la central" text="La operadora atiende más solicitudes con una vista única de carreras, reservas, móviles y mapa, disminuyendo tareas duplicadas."/>
   <InfoCard icon={<ShieldCheck/>} title="Control y trazabilidad" text="Asignaciones, cambios, cancelaciones, estados y alertas quedan registrados para revisar la operación y respaldar decisiones."/>
   <InfoCard icon={<CheckCircle2/>} title="Continuidad flexible" text="La central puede mantener el despacho inteligente como modo fijo o pasar a manual cuando la situación requiera intervención directa."/>
  </section>

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

  <section className="rounded-2xl border border-blue-500/20 bg-[#0d1722] p-5"><div className="flex items-center gap-2 text-sm font-black text-white"><Headphones className="h-5 w-5 text-blue-300"/>Soporte Central GO</div><p className="mt-2 text-xs leading-relaxed text-zinc-400">Para informar una dificultad, anota qué estaba haciendo la operadora, la hora aproximada y el mensaje visible. Esto permite revisar el caso con rapidez sin interrumpir toda la sesión.</p><a href="mailto:ziiomc3@gmail.com" className="mt-4 inline-flex rounded-xl border border-blue-400/25 bg-blue-400/10 px-3 py-2 text-[10px] font-black text-blue-200">Contactar soporte · ziiomc3@gmail.com</a></section>
 </div>;
};

const Shortcut=({keys,label,icon}:{keys:string;label:string;icon?:React.ReactNode})=><div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/65 px-3 py-2.5">{icon}<kbd className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-black text-cyan-300">{keys}</kbd><span className="text-[10px] font-bold text-zinc-300">{label}</span></div>;
const Benefit=({icon,title,text}:{icon:React.ReactNode;title:string;text:string})=><div className="rounded-xl border border-white/[0.07] bg-black/20 p-3"><div className="flex items-center gap-2 text-[10px] font-black text-white"><span className="[&>svg]:h-4 [&>svg]:w-4 text-emerald-300">{icon}</span>{title}</div><p className="mt-1.5 text-[9px] leading-relaxed text-zinc-400">{text}</p></div>;
const InfoCard=({icon,title,text}:{icon:React.ReactNode;title:string;text:string})=><div className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-4"><div className="flex items-center gap-2 text-xs font-black text-white"><span className="[&>svg]:h-4 [&>svg]:w-4 text-cyan-300">{icon}</span>{title}</div><p className="mt-2 text-[10px] leading-relaxed text-zinc-400">{text}</p></div>;
