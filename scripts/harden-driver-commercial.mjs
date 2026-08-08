import fs from 'node:fs';

function patch(path, fn) {
  const before = fs.readFileSync(path, 'utf8');
  const after = fn(before);
  if (after === before) throw new Error(`Sin cambios en ${path}`);
  fs.writeFileSync(path, after);
}

patch('src/lib/commercialRepository.ts', (source) => {
  let text = source;
  const unassignMarker = `export async function unassignTripAtomic(tripId: string, reason?: string): Promise<Trip> {\n  const { data, error } = await requireSupabase().rpc('centralgo_operator_unassign_trip', { p_trip_id: tripId, p_reason: reason ?? null });\n  if (error) throw error;\n  return mapTripRow(data);\n}\n`;
  if (!text.includes(unassignMarker)) throw new Error('unassignTripAtomic no encontrado');
  text = text.replace(unassignMarker, unassignMarker + `\nexport async function rejectDriverTripAtomic(tripId: string, reason?: string): Promise<Trip> {\n  const { data, error } = await requireSupabase().rpc('centralgo_driver_reject_trip', { p_trip_id: tripId, p_reason: reason ?? 'Rechazado por conductor' });\n  if (error) throw error;\n  return mapTripRow(data);\n}\n`);

  const resolveMarker = `export async function resolveDriverSos(driverId: string): Promise<void> {`;
  if (!text.includes(resolveMarker)) throw new Error('resolveDriverSos no encontrado');
  text = text.replace(resolveMarker, `export async function resolveOwnDriverSos(): Promise<void> {\n  const { error } = await requireSupabase().rpc('centralgo_driver_resolve_own_sos', { p_notes: 'Alerta desactivada por el conductor desde su PWA' });\n  if (error) throw error;\n}\n\n${resolveMarker}`);

  const insertDriverMarker = `export async function insertDriver(data: Omit<Driver, 'id' | 'rating' | 'totalTripsCompleted' | 'todayEarnings'>): Promise<Driver> {`;
  if (!text.includes(insertDriverMarker)) throw new Error('insertDriver no encontrado');
  text = text.replace(insertDriverMarker, `export async function assignCompanyUserByEmail(companyId: string, email: string, role: 'company_admin' | 'operator' | 'driver'): Promise<string> {\n  const { data, error } = await requireSupabase().rpc('centralgo_assign_company_user', { p_company_id: companyId, p_email: email.trim(), p_role: role });\n  if (error) throw error;\n  return String(data);\n}\n\n${insertDriverMarker}`);
  return text;
});

patch('src/context/CommercialAppProvider.tsx', (source) => {
  let text = source;
  text = text.replace(`  reportDriverLocation,\n  resolveDriverSos,`, `  reportDriverLocation,\n  rejectDriverTripAtomic,\n  resolveDriverSos,\n  resolveOwnDriverSos,`);
  text = text.replace(`  assignTripAtomic,`, `  assignCompanyUserByEmail,\n  assignTripAtomic,`);

  const oldReject = `  const rejectTripOffer = (tripId: string, reason: string) => unassignTrip(tripId, reason);`;
  if (!text.includes(oldReject)) throw new Error('rejectTripOffer no encontrado');
  text = text.replace(oldReject, `  const rejectTripOffer = async (tripId: string, reason: string) => {\n    if (currentRole !== 'driver') return unassignTrip(tripId, reason);\n    const before = trips.find((trip) => trip.id === tripId);\n    const trip = await rejectDriverTripAtomic(tripId, reason);\n    setTrips((items) => upsertById(items, trip));\n    if (before?.driverId) setDrivers((items) => items.map((driver) => driver.id === before.driverId ? { ...driver, status: 'available' } : driver));\n  };`);

  const oldResolve = `  const resolveDriverSOS = async (driverId: string) => {\n    await resolveDriverSos(driverId);`;
  if (!text.includes(oldResolve)) throw new Error('resolveDriverSOS no encontrado');
  text = text.replace(oldResolve, `  const resolveDriverSOS = async (driverId: string) => {\n    if (currentRole === 'driver') await resolveOwnDriverSos();\n    else await resolveDriverSos(driverId);`);

  const oldAddDriver = `  const addDriver = async (data: Omit<Driver, 'id' | 'rating' | 'totalTripsCompleted' | 'todayEarnings'>) => {\n    const driver = await insertDriver({ ...data, companyId: currentCompany.id });`;
  if (!text.includes(oldAddDriver)) throw new Error('addDriver no encontrado');
  text = text.replace(oldAddDriver, `  const addDriver = async (data: Omit<Driver, 'id' | 'rating' | 'totalTripsCompleted' | 'todayEarnings'>) => {\n    let linkedUserId = data.userId;\n    if (linkedUserId.includes('@')) {\n      linkedUserId = await assignCompanyUserByEmail(currentCompany.id, linkedUserId, 'driver');\n    }\n    const driver = await insertDriver({ ...data, userId: linkedUserId, companyId: currentCompany.id });`);
  return text;
});

