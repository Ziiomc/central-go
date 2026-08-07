import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  UserCheck,
  Search,
  Plus,
  Phone,
  MapPin,
  Star,
  Award,
  CreditCard,
} from 'lucide-react';

export const ClientsModule: React.FC = () => {
  const { clients, addClient } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [isVIP, setIsVIP] = useState(false);
  const [hasCurrentAccount, setHasCurrentAccount] = useState(false);

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addClient({
      companyId: 'comp-1',
      name,
      phone,
      email,
      frequentAddresses: address
        ? [{ label: 'Frecuente', address, lat: -35.8454, lng: -71.5979 }]
        : [],
      rating: 5.0,
      isVIP,
      hasCurrentAccount,
    });
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-2 uppercase font-sans">
            <UserCheck className="w-6 h-6 text-blue-500" />
            Directorio de Clientes Frecuentes & Empresas
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-sans">
            Gestión de pasajes habituales, cuentas corrientes corporativas y notas especiales
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-lg shadow-lg shadow-blue-900/30 transition flex items-center gap-2 border border-blue-400/20 uppercase tracking-wider"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Cliente</span>
        </button>
      </div>

      <div className="bg-[#0d0d0f] p-4 rounded-xl border border-zinc-800 shadow-lg">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por nombre o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#121215] border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 transition"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => (
          <div
            key={client.id}
            className="bg-[#0d0d0f] border border-zinc-800 rounded-xl p-5 space-y-4 shadow-xl hover:border-blue-500/30 transition"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-extrabold text-base text-white flex items-center gap-2">
                  <span>{client.name}</span>
                  {client.isVIP && (
                    <span className="text-xs bg-blue-500/20 text-blue-300 font-mono px-2 py-0.5 rounded border border-blue-500/30 uppercase tracking-wider">
                      VIP
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-400 font-mono mt-0.5">{client.phone}</div>
              </div>
              <span className="text-xs text-blue-400 font-mono font-bold">
                ★ {client.rating.toFixed(1)}
              </span>
            </div>

            {/* Frequent Addresses */}
            <div className="space-y-1 bg-[#121215] p-3 rounded-lg border border-zinc-800 text-xs text-zinc-300">
              <div className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">Domicilios Frecuentes</div>
              {client.frequentAddresses.map((addr, idx) => (
                <div key={idx} className="flex items-center gap-1.5 truncate">
                  <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">{addr.address}</span>
                </div>
              ))}
            </div>

            {client.notes && (
              <p className="text-xs text-zinc-400 italic bg-[#121215]/60 p-2.5 rounded-lg border border-zinc-800">
                "{client.notes}"
              </p>
            )}

            <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-zinc-800">
              <span className="text-zinc-400 uppercase tracking-wider">Viajes: <strong className="text-white">{client.totalTrips}</strong></span>
              {client.hasCurrentAccount && (
                <span className="text-blue-400 font-bold flex items-center gap-1 uppercase tracking-wider">
                  <CreditCard className="w-3.5 h-3.5" /> Cta Corriente
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d0d0f] border border-zinc-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-white uppercase tracking-tight">Nuevo Cliente / Cuenta Corriente</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-300 font-mono uppercase tracking-wider block">Nombre / Razón Social</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Estudio Jurídico Alvear"
                  required
                  className="w-full bg-[#121215] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 mt-1 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-300 font-mono uppercase tracking-wider block">Teléfono</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+56 9 8712 3456"
                  required
                  className="w-full bg-[#121215] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 mt-1 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-300 font-mono uppercase tracking-wider block">Dirección Habitual</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle Manuel Rodríguez 450, Linares"
                  className="w-full bg-[#121215] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 mt-1 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div className="flex gap-4 pt-2 text-xs text-zinc-300 font-mono">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVIP}
                    onChange={(e) => setIsVIP(e.target.checked)}
                    className="rounded bg-[#121215] border-zinc-800 text-blue-600 focus:ring-0"
                  />
                  <span>Cliente VIP</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasCurrentAccount}
                    onChange={(e) => setHasCurrentAccount(e.target.checked)}
                    className="rounded bg-[#121215] border-zinc-800 text-blue-600 focus:ring-0"
                  />
                  <span>Cuenta Corriente</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 py-2 bg-zinc-800 text-zinc-300 font-bold text-xs rounded-lg uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow uppercase tracking-wider"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
