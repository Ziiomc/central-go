import React,{useEffect,useState}from'react';
import{Download,Loader2,MonitorDown}from'lucide-react';
import{isPWAInstallPromptAvailable,isPWAStandalone,promptPWAInstall}from'../../lib/pwa';

const waitForInstallPrompt=(timeoutMs=4500)=>new Promise<boolean>((resolve)=>{
 if(isPWAInstallPromptAvailable()){resolve(true);return;}
 let settled=false;
 let timer=0;
 const finish=(ready:boolean)=>{if(settled)return;settled=true;window.removeEventListener('pwa-installable',onReady);if(timer)window.clearTimeout(timer);resolve(ready);};
 const onReady=()=>finish(true);
 window.addEventListener('pwa-installable',onReady,{once:true});
 timer=window.setTimeout(()=>finish(isPWAInstallPromptAvailable()),timeoutMs);
});

export const DesktopInstallButton:React.FC=()=>{
 const[available,setAvailable]=useState(()=>isPWAInstallPromptAvailable());
 const[installed,setInstalled]=useState(()=>isPWAStandalone());
 const[installing,setInstalling]=useState(false);
 const[hint,setHint]=useState('');
 useEffect(()=>{const installable=()=>setAvailable(true);const done=()=>{setInstalled(true);setAvailable(false);setInstalling(false);setHint('Central GO quedó instalada en este equipo.');};window.addEventListener('pwa-installable',installable);window.addEventListener('pwa-installed',done);return()=>{window.removeEventListener('pwa-installable',installable);window.removeEventListener('pwa-installed',done);};},[]);
 if(installed)return <div className="relative z-[220] isolate shrink-0"><span className="flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-[9px] font-black text-emerald-300 shadow-sm backdrop-blur"><MonitorDown className="h-3.5 w-3.5"/>Instalada en escritorio</span></div>;
 const install=async()=>{
  if(installing)return;
  setInstalling(true);setHint('');
  try{
   let ready=available||isPWAInstallPromptAvailable();
   if(!ready){setHint('Preparando la instalación…');ready=await waitForInstallPrompt();}
   if(!ready){setHint('Tu navegador todavía no habilita la instalación automática. En Chrome o Edge espera unos segundos y vuelve a pulsar este botón.');return;}
   setHint('');
   const accepted=await promptPWAInstall();
   setAvailable(false);
   setHint(accepted?'Instalación iniciada.':'Instalación cancelada. Puedes intentarlo nuevamente desde este botón.');
  }finally{setInstalling(false);}
 };
 return <div className="relative z-[220] isolate shrink-0 overflow-visible"><button type="button" disabled={installing} onClick={()=>void install()} className="relative z-[221] flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1.5 text-[9px] font-black text-cyan-300 shadow-sm backdrop-blur transition hover:-translate-y-px hover:bg-cyan-500/15 disabled:cursor-wait disabled:opacity-70">{installing?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Download className="h-3.5 w-3.5"/>}{installing?'Preparando…':'Instalar en escritorio'}</button>{hint&&<div className="absolute bottom-full right-0 z-[260] mb-2 w-64 rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-[9px] leading-relaxed text-zinc-300 shadow-[0_18px_50px_rgba(0,0,0,.4)]">{hint}</div>}</div>;
};