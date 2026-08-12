import React from 'react';
import { Keyboard } from 'lucide-react';
import { OperatorConsole } from './OperatorConsole';
import { ScheduledTripsStrip } from './ScheduledTripsStrip';

export const OperatorWorkspace:React.FC=()=> (
  <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-[#0d0d0f] px-3 py-2 text-[9px] text-zinc-500">
      <span className="mr-1 flex items-center gap-1.5 font-black uppercase tracking-wider text-zinc-400"><Keyboard className="h-3.5 w-3.5 text-amber-300"/>Comandos rápidos</span>
      <Shortcut keys="F2" label="Nueva carrera"/><Shortcut keys="F3" label="Cambiar vista de cola"/><Shortcut keys="Ctrl K" label="Buscar pedido / móvil"/><Shortcut keys="Esc" label="Cerrar menús"/>
    </div>
    <ScheduledTripsStrip />
    <OperatorConsole />
  </div>
);
const Shortcut=({keys,label}:{keys:string;label:string})=><span className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1"><kbd className="mr-1 font-black text-amber-300">{keys}</kbd>{label}</span>;