patch('src/components/modules/DriversModule.tsx', (source) => {
  let text = source;
  if (!text.includes("../../config/runtime")) text = text.replace("import { Driver } from '../../types';", "import { Driver } from '../../types';\nimport { runtimeConfig } from '../../config/runtime';");
  text = text.replace("  const [phone, setPhone] = useState('');", "  const [phone, setPhone] = useState('');\n  const [accountEmail, setAccountEmail] = useState('');\n  const [formError, setFormError] = useState('');\n  const [saving, setSaving] = useState(false);");
  text = text.replace('  const handleAddSubmit = (e: React.FormEvent) => {', '  const handleAddSubmit = async (e: React.FormEvent) => {');
  text = text.replace("    e.preventDefault();\n    addDriver({", "    e.preventDefault();\n    setFormError('');\n    if (runtimeConfig.isCommercial && !accountEmail.includes('@')) { setFormError('El conductor debe crear primero su cuenta y debes indicar su correo.'); return; }\n    setSaving(true);\n    try {\n      await addDriver({");
  text = text.replace("      userId: `usr-${Date.now()}`,", "      userId: runtimeConfig.isCommercial ? accountEmail.trim() : `usr-${Date.now()}`," );
  const close = `    });\n    setIsAddModalOpen(false);\n  };`;
  if (!text.includes(close)) throw new Error('cierre add driver no encontrado');
  text = text.replace(close, `      });\n      setIsAddModalOpen(false);\n      setAccountEmail('');\n    } catch (err) {\n      setFormError(err instanceof Error ? err.message : 'No fue posible registrar al conductor.');\n    } finally {\n      setSaving(false);\n    }\n  };`);

  const phoneField = `<div>\n                <label className="text-xs text-zinc-300 font-mono uppercase tracking-wider block">Teléfono Móvil</label>`;
  if (!text.includes(phoneField)) throw new Error('campo teléfono no encontrado');
  text = text.replace(phoneField, `{runtimeConfig.isCommercial && (\n              <div>\n                <label className="text-xs text-zinc-300 font-mono uppercase tracking-wider block">Correo de cuenta Central GO</label>\n                <input type="email" value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} placeholder="conductor@correo.cl" required className="w-full bg-[#121215] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 mt-1 focus:outline-none focus:border-blue-500 transition" />\n                <p className="mt-1 text-[10px] text-zinc-500">El conductor debe haber creado previamente su cuenta.</p>\n              </div>\n            )}\n\n              ${phoneField}`);
  text = text.replace(`<div className="flex gap-2 pt-2">`, `{formError && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{formError}</div>}\n\n              <div className="flex gap-2 pt-2">`);
  text = text.replace('type="submit"\n                  className=', 'type="submit" disabled={saving}\n                  className=');
  return text;
});

