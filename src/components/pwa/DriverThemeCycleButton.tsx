import React,{useEffect,useState}from'react';
import{createPortal}from'react-dom';
import{Flame,Moon,Sun}from'lucide-react';
import{useColorTheme,type ColorTheme}from'../../lib/theme';

const DRIVER_THEMES:ColorTheme[]=['dark','light','fire'];
const labels:Record<ColorTheme,string>={dark:'Oscuro',light:'Claro',executive:'Ejecutivo',fire:'Fuego'};

export const DriverThemeCycleButton:React.FC=()=>{
 const{theme,setTheme}=useColorTheme();
 const[target,setTarget]=useState<HTMLElement|null>(null);

 useEffect(()=>{
  let mount:HTMLElement|null=null;
  const attach=()=>{
   if(mount?.isConnected)return;
   const header=document.querySelector<HTMLElement>('.cg-driver-app header');
   if(!header)return;
   const existing=header.querySelector<HTMLElement>('[data-centralgo-driver-theme-cycle="1"]');
   if(existing){mount=existing;setTarget(existing);return;}
   const node=document.createElement('div');
   node.dataset.centralgoDriverThemeCycle='1';
   node.className='ml-auto shrink-0';
   const profileButton=header.querySelector('button[aria-label="Perfil y analíticas"]');
   if(profileButton)header.insertBefore(node,profileButton);else header.appendChild(node);
   mount=node;setTarget(node);
  };
  attach();
  const observer=new MutationObserver(attach);observer.observe(document.body,{childList:true,subtree:true});
  return()=>{observer.disconnect();if(mount?.dataset.centralgoDriverThemeCycle==='1')mount.remove();setTarget(null);};
 },[]);

 if(!target)return null;
 const active:ColorTheme=DRIVER_THEMES.includes(theme)?theme:'dark';
 const next=DRIVER_THEMES[(DRIVER_THEMES.indexOf(active)+1)%DRIVER_THEMES.length];
 const Icon=active==='light'?Sun:active==='fire'?Flame:Moon;
 return createPortal(<button type="button" onClick={()=>setTheme(next)} className={`mr-1 grid h-9 w-9 place-items-center rounded-full border transition ${active==='fire'?'border-orange-400/45 bg-orange-500/15 text-orange-300':active==='light'?'border-sky-400/45 bg-sky-500/15 text-sky-300':'border-zinc-700 bg-zinc-950 text-zinc-300'}`} title={`Tema: ${labels[active]}. Cambiar a ${labels[next]}`} aria-label={`Tema ${labels[active]}; cambiar a ${labels[next]}`}><Icon className="h-4 w-4"/></button>,target);
};
