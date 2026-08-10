import React, { useState } from 'react';
import { Car, Plus, Search, Smartphone, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const DriversModule: React.FC = () => {
  const { drivers, vehicles, addDriver } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [unitNumber, setUnitNumber] = useState('Móvil ');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredDrivers = drivers.filter((driver) =>
    driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.phone.includes(searchTerm)
  );

  const resetForm = () => {
    setUnitNumber('Móvil ');
    setName('');
    setPhone('');
    setAccountEmail('');
    setLicenseNumber('');
    setLicenseExpiry('');
    setSelectedVehicleId('');
    setFormError('');
  };

  const handleAddSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (accountEmail.trim() && !accountEmail.includes('@')) {
      setFormError('El correo de acceso no es válido. Déjalo vacío si el conductor no usará la app.');
      return;
    }
    setSaving(true);
    try {
      await addDriver({
        userId: accountEmail.trim(),
        companyId: '',
        vehicleId: selectedVehicleId || undefined,
        unitNumber: unitNumber.trim(),
        name: name.trim(),
        phone: phone.trim(),
        licenseNumber: licenseNumber.trim(),
        licenseExpiry,
        photoUrl: '',
        status: 'offline',
        currentLocation: {
          lat: 0,
          lng: 0,
          address: 'Sin ubicación GPS reportada',
          lastUpdated: new Date().toISOString(),
        },
        commissionBalance: 0,
        sosActive: false,
      });
      resetForm();
      setIsAddModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No fue posible registrar al conductor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-2"><Users className="w-6 h-6 text-blue-500" />Conductores</h1>
          <p className="text-xs text-zinc-400 mt-1">Padrón real de conductores, vehículo asignado y acceso opcional a Central GO Conductor.</p>
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-2"><Plus className="w-4 h-4" />Registrar conductor</button>
      </div>

      <div className="bg-[#0d0d0f] p-4 rounded-xl border border-zinc-800">
        <div className="relative w-full md:w-96"><Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" /><input type="text" placeholder="Buscar por nombre, móvil o teléfono..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#121215] border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500" /></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDrivers.map((driver) => {
          const vehicle = vehicles.find((item) => item.id === driver.vehicleId);
          return (
            <article key={driver.id} className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl border border-blue-500/25 bg-blue-500/10 flex items-center justify-center text-blue-300 font-black">{driver.name.slice(0, 2).toUpperCase()}</div>
                  <div className="min-w-0"><div className="font-extrabold text-base text-white flex items-center gap-2"><span>{driver.unitNumber}</span><span className="text-xs text-blue-400">★ {driver.rating.toFixed(2)}</span></div><div className="text-xs text-zinc-300 font-semibold truncate">{driver.name}</div><div className="text-[10px] text-zinc-500 mt-0.5">{driver.phone}</div></div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border ${driver.status === 'available' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25' : driver.status === 'en_route' || driver.status === 'in_trip' ? 'bg-blue-500/10 text-blue-300 border-blue-500/25' : 'bg-zinc-900 text-zinc-500 border-zinc-800'}`}>{driver.status}</span>
              </div>

              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-zinc-600"><Car className="h-3.5 w-3.5 text-blue-400" />Vehículo</div><p className="mt-1 text-xs font-bold text-zinc-300">{vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.licensePlate}` : 'Sin vehículo asignado'}</p></div>

              <div className="mt-3 grid grid-cols-2 gap-2"><MiniStat label="Viajes completados" value={String(driver.totalTripsCompleted)} /><MiniStat label="Recaudado hoy" value={`$${driver.todayEarnings.toLocaleString('es-CL')}`} /></div>

              <div className={`mt-3 flex items-center gap-2 rounded-xl border p-3 text-[10px] ${driver.userId ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200' : 'border-zinc-800 bg-zinc-950/50 text-zinc-500'}`}><Smartphone className="h-4 w-4 shrink-0" /><span>{driver.userId ? 'Cuenta vinculada: puede usar Central GO Conductor si su plan lo permite.' : 'Sin cuenta vinculada: disponible para despacho manual, sin PWA/GPS.'}</span></div>
            </article>
          );
        })}
      </div>
      {filteredDrivers.length === 0 && <div className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-10 text-center text-xs text-zinc-500">No hay conductores con este filtro.</div>}

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-zinc-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d0d0f] border border-zinc-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl">
            <div><h3 className="font-black text-lg text-white">Registrar conductor</h3><p className="mt-1 text-xs text-zinc-500">El correo de acceso es opcional. Para usar la app móvil, primero invita la cuenta desde Usuarios y Permisos.</p></div>
            <form onSubmit={handleAddSubmit} className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field label="Número de móvil" value={unitNumber} onChange={setUnitNumber} placeholder="Móvil 25" />
              <Field label="Nombre completo" value={name} onChange={setName} placeholder="Nombre y apellido" />
              <Field label="Teléfono" value={phone} onChange={setPhone} placeholder="+56 9 ..." />
              <Field label="Licencia" value={licenseNumber} onChange={setLicenseNumber} placeholder="N° licencia" />
              <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Vencimiento licencia</span><div className="mt-1 flex w-full min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5"><input required type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} className="block w-full min-w-0 border-0 bg-transparent p-0 text-sm text-zinc-200" /></div></label>
              <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Vehículo asignado</span><select value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-200"><option value="">Sin vehículo</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.unitNumber} · {vehicle.licensePlate}</option>)}</select></label>
              <div className="sm:col-span-2"><label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Correo de cuenta Central GO <span className="normal-case font-normal text-zinc-700">(opcional)</span></label><input type="email" value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} placeholder="conductor@correo.cl" className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500" /><p className="mt-1.5 text-[10px] text-zinc-600">Start: déjalo vacío para despacho manual. Pro/Enterprise: invita primero al conductor y luego usa el mismo correo aquí.</p></div>
              {formError && <div className="sm:col-span-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{formError}</div>}
              <div className="sm:col-span-2 flex gap-2 pt-2"><button type="button" onClick={() => { resetForm(); setIsAddModalOpen(false); }} className="w-1/2 py-3 bg-zinc-800 text-zinc-300 font-bold text-xs rounded-xl">Cancelar</button><button type="submit" disabled={saving} className="w-1/2 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar conductor'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const MiniStat: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><p className="text-[9px] uppercase text-zinc-600">{label}</p><p className="mt-1 text-sm font-black text-white">{value}</p></div>;
const Field: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder: string }> = ({ label, value, onChange, placeholder }) => <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</span><input required value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500" /></label>;