patch('src/components/pwa/DriverMobileView.tsx', (source) => {
  let text = source;
  text = text.replace("import React, { useState, useEffect } from 'react';", "import React, { useState, useEffect, useRef } from 'react';");
  if (!text.includes("../../config/runtime")) text = text.replace("import centralGoLogo from '../../assets/images/central-go-logo.svg';", "import centralGoLogo from '../../assets/images/central-go-logo.svg';\nimport { runtimeConfig } from '../../config/runtime';");
  text = text.replace(`    cancelTrip,\n    createTrip,`, `    rejectTripOffer,\n    createTrip,\n    currentUser,`);

  const stateBlock = `  const [isGpsActive, setIsGpsActive] = useState<boolean>(false);\n  const [gpsText, setGpsText] = useState<string>('GPS Linares Activo');`;
  if (!text.includes(stateBlock)) throw new Error('GPS state no encontrado');
  text = text.replace(stateBlock, `${stateBlock}\n  const gpsWatchId = useRef<number | null>(null);\n  const lastGpsSent = useRef<{ at: number; lat: number; lng: number } | null>(null);`);

  const driverBlock = `  const [myDriverId, setMyDriverId] = useState<string>('drv-2');\n  const driver = drivers.find((d) => d.id === myDriverId) || drivers[0];`;
  if (!text.includes(driverBlock)) throw new Error('driver selector state no encontrado');
  text = text.replace(driverBlock, `  const [myDriverId, setMyDriverId] = useState<string>('drv-2');\n  const driver = runtimeConfig.isCommercial\n    ? drivers.find((d) => d.userId === currentUser.id)\n    : drivers.find((d) => d.id === myDriverId) || drivers[0];`);

  const gpsStart = text.indexOf('  const toggleRealGpsTracking = () => {');
  const activeComment = text.indexOf('  // Active assigned or in-progress trip for this driver', gpsStart);
  if (gpsStart < 0 || activeComment < 0) throw new Error('bloque GPS no encontrado');
  const newGps = `  const stopGpsTracking = () => {\n    if (gpsWatchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(gpsWatchId.current);\n    gpsWatchId.current = null;\n    setIsGpsActive(false);\n    setGpsText(runtimeConfig.isCommercial ? 'GPS detenido' : 'GPS Linares (Simulado)');\n  };\n\n  const toggleRealGpsTracking = () => {\n    if (!navigator.geolocation || !driver) {\n      setGpsText('GPS no disponible en navegador');\n      return;\n    }\n    if (isGpsActive) { stopGpsTracking(); return; }\n\n    setIsGpsActive(true);\n    setGpsText('Solicitando GPS de alta precisión…');\n    gpsWatchId.current = navigator.geolocation.watchPosition(\n      (pos) => {\n        const { latitude, longitude, accuracy } = pos.coords;\n        const now = Date.now();\n        const last = lastGpsSent.current;\n        const metersApprox = last ? Math.hypot((latitude-last.lat)*111320, (longitude-last.lng)*111320*Math.cos(latitude*Math.PI/180)) : Infinity;\n        const shouldSend = !last || now-last.at >= 8000 || metersApprox >= 15;\n        setGpsText(\`GPS EN VIVO · precisión ±\${Math.round(accuracy)} m\`);\n        if (shouldSend) {\n          lastGpsSent.current = { at: now, lat: latitude, lng: longitude };\n          void Promise.resolve(updateDriverLocation(driver.id, latitude, longitude, \`GPS \${latitude.toFixed(5)}, \${longitude.toFixed(5)}\`)).catch(() => setGpsText('Error enviando GPS a la central'));\n        }\n      },\n      (err) => {\n        stopGpsTracking();\n        setGpsText(err.code === 1 ? 'Permiso GPS denegado' : 'No fue posible obtener GPS');\n      },\n      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }\n    );\n  };\n\n  useEffect(() => () => {\n    if (gpsWatchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(gpsWatchId.current);\n  }, []);\n\n`;
  text = text.slice(0, gpsStart) + newGps + text.slice(activeComment);

  text = text.replace('    let timer: NodeJS.Timeout;', '    let timer: ReturnType<typeof setInterval>;');
  text = text.replace("      cancelTrip(incomingOffer.id, 'Expiró tiempo de respuesta del conductor');", "      void Promise.resolve(rejectTripOffer(incomingOffer.id, 'Expiró tiempo de respuesta del conductor')).catch(() => undefined);");
  text = text.replace("      cancelTrip(incomingOffer.id, 'Rechazado por conductor');", "      void Promise.resolve(rejectTripOffer(incomingOffer.id, 'Rechazado por conductor')).catch(() => undefined);");

  const selectorStart = `{/* Unit Switcher Selector */}\n          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-xs font-mono">`;
  if (!text.includes(selectorStart)) throw new Error('selector unidad no encontrado');
  text = text.replace(selectorStart, `{/* Unit Switcher Selector - solo demo */}\n          {runtimeConfig.isDemo && (\n          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-xs font-mono">`);
  const selectorEnd = `            </select>\n          </div>\n        </div>`;
  if (!text.includes(selectorEnd)) throw new Error('fin selector no encontrado');
  text = text.replace(selectorEnd, `            </select>\n          </div>\n          )}\n        </div>`);

  const simulator = `{/* Simulator Button to test active trip workflow immediately */}\n            <div className="pt-2 border-t border-zinc-800/80">`;
  if (!text.includes(simulator)) throw new Error('simulador no encontrado');
  text = text.replace(simulator, `{/* Simulator Button - exclusivamente demo */}\n            {runtimeConfig.isDemo && (\n            <div className="pt-2 border-t border-zinc-800/80">`);
  const simEnd = `              </button>\n            </div>\n          </div>\n        )}`;
  const simIndex = text.indexOf(simEnd, text.indexOf('exclusivamente demo'));
  if (simIndex < 0) throw new Error('fin simulador no encontrado');
  text = text.slice(0, simIndex) + `              </button>\n            </div>\n            )}\n          </div>\n        )}` + text.slice(simIndex + simEnd.length);

  const noDriver = `  if (!driver) return null;`;
  text = text.replace(noDriver, `  if (!driver) return (\n    <div className="max-w-md mx-auto rounded-2xl border border-amber-500/20 bg-zinc-950 p-6 text-zinc-100">\n      <h2 className="font-black">Cuenta de conductor sin móvil vinculado</h2>\n      <p className="mt-2 text-sm text-zinc-400">El administrador debe registrar este conductor usando el mismo correo de tu cuenta Central GO.</p>\n    </div>\n  );`);
  return text;
});

console.log('PWA comercial del conductor endurecida.');
