import React, { useState } from 'react';
import { Car, MailCheck, Pencil, Plus, Search, Smartphone, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { inviteCompanyUser } from '../../lib/userRepository';
import { updateDriverProfile } from '../../lib/driverManagementRepository';
import type { Driver } from '../../types';

export const DriversModule: React.FC = () => {
  const { drivers, vehicles, addDriver, currentCompany } = useApp();
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
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editUnitNumber, setEditUnitNumber] = useState('');
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLicenseNumber, setEditLicenseNumber] = useState('');
  const [editLicenseExpiry, setEditLicenseExpiry] = useState('');
  const [editVehicleId, setEditVehicleId] = useState('');
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [driverOverrides, setDriverOverrides] = useState<Record<string, Partial<Driver>>>({});

  const visibleDrivers = drivers.map((driver) => driverOverrides[driver.id] ? { ...driver, ...driverOverrides[driver.id] } : driver);
  const filteredDrivers = visibleDrivers.filter((driver) =>
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

  const openEdit = (driver: Driver) => {
    setNotice('');
    setFormError('');
    setEditError('');
    setEditingDriver(driver);
    setEditUnitNumber(driver.unitNumber);
    setEditName(driver.name);
    setEditPhone(driver.phone);
    setEditLicenseNumber(driver.licenseNumber);
    setEditLicenseExpiry(driver.licenseExpiry || '');
    setEditVehicleId(driver.vehicleId || '');
  };

  const closeEdit = () => {
    if (editSaving) return;
    setEditingDriver(null);
    setEditError('');
  };

  const handleAddSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setNotice('');

    const normalizedEmail = accountEmail.trim().toLowerCase();
    if (!normalizedEmail.includes('@')) {
      setFormError('Ingresa el correo del conductor. Ese correo será su acceso personal a Central GO Conductor.');
      return;
    }

    setSaving(true);
    try {
      const access = await inviteCompanyUser({
        companyId: currentCompany.id,
        name: name.trim(),
        email: normalizedEmail,
        role: 'driver',
        redirectTo: 'https://central-go-one.vercel.app/driver',
      });

      await addDriver({
        userId: access.userId,
        companyId: currentCompany.id,
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

      setNotice(
        access.emailPending
          ? `${name.trim()} quedó registrado y vinculado al móvil. El correo de acceso está pendiente porque Supabase alcanzó temporalmente su límite de envío; puedes reenviarlo desde Usuarios y Permisos.`
          : `${name.trim()} quedó registrado. Enviamos el acceso a ${normalizedEmail}; al abrirlo podrá crear su contraseña y entrar directamente a Central GO Conductor.`
      );
      resetForm();
      setIsAddModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No fue posible registrar al conductor.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingDriver) return;
    setEditError('');
    setNotice('');
    setEditSaving(true);

    try {
      await updateDriverProfile({
        driverId: editingDriver.id,
        companyId: currentCompany.id,
        vehicleId: editVehicleId || undefined,
        unitNumber: editUnitNumber,
        name: editName,
        phone: editPhone,
        licenseNumber: editLicenseNumber,
        licenseExpiry: editLicenseExpiry,
      });

      const patch: Partial<Driver> = {
        vehicleId: editVehicleId || undefined,
        unitNumber: editUnitNumber.trim(),
        name: editName.trim(),
        phone: editPhone.trim(),
        licenseNumber: editLicenseNumber.trim(),
        licenseExpiry: editLicenseExpiry,
      };
      setDriverOverrides((current) => ({ ...current, [editingDriver.id]: patch }));
      window.setTimeout(() => {
        setDriverOverrides((current) => {
          const next = { ...current };
          delete next[editingDriver.id];
          return next;
        });
      }, 1800);

      setNotice(`${editName.trim()} fue actualizado correctamente. El vehículo y los datos del conductor quedaron sincronizados sin alterar su cuenta profesional.`);
      setEditingDriver(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'No fue posible actualizar al conductor.');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-2"><Users className="w-6 h-6 text-blue-500" />Conductores</h1>
          <p className="text-xs text-zinc-400 mt-1">Registra al conductor una sola vez: su correo recibe el acceso y queda vinculado al móvil automáticamente.</p>
        </div>
        <button onClick={() => { setNotice(''); setIsAddModalOpen(true); }} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-2"><Plus className="w-4 h-4" />Registrar conductor</button>
      </div>

      {notice && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-bold leading-relaxed text-emerald-200"><MailCheck className="mr-2 inline h-4 w-4" />{notice}</div>}
      {formError && !isAddModalOpen && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{formError}</div>}

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
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border ${driver.status === 'available' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25' : driver.status === 'en_route' || driver.status === 'in_trip' ? 'bg-blue-500/10 text-blue-300 border-blue-500/25' : 'bg-zinc-900 text-zinc-500 border-zinc-800'}`}>{driver.status}</span>
                  <button onClick={() => openEdit(driver)} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 text-[9px] font-black text-blue-300 transition hover:bg-blue-500/20"><Pencil className="h-3.5 w-3.5" />Editar</button>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-zinc-600"><Car className="h-3.5 w-3.5 text-blue-400" />Vehículo</div><p className="mt-1 text-xs font-bold text-zinc-300">{vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.licensePlate}` : 'Sin vehículo asignado'}</p></div>

              <div className="mt-3 grid grid-cols-2 gap-2"><MiniStat label="Viajes completados" value={String(driver.totalTripsCompleted)} /><MiniStat label="Recaudado hoy" value={`$${driver.todayEarnings.toLocaleString('es-CL')}`} /></div>

              <div className={`mt-3 flex items-center gap-2 rounded-xl border p-3 text-[10px] ${driver.userId ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200' : 'border-zinc-800 bg-zinc-950/50 text-zinc-500'}`}><Smartphone className="h-4 w-4 shrink-0" /><span>{driver.userId ? 'Cuenta profesional vinculada: GPS, carreras, estados, ganancias, comisiones y SOS.' : 'Sin cuenta vinculada.'}</span></div>
            </article>
          );
        })}
      </div>
      {filteredDrivers.length === 0 && <div className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-10 text-center text-xs text-zinc-500">No hay conductores con este filtro.</div>}

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-zinc-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0d0d0f] border border-zinc-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl my-auto">
            <div><h3 className="font-black text-lg text-white">Registrar conductor y enviar acceso</h3><p className="mt-1 text-xs leading-relaxed text-zinc-500">Central GO creará la cuenta del conductor, enviará el enlace para definir su contraseña y lo vinculará a este móvil en un solo paso.</p></div>
            <form onSubmit={handleAddSubmit} className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field label="Número de móvil" value={unitNumber} onChange={setUnitNumber} placeholder="Móvil 25" />
              <Field label="Nombre completo" value={name} onChange={setName} placeholder="Nombre y apellido" />
              <Field label="Teléfono" value={phone} onChange={setPhone} placeholder="+56 9 ..." />
              <Field label="Licencia" value={licenseNumber} onChange={setLicenseNumber} placeholder="N° licencia" />
              <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Vencimiento licencia</span><div className="mt-1 flex w-full min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5"><input required type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} className="block w-full min-w-0 border-0 bg-transparent p-0 text-sm text-zinc-200" /></div></label>
              <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Vehículo asignado</span><select value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-200"><option value="">Sin vehículo</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.unitNumber} · {vehicle.licensePlate}</option>)}</select></label>
              <div className="sm:col-span-2"><label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Correo personal del conductor</label><input required type="email" value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} placeholder="conductor@correo.cl" className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500" /><p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">A este correo llegará el acceso seguro. Al abrirlo creará su contraseña y Central GO lo llevará a su interfaz de conductor.</p></div>
              {formError && <div className="sm:col-span-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs leading-relaxed text-rose-200">{formError}</div>}
              <div className="sm:col-span-2 flex gap-2 pt-2"><button type="button" onClick={() => { resetForm(); setIsAddModalOpen(false); }} className="w-1/2 py-3 bg-zinc-800 text-zinc-300 font-bold text-xs rounded-xl">Cancelar</button><button type="submit" disabled={saving} className="w-1/2 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl disabled:opacity-50">{saving ? 'Creando acceso…' : 'Registrar y enviar acceso'}</button></div>
            </form>
          </div>
        </div>
      )}

      {editingDriver && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-zinc-950/85 p-4 backdrop-blur-md">
          <div className="my-auto w-full max-w-lg rounded-3xl border border-zinc-800 bg-[#0d0d0f] p-6 shadow-2xl">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-blue-300"><Pencil className="h-3.5 w-3.5" />Editar conductor</div>
              <h3 className="mt-3 text-lg font-black text-white">{editingDriver.name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">Puedes asignar ahora el vehículo que creaste o cambiar los datos operativos. Su cuenta profesional, contraseña, historial, ganancias y acceso permanecen intactos.</p>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field label="Número de móvil" value={editUnitNumber} onChange={setEditUnitNumber} placeholder="Móvil 25" />
              <Field label="Nombre completo" value={editName} onChange={setEditName} placeholder="Nombre y apellido" />
              <Field label="Teléfono" value={editPhone} onChange={setEditPhone} placeholder="+56 9 ..." />
              <Field label="Licencia" value={editLicenseNumber} onChange={setEditLicenseNumber} placeholder="N° licencia" />

              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Vencimiento licencia</span>
                <div className="mt-1 flex w-full min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5"><input required type="date" value={editLicenseExpiry} onChange={(e) => setEditLicenseExpiry(e.target.value)} className="block w-full min-w-0 border-0 bg-transparent p-0 text-sm text-zinc-200" /></div>
              </label>

              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Vehículo asignado</span>
                <select value={editVehicleId} onChange={(e) => setEditVehicleId(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-200">
                  <option value="">Sin vehículo</option>
                  {vehicles.map((vehicle) => {
                    const occupant = visibleDrivers.find((driver) => driver.vehicleId === vehicle.id && driver.id !== editingDriver.id);
                    return <option key={vehicle.id} value={vehicle.id} disabled={Boolean(occupant)}>{vehicle.unitNumber} · {vehicle.licensePlate}{occupant ? ` · asignado a ${occupant.unitNumber}` : ''}</option>;
                  })}
                </select>
                <p className="mt-1.5 text-[9px] leading-relaxed text-zinc-600">Los vehículos utilizados por otro conductor aparecen bloqueados para evitar una doble asignación.</p>
              </label>

              <div className="sm:col-span-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[10px] leading-relaxed text-emerald-200/80"><Smartphone className="mr-1.5 inline h-3.5 w-3.5" />La cuenta profesional vinculada a este conductor no será reemplazada ni desconectada.</div>
              {editError && <div className="sm:col-span-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs leading-relaxed text-rose-200">{editError}</div>}
              <div className="sm:col-span-2 flex gap-2 pt-2"><button type="button" onClick={closeEdit} disabled={editSaving} className="w-1/2 rounded-xl bg-zinc-800 py-3 text-xs font-bold text-zinc-300 disabled:opacity-50">Cancelar</button><button type="submit" disabled={editSaving} className="w-1/2 rounded-xl bg-blue-600 py-3 text-xs font-black text-white hover:bg-blue-500 disabled:opacity-50">{editSaving ? 'Guardando…' : 'Guardar cambios'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const MiniStat: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><p className="text-[9px] uppercase text-zinc-600">{label}</p><p className="mt-1 text-sm font-black text-white">{value}</p></div>;
const Field: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder: string }> = ({ label, value, onChange, placeholder }) => <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</span><input required value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500" /></label>;
