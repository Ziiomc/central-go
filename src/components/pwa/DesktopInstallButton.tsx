import React,{useEffect,useState}from'react';
import{Download,MonitorDown}from'lucide-react';
import{isPWAInstallPromptAvailable,isPWAStandalone,promptPWAInstall}from'../../lib/pwa';

export const DesktopInstallButton:React.FC=()=>{
 const[available,setAvailable]=useState(()=>isPWAInstallPromptAvailable());
 const[installed,setInstalled]=useState(()=>isPWAStandalone());
 const[hint,setHint]=useState('');
 useEffect(()=>{const installable=()=>setAvailable(true);const done=()=>{setInstalled(true);setAvailable(false);setHint('Central GO quedó instalada en este equipo.');};window.addEventListener('pwa-installable',installable);window.addEventListener('pwa-installed',done);return()=>{window.removeEventListener('pwa-installable',installable);window.removeEventListener('pwa-installed',done);};},[]);
 if(installed)return <span className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[9px] font-black text-emerald-300"><MonitorDown className="h-3.5 w-3.5"/>Instalada en escritorio</span>;
 const install=async()=>{setHint('');if(!available&&!isPWAInstallPromptAvailable()){setHint('En Chrome o Edge abre el menú del navegador y elige “Instalar Central GO”.');return;}const accepted=await promptPWAInstall();setAvailable(false);setHint(accepted?'Instalación iniciada.':'Puedes instalarla cuando quieras.');};
 return <div className="relative"><button type="button" onClick={()=>void install()} className="flex items-center gap-1.5 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1.5 text-[9px] font-black text-cyan-300 hover:bg-cyan-500/15"><Download className="h-3.5 w-3.5"/>Instalar en escritorio</button>{hint&&<div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-[9px] leading-relaxed text-zinc-300 shadow-2xl">{hint}</div>}</div>;
};
