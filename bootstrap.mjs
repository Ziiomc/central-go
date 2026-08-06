import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const dir = '.bootstrap';
const archive = `${dir}/project.tar.xz`;

if (!existsSync(archive)) {
  const parts = readdirSync(dir).filter((name) => /^part-\d+$/.test(name)).sort();
  if (parts.length !== 10) {
    console.error(`Se esperaban 10 partes del proyecto y se encontraron ${parts.length}.`);
    process.exit(1);
  }
  const encoded = parts.map((name) => readFileSync(`${dir}/${name}`, 'utf8')).join('');
  writeFileSync(archive, Buffer.from(encoded, 'base64'));
}

const result = spawnSync('tar', ['-xJf', archive], { stdio: 'inherit' });
if (result.status !== 0) {
  console.error('No se pudo preparar el código fuente de Central GO.');
  process.exit(result.status ?? 1);
}

const replacements = {
  "src/context/AppContext.tsx": [
    [
      "  autoAssignClosestDriver: (tripId: string) => void;\n",
      "  autoAssignClosestDriver: (tripId: string) => Driver | null;\n  unassignTrip: (tripId: string) => void;\n"
    ],
    [
      "  const autoAssignClosestDriver = (tripId: string) => {\n    const pendingTrip = trips.find((t) => t.id === tripId);\n    if (!pendingTrip) return;\n",
      "  const autoAssignClosestDriver = (tripId: string): Driver | null => {\n    const pendingTrip = trips.find((t) => t.id === tripId);\n    if (!pendingTrip) return null;\n"
    ],
    [
      "      addNotification('Despacho Automático', 'No hay móviles libres en este momento', 'warning');\n      return;\n",
      "      addNotification('Despacho Automático', 'No hay móviles libres en este momento', 'warning');\n      return null;\n"
    ],
    [
      "    assignTrip(tripId, closestDriver.id);\n  };\n\n  // CRUD Helpers\n",
      "    assignTrip(tripId, closestDriver.id);\n    return closestDriver;\n  };\n\n  const unassignTrip = (tripId: string) => {\n    const trip = trips.find((item) => item.id === tripId);\n    if (!trip || !trip.driverId || ['completed', 'cancelled'].includes(trip.status)) return;\n\n    const previousDriverId = trip.driverId;\n    const previousUnit = trip.driverUnitNumber || 'Móvil';\n\n    setTrips((prev) =>\n      prev.map((item) =>\n        item.id === tripId\n          ? {\n              ...item,\n              status: 'pending',\n              driverId: undefined,\n              driverUnitNumber: undefined,\n              driverName: undefined,\n              assignedAt: undefined,\n              enRouteAt: undefined,\n              arrivedAt: undefined,\n            }\n          : item\n      )\n    );\n\n    setDrivers((prev) =>\n      prev.map((driver) =>\n        driver.id === previousDriverId ? { ...driver, status: 'available' } : driver\n      )\n    );\n\n    addAuditLog('DESHACER_ASIGNACION', `Devolvió ${trip.code} a pendientes y liberó ${previousUnit}`);\n    addNotification('Asignación deshecha', `${trip.code} volvió a la cola de pendientes`, 'info', tripId);\n  };\n\n  // CRUD Helpers\n"
    ],
    [
      "        autoAssignClosestDriver,\n        settleDriverCommission,\n",
      "        autoAssignClosestDriver,\n        unassignTrip,\n        settleDriverCommission,\n"
    ]
  ],
  "src/components/Header.tsx": [
    [
      "  const unreadCount = notifications.filter((n) => !n.read).length;\n",
      "  const unreadCount = notifications.filter((n) => !n.read).length;\n  const compactCompanyName = currentCompany.name\n    .replace(/\\bradiotaxis?\\b/gi, '')\n    .replace(/\\s+/g, ' ')\n    .trim()\n    .replace(/^Central Go\\b/i, 'Central GO');\n"
    ],
    [
      "<span className=\"truncate max-w-[150px] font-semibold\">{currentCompany.name}</span>",
      "<span className=\"truncate max-w-[180px] font-semibold\">{compactCompanyName}</span>"
    ],
    [
      "            <span>+ Nueva Carrera (Exprés)</span>\n",
      "            <span>+ Nueva carrera</span>\n            <kbd className=\"rounded bg-black/15 px-1.5 py-0.5 text-[10px] font-black\">F2</kbd>\n"
    ]
  ],
  "src/components/modules/OperatorConsole.tsx": [
    [
      "import React, { useMemo, useState } from 'react';",
      "import React, { useEffect, useMemo, useState } from 'react';"
    ],
    [
      "  Plus,\n",
      "  Keyboard,\n  Plus,\n"
    ],
    [
      "  Users,\n",
      "  Undo2,\n  Users,\n  X,\n"
    ],
    [
      "    autoAssignClosestDriver,\n    updateTripStatus,\n",
      "    autoAssignClosestDriver,\n    unassignTrip,\n    updateTripStatus,\n"
    ],
    [
      "  const [search, setSearch] = useState('');\n",
      "  const [search, setSearch] = useState('');\n  const [assignmentToast, setAssignmentToast] = useState<{ tripId: string; tripCode: string; driverUnitNumber: string } | null>(null);\n  const [undoSeconds, setUndoSeconds] = useState(0);\n\n  useEffect(() => {\n    if (!assignmentToast) return;\n    setUndoSeconds(7);\n    const timer = window.setInterval(() => {\n      setUndoSeconds((seconds) => {\n        if (seconds <= 1) {\n          window.clearInterval(timer);\n          setAssignmentToast(null);\n          return 0;\n        }\n        return seconds - 1;\n      });\n    }, 1000);\n    return () => window.clearInterval(timer);\n  }, [assignmentToast]);\n\n  const handleAutoAssign = (tripId: string, tripCode: string) => {\n    const driver = autoAssignClosestDriver(tripId);\n    if (!driver) return;\n    setAssignmentToast({ tripId, tripCode, driverUnitNumber: driver.unitNumber });\n  };\n\n  const undoAssignment = () => {\n    if (!assignmentToast) return;\n    unassignTrip(assignmentToast.tripId);\n    setAssignmentToast(null);\n  };\n"
    ],
    [
      "          <button\n            onClick={() => setNewTripModalOpen(true)}\n            className=\"flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-amber-200 bg-amber-400 px-6 py-3 text-base font-black text-zinc-950 shadow-xl shadow-amber-500/20 transition hover:bg-amber-300 active:scale-[0.99] lg:w-auto\"\n          >\n            <Plus className=\"h-6 w-6\" strokeWidth={3} />\n            NUEVA CARRERA\n            <span className=\"rounded-md bg-black/10 px-2 py-1 text-[10px] font-bold\">F2</span>\n          </button>",
      "          <div className=\"hidden items-center gap-2 rounded-2xl border border-zinc-700/80 bg-zinc-950/70 px-4 py-3 text-xs text-zinc-300 lg:flex\">\n            <Keyboard className=\"h-5 w-5 text-amber-300\" />\n            <span className=\"font-bold text-white\">Atajos:</span>\n            <kbd className=\"rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 font-black text-amber-300\">F2</kbd>\n            <span>Nueva</span>\n            <kbd className=\"rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 font-black text-emerald-300\">Enter</kbd>\n            <span>Confirmar</span>\n            <kbd className=\"rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 font-black text-zinc-200\">Esc</kbd>\n            <span>Cerrar</span>\n          </div>\n          <button\n            onClick={() => setNewTripModalOpen(true)}\n            className=\"flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-amber-200 bg-amber-400 px-6 py-3 text-base font-black text-zinc-950 shadow-xl shadow-amber-500/20 transition hover:bg-amber-300 active:scale-[0.99] lg:hidden\"\n          >\n            <Plus className=\"h-6 w-6\" strokeWidth={3} />\n            NUEVA CARRERA\n            <span className=\"rounded-md bg-black/10 px-2 py-1 text-[10px] font-bold\">F2</span>\n          </button>"
    ],
    [
      "onClick={() => autoAssignClosestDriver(trip.id)}",
      "onClick={() => handleAutoAssign(trip.id, trip.code)}"
    ],
    [
      "text-zinc-500",
      "text-zinc-400"
    ],
    [
      "placeholder:text-zinc-600",
      "placeholder:text-zinc-500"
    ],
    [
      "      </section>\n    </div>\n  );\n};",
      "      </section>\n\n      {assignmentToast && (\n        <div className=\"fixed bottom-5 right-5 z-[70] w-[min(92vw,390px)] rounded-2xl border border-emerald-400/35 bg-[#101713] p-4 shadow-2xl shadow-black/60\" role=\"status\" aria-live=\"polite\">\n          <div className=\"flex items-start gap-3\">\n            <div className=\"rounded-xl bg-emerald-500/15 p-2 text-emerald-300\">\n              <CheckCircle2 className=\"h-5 w-5\" />\n            </div>\n            <div className=\"min-w-0 flex-1\">\n              <p className=\"font-extrabold text-white\">Carrera asignada al {assignmentToast.driverUnitNumber}</p>\n              <p className=\"mt-0.5 text-sm text-zinc-300\">{assignmentToast.tripCode} salió de la cola de pendientes.</p>\n              <button onClick={undoAssignment} className=\"mt-3 flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-200 hover:bg-emerald-500/20\">\n                <Undo2 className=\"h-4 w-4\" /> Deshacer ({undoSeconds}s)\n              </button>\n            </div>\n            <button onClick={() => setAssignmentToast(null)} aria-label=\"Cerrar confirmación\" className=\"rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white\">\n              <X className=\"h-4 w-4\" />\n            </button>\n          </div>\n        </div>\n      )}\n    </div>\n  );\n};"
    ]
  ],
  "src/components/modals/NewTripModal.tsx": [
    [
      "  Sparkles,\n",
      "  Keyboard,\n  Sparkles,\n"
    ],
    [
      "text-zinc-500",
      "text-zinc-400"
    ],
    [
      "placeholder:text-zinc-600",
      "placeholder:text-zinc-500"
    ],
    [
      "            <div>\n              <h2 id=\"new-trip-title\" className=\"text-xl font-black text-white\">Nueva carrera</h2>\n              <p className=\"text-xs text-zinc-400\">Origen, destino y móvil. Lo demás es opcional.</p>\n            </div>",
      "            <div>\n              <h2 id=\"new-trip-title\" className=\"text-xl font-black text-white\">Nueva carrera</h2>\n              <p className=\"text-xs text-zinc-400\">Origen, destino y móvil. Lo demás es opcional.</p>\n              <div className=\"mt-1.5 hidden items-center gap-1.5 text-[10px] text-zinc-400 sm:flex\">\n                <Keyboard className=\"h-3.5 w-3.5 text-amber-300\" />\n                <kbd className=\"rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-bold text-emerald-300\">Enter</kbd> despachar\n                <span>·</span>\n                <kbd className=\"rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-bold text-zinc-200\">Esc</kbd> cerrar\n              </div>\n            </div>"
    ],
    [
      "            <div className=\"text-sm text-zinc-400\">\n              Tarifa estimada: <strong className=\"text-amber-300\">${calculatedFare.toLocaleString('es-CL')}</strong>\n            </div>",
      "            <div>\n              <div className=\"text-sm text-zinc-300\">\n                Tarifa estimada: <strong className=\"text-amber-300\">${calculatedFare.toLocaleString('es-CL')}</strong>\n              </div>\n              <div className=\"mt-1 text-[11px] text-zinc-400\">Enter confirma · Esc cierra</div>\n            </div>"
    ]
  ]
};

for (const [file, fileReplacements] of Object.entries(replacements)) {
  let content = readFileSync(file, 'utf8');
  for (const [oldText, newText] of fileReplacements) {
    if (content.includes(newText)) continue;
    if (!content.includes(oldText)) {
      console.error(`No se encontró el bloque esperado para mejorar ${file}.`);
      process.exit(1);
    }
    content = content.split(oldText).join(newText);
  }
  writeFileSync(file, content);
}
console.log('Mejoras operativas de Central GO aplicadas.');
