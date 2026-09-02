from pathlib import Path

path = Path('src/components/pwa/DriverMobileView.tsx')
text = path.read_text()

def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: esperaba 1 coincidencia y encontré {count}')
    text = text.replace(old, new, 1)

replace_once(
    "  UserCircle2, Wifi, X, XCircle,\n",
    "  UserCircle2, X, XCircle,\n",
    'quitar Wifi',
)

text = text.replace("'Sincronización pendiente.'", "'Actualización pendiente.'")
text = text.replace("'GPS activo · sincronización pendiente'", "'GPS activo · envío pendiente'")
text = text.replace("'Ubicación sincronizada con la central.'", "'Ubicación GPS activa para la central.'")

replace_once(
"""  const toggleGpsTracking = async () => {
    if (!navigator.geolocation || !driver) return setGpsText('GPS no disponible');
    if (localStorage.getItem(GPS_WANTED_KEY) === '1' && (isGpsActive || gpsWatchId.current !== null)) stopGpsTracking(true);
    else await startGpsTracking();
  };
""",
"""  const activateGpsFromHeader = async () => {
    if (!navigator.geolocation || !driver) {
      setGpsText('GPS no disponible');
      return;
    }
    localStorage.setItem(GPS_WANTED_KEY, '1');
    if (isGpsActive) {
      requestFreshPosition(true);
      return;
    }
    await startGpsTracking();
  };
""",
    'control GPS',
)

text = text.replace("setGpsText('Permite ubicación precisa para Central GO');", "setGpsText('Ubicación bloqueada · habilítala en permisos del sitio');")
text = text.replace("setGpsText('Permiso de ubicación denegado');", "setGpsText('Ubicación bloqueada · habilítala en permisos del sitio');")

replace_once(
"""              <div className=\"flex items-center gap-1.5 text-[8px]\">
                <span className={driver.status === 'available' ? 'text-emerald-300' : 'text-zinc-500'}>{driver.status === 'available' ? '● DISPONIBLE' : driver.status.toUpperCase()}</span>
                <span className=\"text-blue-300\"><Wifi className=\"mr-0.5 inline h-2.5 w-2.5\" />Sincronizado</span>
              </div>
            </div>
          </div>
          <button onClick={() => setProfileOpen(true)} className=\"flex h-11 w-11 touch-manipulation items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-950 text-zinc-300\" aria-label=\"Perfil y analíticas\">
            {driver.photoUrl||currentUser.avatarUrl?<img src={driver.photoUrl||currentUser.avatarUrl} alt=\"Mi perfil\" className=\"h-full w-full object-cover\"/>:<UserCircle2 className=\"h-5 w-5\" />}
          </button>
""",
"""              <div className=\"flex items-center gap-1.5 text-[8px]\">
                <span className={driver.status === 'available' ? 'text-emerald-300' : driver.status === 'paused' ? 'text-amber-300' : 'text-zinc-400'}>{driver.status === 'available' ? '● DISPONIBLE' : driver.status.toUpperCase()}</span>
              </div>
            </div>
          </div>
          <div className=\"flex items-center gap-1.5\">
            <button type=\"button\" onClick={() => void activateGpsFromHeader()} className={`grid h-11 w-11 touch-manipulation place-items-center rounded-xl border transition active:scale-95 ${isGpsActive ? 'border-blue-400/45 bg-blue-500/15 text-blue-200 shadow-[0_0_18px_rgba(59,130,246,0.16)]' : 'border-amber-400/40 bg-amber-500/10 text-amber-200'}`} aria-label={isGpsActive ? 'GPS activo. Actualizar ubicación' : 'Activar GPS'} title={isGpsActive ? 'GPS activo' : 'Activar GPS'}>
              <Navigation className=\"h-5 w-5\" />
            </button>
            <button onClick={() => setProfileOpen(true)} className=\"flex h-11 w-11 touch-manipulation items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-950 text-zinc-300\" aria-label=\"Perfil y analíticas\">
              {driver.photoUrl||currentUser.avatarUrl?<img src={driver.photoUrl||currentUser.avatarUrl} alt=\"Mi perfil\" className=\"h-full w-full object-cover\"/>:<UserCircle2 className=\"h-5 w-5\" />}
            </button>
          </div>
""",
    'encabezado GPS',
)

replace_once(
"""        <section className=\"rounded-xl border border-zinc-800 bg-[#121215] p-3\">
          <div className=\"flex items-center justify-between gap-2\">
            <div className=\"flex min-w-0 items-center gap-2\"><Navigation className={`h-4 w-4 ${isGpsActive ? 'text-blue-400' : 'text-zinc-600'}`} /><div className=\"min-w-0\"><p className=\"truncate text-[11px] font-bold\">{gpsText}</p><p className=\"truncate text-[8px] text-zinc-600\">{driver.currentLocation.address || 'Ubicación pendiente'}</p></div></div>
            <button onClick={() => void toggleGpsTracking()} className={`min-h-11 shrink-0 touch-manipulation rounded-lg border px-3 py-2 text-[10px] font-black ${isGpsActive ? 'border-blue-500/40 bg-blue-500/15 text-blue-300' : 'border-zinc-700 bg-zinc-900'}`}>{isGpsActive ? 'GPS ON' : 'Activar GPS'}</button>
          </div>
          {isIOSDevice() && <p className=\"mt-2 text-[8px] leading-relaxed text-zinc-600\">iPhone: mantén Ubicación Precisa habilitada. Al volver desde Mapas, Central GO fuerza una nueva lectura automáticamente.</p>}
        </section>
""",
"""        <section className={`rounded-xl border p-3 ${isGpsActive ? 'border-blue-500/25 bg-blue-500/[0.05]' : 'border-amber-500/25 bg-amber-500/[0.05]'}`}>
          <div className=\"flex items-center justify-between gap-2\">
            <div className=\"flex min-w-0 items-center gap-2\"><Navigation className={`h-4 w-4 ${isGpsActive ? 'text-blue-300' : 'text-amber-300'}`} /><div className=\"min-w-0\"><p className=\"truncate text-[11px] font-bold text-zinc-100\">{gpsText}</p><p className=\"truncate text-[8px] text-zinc-400\">{driver.currentLocation.address || 'Ubicación pendiente'}</p></div></div>
            <span className={`shrink-0 rounded-lg border px-2 py-1 text-[8px] font-black ${isGpsActive ? 'border-blue-400/30 bg-blue-400/10 text-blue-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>{isGpsActive ? 'GPS ACTIVO' : 'REVISAR GPS'}</span>
          </div>
          {!isGpsActive && <p className=\"mt-2 text-[8px] leading-relaxed text-amber-100/80\">Toca el icono GPS del encabezado para volver a solicitar ubicación. Si el navegador bloqueó el permiso, habilita Ubicación en los permisos del sitio o de la app.</p>}
          {isIOSDevice() && <p className=\"mt-2 text-[8px] leading-relaxed text-zinc-400\">iPhone: mantén Ubicación Precisa habilitada. Al volver desde Mapas, Central GO fuerza una nueva lectura automáticamente.</p>}
        </section>
""",
    'tarjeta GPS',
)

if 'Sincronizado' in text or 'Sincronización' in text or 'sincronización' in text:
    raise SystemExit('Aún queda texto de sincronización visible en DriverMobileView')
if 'toggleGpsTracking' in text:
    raise SystemExit('Aún queda el antiguo toggle GPS')

path.write_text(text)
print('Driver GPS UX actualizado correctamente')
