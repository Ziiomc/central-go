import React,{useEffect,useState}from'react';
import{Download,MonitorDown}from'lucide-react';
import{isPWAInstallPromptAvailable,isPWAStandalone,promptPWAInstall}from'../../lib/pwa';

export const DesktopInstallButton:React.FC=()=>{
 const[available,setAvailable]=useState(()=>isPWAInstallPromptAvailable());
 const[installed,setInstalled]=useState(()=>isPWAStandalone());
 const[hint,setHint]=useState('');
 useEffect(()=>{const installable=()=>setAvailable(true);const done=()=>{setInstalled(true);setAvailable(false);setHint('Central GO quedó instalada en este equipo.');};window.addEventListener('pwa-installable',installable);window.addEventListener('pwa-installed',done);return()=>{window.removeEventListener('pwa-installable',installable);window.removeEventListener('pwa-installed',done);};},[]);
 if(installed)return <div className="relative z-[220] isolate shrink-0"><span className="flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-[9px] font-black text-emerald-300 shadow-sm backdrop-blur"><MonitorDown className="h-3.5 w-3.5"/>Instalada en escritorio</span></div>;
 const install=async()=>{setHint('');if(!available&&!isPWAInstallPromptAvailable()){setHint('En Chrome o Edge abre el menú del navegador y elige “Instalar Central GO”.');return;}const accepted=await promptPWAInstall();setAvailable(false);setHint(accepted?'Instalación iniciada.':'Puedes instalarla cuando quieras.');};
 return <div className="relative z-[220] isolate shrink-0 overflow-visible"><button type="button" onClick={()=>void install()} className="relative z-[221] flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1.5 text-[9px] font-black text-cyan-300 shadow-sm backdrop-blur transition hover:-translate-y-px hover:bg-cyan-500/15"><Download className="h-3.5 w-3.5"/>Instalar en escritorio</button>{hint&&<div className="absolute bottom-full right-0 z-[260] mb-2 w-64 rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-[9px] leading-relaxed text-zinc-300 shadow-[0_18px_50px_rgba(0,0,0,.4)]">{hint}</div>}</div>;
};
