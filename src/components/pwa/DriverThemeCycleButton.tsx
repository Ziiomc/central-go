import React from 'react';
import{Flame,Moon,Sun}from'lucide-react';
import{useColorTheme,type ColorTheme}from'../../lib/theme';

const DRIVER_THEMES:ColorTheme[]=['dark','light','fire'];
const labels:Record<ColorTheme,string>={dark:'Oscuro',light:'Claro',executive:'Ejecutivo',fire:'Fuego'};

/**
 * Driver theme control must remain fully owned by React.
 * Do not inject nodes into DriverMobileView with insertBefore/appendChild:
 * realtime driver updates can reconcile the header at the same time and leave
 * React pointing at a DOM sibling that no longer belongs to its parent.
 */
export const DriverThemeCycleButton:React.FC=()=>{
 const{theme,setTheme}=useColorTheme();
 const active:ColorTheme=DRIVER_THEMES.includes(theme)?theme:'dark';
 const next=DRIVER_THEMES[(DRIVER_THEMES.indexOf(active)+1)%DRIVER_THEMES.length];
 const Icon=active==='light'?Sun:active==='fire'?Flame:Moon;

 return <button
  type="button"
  data-centralgo-driver-theme-cycle="1"
  onClick={()=>setTheme(next)}
  className={`fixed right-14 top-3 z-[70] grid h-9 w-9 place-items-center rounded-full border shadow-lg backdrop-blur transition ${active==='fire'?'border-orange-400/45 bg-orange-950/90 text-orange-300':active==='light'?'border-sky-400/45 bg-white/95 text-sky-600':'border-zinc-700 bg-zinc-950/95 text-zinc-300'}`}
  title={`Tema: ${labels[active]}. Cambiar a ${labels[next]}`}
  aria-label={`Tema ${labels[active]}; cambiar a ${labels[next]}`}
 >
  <Icon className="h-4 w-4"/>
 </button>;
};
