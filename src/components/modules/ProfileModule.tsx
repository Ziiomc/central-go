import React from 'react';
import { useApp } from '../../context/AppContext';
import { User, Shield, Headphones, Car, Building2 } from 'lucide-react';

export const ProfileModule: React.FC = () => {
  const { currentUser, currentCompany } = useApp();

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-2 uppercase font-sans">
          <User className="w-6 h-6 text-blue-500" />
          Perfil de Usuario
        </h1>
        <p className="text-xs text-zinc-400 mt-1 font-sans">
          Credenciales de la sesión activa
        </p>
      </div>

      <div className="bg-[#0d0d0f] border border-zinc-800 rounded-xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 border-2 border-blue-500 flex items-center justify-center text-blue-400 font-extrabold text-2xl font-mono">
            {currentUser.name[0]}
          </div>
          <div>
            <div className="font-extrabold text-lg text-white">{currentUser.name}</div>
            <div className="text-xs text-blue-400 font-mono font-bold uppercase tracking-wider">{currentUser.role}</div>
            <div className="text-xs text-zinc-400 font-mono mt-0.5">{currentUser.email}</div>
          </div>
        </div>

        <div className="bg-[#121215] p-4 rounded-lg border border-zinc-800 space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-zinc-400 uppercase tracking-wider">Central:</span>
            <span className="text-white font-bold">{currentCompany.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400 uppercase tracking-wider">Frecuencia VHF:</span>
            <span className="text-blue-400 font-bold">{currentCompany.vhfFrequency}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
