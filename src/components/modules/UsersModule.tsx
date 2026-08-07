import React from 'react';
import { useApp } from '../../context/AppContext';
import { Lock, Shield, User, Headphones, Car, Building2 } from 'lucide-react';

export const UsersModule: React.FC = () => {
  const { currentRole } = useApp();

  const mockUsers = [
    { name: 'Ing. Roberto Paz', role: 'Administrador de Empresa', email: 'admin@radiotaxiroyal.com', status: 'Activo' },
    { name: 'Sonia Rodríguez', role: 'Operadora Central (Turno Mañana)', email: 'srodriguez@radiotaxiroyal.com', status: 'Activo' },
    { name: 'Lucía Maidana', role: 'Operadora Central (Turno Tarde)', email: 'lmaidana@radiotaxiroyal.com', status: 'Activo' },
    { name: 'Gustavo Rossi', role: 'Conductor (Móvil 12)', email: 'grossi@radiotaxiroyal.com', status: 'Activo' },
    { name: 'Carlos Mendoza', role: 'Conductor (Móvil 05)', email: 'cmendoza@radiotaxiroyal.com', status: 'Activo' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-2 uppercase font-sans">
          <Lock className="w-6 h-6 text-blue-500" />
          Usuarios y Permisos del Sistema
        </h1>
        <p className="text-xs text-zinc-400 mt-1 font-sans">
          Roles granulares, credenciales de acceso y niveles de seguridad
        </p>
      </div>

      <div className="bg-[#0d0d0f] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-[#121215] text-zinc-400 uppercase font-mono text-[10px] border-b border-zinc-800">
              <tr>
                <th className="p-4">Usuario</th>
                <th className="p-4">Email</th>
                <th className="p-4">Rol Asignado</th>
                <th className="p-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 font-sans">
              {mockUsers.map((u, i) => (
                <tr key={i} className="hover:bg-zinc-800/50 transition">
                  <td className="p-4 font-bold text-white">{u.name}</td>
                  <td className="p-4 font-mono text-zinc-400">{u.email}</td>
                  <td className="p-4 font-mono font-semibold text-blue-400">{u.role}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                      {u.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
