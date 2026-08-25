import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, MapPin, Printer, Pencil, Save, CalendarClock } from 'lucide-react';
import type { PaymentMethod } from '../../types';
import { runtimeConfig } from '../../config/runtime';
import { geocodeCommercialAddress } from '../../lib/geocoding';
import { updateTripDetails } from '../../lib/tripEditing';

const toLocalDateTime = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export const TripDetailModal: React.FC = () => {
  const { selectedTripForDetail, setSelectedTripForDetail, drivers, reassignTrip, currentCompany, addAuditLog } = useApp();
  const [newDriverId, setNewDriverId] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [operationError, setOperationError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [scheduledLocal, setScheduledLocal] = useState('');
  const [notes, setNotes] = useState('');
  const [fare, setFare] = useState(0);
  const [payment, setPayment] = useState<PaymentMethod>('efectivo');

  const trip = selectedTripForDetail;

  useEffect(() => {
    if (!trip) return;
    setClientName(trip.clientName);
    setClientPhone(trip.clientPhone);
    setOrigin(trip.origin.address);
    setDestination(trip.destination.address);
    setScheduledLocal(toLocalDateTime(trip.scheduledFor));
    setNotes(trip.notes ?? '');
    setFare(trip.finalFare ?? trip.estimatedFare);
    setPayment(trip.paymentMethod);
    setEditing(false);
    setOperationError('');
  }, [trip?.id]);

  if (!trip) return null;

  const availableDrivers = drivers.filter((d) => d.status === 'available');

  const handleReassign = async () => {
    if (newDriverId && !reassigning) {
      setReassigning(true);
      setOperationError('');
      try {
        await Promise.resolve(reassignTrip(trip.id, newDriverId));
        setSelectedTripForDetail(null);
      } catch (error) {
        setOperationError(error instanceof Error ? error.message : 'No fue posible confirmar la reasignación.');
      } finally {
        setReassigning(false);
      }
    }
  };

  const handleSave = async () => {
    if (saving) return;
    if (clientName.trim().length < 2 || origin.trim().length < 3 || destination.trim().length < 2) {
      setOperationError('Revisa cliente, origen y destino antes de guardar.');
      return;
    }
    if (scheduledLocal) {
      const scheduledDate = new Date(scheduledLocal);
      if (Number.isNaN(scheduledDate.getTime())) {
        setOperationError('La fecha u hora de la reserva no es válida.');
        return;
      }
    }

    setSaving(true);
    setOperationError('');
    try {
      let originPoint = { lat: trip.origin.lat, lng: trip.origin.lng };
      let destinationPoint = { lat: trip.destination.lat, lng: trip.destination.lng };
      if (runtimeConfig.isCommercial) {
        if (origin.trim() !== trip.origin.address.trim()) originPoint = await geocodeCommercialAddress(currentCompany.id, origin.trim());
        if (destination.trim() !== trip.destination.address.trim() && !/^a convenir/i.test(destination.trim())) destinationPoint = await geocodeCommercialAddress(currentCompany.id, destination.trim());
      }

      const changes = {
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || 'Sin teléfono',
        origin: { ...trip.origin, ...originPoint, address: origin.trim() },
        destination: { ...trip.destination, ...destinationPoint, address: destination.trim() },
        scheduledFor: scheduledLocal ? new Date(scheduledLocal).toISOString() : undefined,
        notes: notes.trim() || undefined,
        estimatedFare: Math.max(0, Number(fare) || 0),
        paymentMethod: payment,
      };

      if (runtimeConfig.isCommercial) {
        const updated = await updateTripDetails(trip.id, changes);
        setSelectedTripForDetail(updated);
      } else {
        setSelectedTripForDetail({ ...trip, ...changes });
      }
      addAuditLog('EDITAR_VIAJE', `Editó datos de ${trip.code}${scheduledLocal ? ` · reserva ${new Date(scheduledLocal).toLocaleString('es-CL')}` : ''}`);
      setEditing(false);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'No fue posible guardar los cambios de la carrera.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-md">
      <div className="relative max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl border border-zinc-800 bg-[#0d0d0f] p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-400">DESPACHO #{trip.code}</span>
              {trip.scheduledFor && <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-1 text-[10px] font-black text-sky-200"><CalendarClock className="h-3 w-3"/>RESERVA · {new Date(trip.scheduledFor).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}</span>}
            </div>
            <h2 className="font-extrabold text-lg uppercase tracking-tight text-white">Detalle de Servicio</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing((value) => !value)} className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black transition ${editing ? 'border-sky-400/30 bg-sky-400/10 text-sky-200' : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white'}`}><Pencil className="h-3.5 w-3.5"/>{editing ? 'Editando' : 'Editar'}</button>
            <button onClick={() => setSelectedTripForDetail(null)} className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"><X className="h-5 w-5" /></button>
          </div>
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <EditField label="Cliente" value={clientName} onChange={setClientName}/>
              <EditField label="Teléfono" value={clientPhone} onChange={setClientPhone}/>
            </div>
            <EditField label="Origen / retiro" value={origin} onChange={setOrigin}/>
            <EditField label="Destino" value={destination} onChange={setDestination}/>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs"><span className="font-black uppercase tracking-wider text-zinc-500">Hora de reserva · opcional</span><input type="datetime-local" value={scheduledLocal} onChange={(event)=>setScheduledLocal(event.target.value)} className="w-full rounded-lg border border-sky-400/20 bg-[#121215] px-3 py-2.5 text-zinc-100 outline-none [color-scheme:dark] focus:border-sky-400/50"/><span className="block text-[10px] text-zinc-600">Vacío = carrera normal. Con hora = reserva.</span></label>
              <label className="space-y-1 text-xs"><span className="font-black uppercase tracking-wider text-zinc-500">Tarifa</span><input type="number" min="0" step="100" value={fare} onChange={(event)=>setFare(Number(event.target.value))} className="w-full rounded-lg border border-zinc-800 bg-[#121215] px-3 py-2.5 text-zinc-100 outline-none focus:border-blue-500/50"/></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs"><span className="font-black uppercase tracking-wider text-zinc-500">Forma de pago</span><select value={payment} onChange={(event)=>setPayment(event.target.value as PaymentMethod)} className="w-full rounded-lg border border-zinc-800 bg-[#121215] px-3 py-2.5 text-zinc-100 outline-none"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="posnet_tarjeta">Tarjeta</option><option value="cuenta_corriente">Cuenta corriente</option></select></label>
              <label className="space-y-1 text-xs"><span className="font-black uppercase tracking-wider text-zinc-500">Notas</span><input value={notes} onChange={(event)=>setNotes(event.target.value)} className="w-full rounded-lg border border-zinc-800 bg-[#121215] px-3 py-2.5 text-zinc-100 outline-none focus:border-blue-500/50"/></label>
            </div>
            <button onClick={handleSave} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-sky-400 disabled:opacity-50"><Save className="h-4 w-4"/>{saving ? 'Guardando cambios…' : 'Guardar cambios'}</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 rounded-lg border border-zinc-800 bg-[#121215] p-3 text-xs"><span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">Pasajero</span><div className="font-bold text-white">{trip.clientName}</div><div className="font-mono text-[11px] text-zinc-400">{trip.clientPhone}</div></div>
              <div className="space-y-1 rounded-lg border border-zinc-800 bg-[#121215] p-3 text-xs"><span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">Móvil Asignado</span><div className="font-bold text-emerald-400">{trip.driverUnitNumber || 'Sin Asignar'}</div><div className="text-[11px] text-zinc-400">{trip.driverName || '-'}</div></div>
            </div>

            {trip.scheduledFor && <div className="rounded-xl border border-sky-400/25 bg-sky-400/[0.08] px-4 py-3"><p className="text-[10px] font-black uppercase tracking-[.16em] text-sky-300">RESERVA · HORA DE RETIRO</p><p className="mt-1 text-lg font-black text-sky-100">{new Date(trip.scheduledFor).toLocaleString('es-CL',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</p></div>}

            <div className="space-y-2 rounded-lg border border-zinc-800 bg-[#121215] p-3.5 text-xs">
              <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><div><span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">Origen:</span><div className="font-semibold text-zinc-100">{trip.origin.address}</div></div></div>
              <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" /><div><span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">Destino:</span><div className="font-semibold text-zinc-100">{trip.destination.address}</div></div></div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#121215] p-3.5 font-mono text-xs"><div><span className="block text-[10px] uppercase tracking-wider text-zinc-400">Forma de Pago</span><div className="mt-0.5 font-bold uppercase text-white">{trip.paymentMethod}</div></div><div className="text-right"><span className="block text-[10px] uppercase tracking-wider text-zinc-400">{trip.isFixedFare ? 'Monto Acordado' : 'Tarifa'}</span><span className="text-lg font-extrabold text-amber-400">${(trip.finalFare ?? trip.estimatedFare).toLocaleString()}</span></div></div>
          </>
        )}

        {trip.status !== 'completed' && trip.status !== 'cancelled' && !editing && (
          <div className="space-y-2 border-t border-zinc-800 pt-3">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-blue-400">Reasignar a otro Móvil:</label>
            <div className="flex gap-2"><select value={newDriverId} onChange={(e) => setNewDriverId(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-[#121215] px-3 py-2 text-xs text-zinc-200"><option value="">-- Seleccionar Conductor --</option>{availableDrivers.map((d) => <option key={d.id} value={d.id}>{d.unitNumber} - {d.name}</option>)}</select><button onClick={handleReassign} disabled={!newDriverId || reassigning} className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-blue-500 disabled:opacity-50">{reassigning ? 'Confirmando…' : 'Reasignar'}</button></div>
          </div>
        )}

        {operationError && <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200">{operationError}</p>}

        <div className="flex items-center justify-between pt-1"><button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-200 transition hover:bg-zinc-700"><Printer className="h-4 w-4" /> Imprimir Voucher</button><button onClick={() => setSelectedTripForDetail(null)} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white">Cerrar</button></div>
      </div>
    </div>
  );
};

const EditField = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
  <label className="space-y-1 text-xs"><span className="font-black uppercase tracking-wider text-zinc-500">{label}</span><input value={value} onChange={(event)=>onChange(event.target.value)} className="w-full rounded-lg border border-zinc-800 bg-[#121215] px-3 py-2.5 text-zinc-100 outline-none focus:border-blue-500/50"/></label>
);
