from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'{label}: expected block not found in {path}')
    p.write_text(text.replace(old, new, 1))

# Sidebar: give Tarifario its own direct, accessible item.
replace_once(
    'src/components/Sidebar.tsx',
    "  RadioTower,\n  Route,\n  Settings,",
    "  RadioTower,\n  ReceiptText,\n  Route,\n  Settings,",
    'sidebar import',
)
replace_once(
    'src/components/Sidebar.tsx',
    "    { id: 'reservations', group: 'Operación', label: 'Reservas', icon: CalendarClock, roles: ['company_admin', 'operator'] },\n    { id: 'drivers', group: 'Operación', label: 'Conductores', icon: Users, roles: ['company_admin', 'operator'] },",
    "    { id: 'reservations', group: 'Operación', label: 'Reservas', icon: CalendarClock, roles: ['company_admin', 'operator'] },\n    { id: 'tariff', group: 'Operación', label: 'Tarifario', icon: ReceiptText, roles: ['company_admin', 'operator'] },\n    { id: 'drivers', group: 'Operación', label: 'Conductores', icon: Users, roles: ['company_admin', 'operator'] },",
    'sidebar tariff item',
)
replace_once(
    'src/components/Sidebar.tsx',
    "    { id: 'settings', group: currentRole === 'operator' ? 'Operación' : 'Administración', label: currentRole === 'super_admin' ? 'Configuración Global' : currentRole === 'operator' ? 'Tarifario' : 'Configuración', icon: Settings, roles: ['super_admin', 'company_admin', 'operator'] },",
    "    { id: 'settings', group: 'Administración', label: currentRole === 'super_admin' ? 'Configuración Global' : 'Configuración', icon: Settings, roles: ['super_admin', 'company_admin'] },",
    'sidebar settings item',
)
replace_once(
    'src/components/Sidebar.tsx',
    "  const operatorCore = new Set(['dashboard', 'trips', 'reservations', 'drivers', 'settings', 'help']);",
    "  const operatorCore = new Set(['dashboard', 'trips', 'reservations', 'tariff', 'drivers', 'help']);",
    'sidebar operator core',
)

# App: authorize and render the direct Tarifario module.
replace_once(
    'src/App.tsx',
    "trips:['company_admin','operator'],reservations:['company_admin','operator'],drivers:['company_admin','operator']",
    "trips:['company_admin','operator'],reservations:['company_admin','operator'],tariff:['company_admin','operator'],drivers:['company_admin','operator']",
    'app tariff access',
)
replace_once(
    'src/App.tsx',
    "case'trips':return <TripsModule/>;case'reservations':return <ReservationsModule/>;case'drivers':return <DriversModule/>;",
    "case'trips':return <TripsModule/>;case'reservations':return <ReservationsModule/>;case'tariff':return <SettingsModule initialTab=\"tariff\" tariffOnly/>;case'drivers':return <DriversModule/>;",
    'app tariff route',
)

# SettingsModule: allow a direct tariff-only entry point.
replace_once(
    'src/components/modules/SettingsModule.tsx',
    "type SettingsTab='general'|'fare_values'|'tariff';\n\nexport const SettingsModule:React.FC=()=>{",
    "type SettingsTab='general'|'fare_values'|'tariff';\ntype SettingsModuleProps={initialTab?:SettingsTab;tariffOnly?:boolean};\n\nexport const SettingsModule:React.FC<SettingsModuleProps>=({initialTab='general',tariffOnly=false})=>{",
    'settings props',
)
replace_once(
    'src/components/modules/SettingsModule.tsx',
    " const[activeTab,setActiveTab]=useState<SettingsTab>('general');",
    " const[activeTab,setActiveTab]=useState<SettingsTab>(initialTab);",
    'settings initial tab',
)
replace_once(
    'src/components/modules/SettingsModule.tsx',
    " if(isOperator)return <div className=\"mx-auto max-w-4xl space-y-5\"><div className=\"rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-400/[0.08] to-transparent p-5\"><h1 className=\"flex items-center gap-2 text-2xl font-extrabold text-white\"><DollarSign className=\"h-6 w-6 text-amber-300\"/>Tarifario</h1><p className=\"mt-1 text-xs leading-relaxed text-zinc-400\">Hoja simple para consultar, agregar y mantener los valores por destino durante el despacho.</p></div>{tariffSheet}</div>;",
    " if(isOperator||tariffOnly)return <div className=\"mx-auto max-w-4xl space-y-5\"><div className=\"rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-400/[0.08] to-transparent p-5\"><h1 className=\"flex items-center gap-2 text-2xl font-extrabold text-white\"><DollarSign className=\"h-6 w-6 text-amber-300\"/>Tarifario</h1><p className=\"mt-1 text-xs leading-relaxed text-zinc-400\">Hoja simple para consultar, agregar y mantener los valores por destino durante el despacho.</p></div>{tariffSheet}</div>;",
    'settings tariff-only',
)

# LiveMap: replace the oversized driver card with a compact operational popup.
replace_once(
    'src/components/map/LiveMap.tsx',
    "import { ShieldAlert, Navigation, Layers, Crosshair } from 'lucide-react';\nimport { useColorTheme } from '../../lib/theme';",
    "import { ShieldAlert, Navigation, Layers, Crosshair } from 'lucide-react';\nimport { sendDriverRadioMessage } from '../../lib/driverOperations';\nimport { useColorTheme } from '../../lib/theme';",
    'map driver message import',
)
replace_once(
    'src/components/map/LiveMap.tsx',
    "  const { drivers, trips, vehicles, activeSOSDriver, setNewTripModalOpen, setVHFModalDriver } = useApp();",
    "  const { drivers, trips, vehicles, activeSOSDriver, setNewTripModalOpen, currentCompany, addAuditLog } = useApp();",
    'map app context',
)
old_popup = '''      const buildDriverPopup = () => {
        const popupContent = document.createElement('div');
        const safeName = escapePopupText(driver.name);
        const safePhone = escapePopupText(driver.phone || 'Sin teléfono');
        const safeTripCode = activeTrip ? escapePopupText(activeTrip.code) : '';
        const safeClient = activeTrip ? escapePopupText(activeTrip.clientName) : '';
        const safeDestination = activeTrip ? escapePopupText(activeTrip.destination.address) : '';
        popupContent.className = 'cg-map-popup';
        popupContent.innerHTML = `
            <div class="cg-map-popup__head">
              <div class="cg-map-popup__identity">
                <div class="cg-map-popup__unit">${escapePopupText(driver.unitNumber)}</div>
                <div class="cg-map-popup__person"><strong>${safeName}</strong><span>Móvil conectado · ${safePhone}</span></div>
              </div>
              <span class="cg-map-popup__status cg-map-popup__status--${statusTone}"><span></span>${statusText}</span>
            </div>
            <div class="cg-map-popup__metrics">
              <div><small>VELOCIDAD</small><strong>${speed} km/h</strong></div>
              <div><small>CALIFICACIÓN</small><strong>★ ${driver.rating.toFixed(1)}</strong></div>
              <div><small>VIAJES</small><strong>${driver.totalTripsCompleted}</strong></div>
            </div>
            ${activeTrip
              ? `<div class="cg-map-popup__trip"><small>EN OPERACIÓN · ${safeTripCode}</small><strong>${safeClient}</strong><span>Destino: ${safeDestination}</span></div>`
              : '<div class="cg-map-popup__trip cg-map-popup__trip--available"><small>OPERACIÓN</small><strong>Sin carrera activa</strong><span>Disponible para despacho</span></div>'}
            <div class="cg-map-popup__actions"><button id="btn-dispatch-${driver.id}" class="cg-map-popup__action cg-map-popup__action--dispatch">Despachar</button><button id="btn-vhf-${driver.id}" class="cg-map-popup__action cg-map-popup__action--radio">Radio VHF</button></div>
        `;
        return popupContent;
      };
      const existing = markersRef.current[driver.id];
      if (existing) {
        existing.setIcon(customIcon); existing.setLatLng([lat, lng]); existing.bindPopup(buildDriverPopup()); enableSmoothMarkerTransition(existing);
      } else {
        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        const popupContent = buildDriverPopup();
        marker.bindPopup(popupContent);
        marker.on('popupopen', () => {
          const btnDispatch = document.getElementById(`btn-dispatch-${driver.id}`);
          if (btnDispatch) btnDispatch.onclick = () => { onSelectDriver?.(driver); setNewTripModalOpen(true); };
          const btnVhf = document.getElementById(`btn-vhf-${driver.id}`);
          if (btnVhf) btnVhf.onclick = () => setVHFModalDriver(driver);
        });
        markersRef.current[driver.id] = marker;
        enableSmoothMarkerTransition(marker);
      }'''
new_popup = '''      const buildDriverPopup = () => {
        const popupContent = document.createElement('div');
        const canDispatch = !activeTrip && mapStatus === 'available';
        const canMessage = Boolean(driver.userId);
        popupContent.className = 'cg-map-popup cg-map-popup--quick';
        popupContent.innerHTML = `
          <div style="width:230px;max-width:68vw;padding:2px 1px;color:#e4e4e7">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
              <strong style="font-size:13px;color:white">Móvil ${escapePopupText(driver.unitNumber)}</strong>
              <span style="font-size:9px;font-weight:900;color:${statusColor}">${statusText}</span>
            </div>
            <div style="display:flex;gap:6px;margin-bottom:${canMessage ? '7px' : '0'}">
              ${canDispatch ? `<button id="btn-dispatch-${driver.id}" type="button" style="height:34px;flex:1;border:0;border-radius:9px;background:#2563eb;color:white;font-size:10px;font-weight:900;cursor:pointer">Despachar</button>` : ''}
              ${!canDispatch && activeTrip ? `<span style="font-size:9px;color:#a1a1aa">${escapePopupText(activeTrip.code)} · en carrera</span>` : ''}
            </div>
            ${canMessage ? `<form id="form-message-${driver.id}" style="display:flex;gap:5px"><input id="msg-input-${driver.id}" maxlength="180" autocomplete="off" placeholder="Escribir mensaje…" style="height:34px;min-width:0;flex:1;border:1px solid #3f3f46;border-radius:9px;background:#09090b;color:white;padding:0 9px;font-size:10px;outline:none"/><button id="btn-message-${driver.id}" type="submit" style="height:34px;border:0;border-radius:9px;background:#22d3ee;color:#083344;padding:0 10px;font-size:10px;font-weight:900;cursor:pointer">Enviar</button></form><div id="msg-status-${driver.id}" style="min-height:13px;margin-top:4px;font-size:8px;color:#a1a1aa">Enter para enviar</div>` : '<div style="font-size:9px;color:#f59e0b">Este móvil no tiene cuenta vinculada para mensajes.</div>'}
          </div>`;
        const dispatchButton = popupContent.querySelector<HTMLButtonElement>(`#btn-dispatch-${driver.id}`);
        if (dispatchButton) dispatchButton.onclick = () => {
          onSelectDriver?.(driver);
          setNewTripModalOpen(true);
          map.closePopup();
        };
        const form = popupContent.querySelector<HTMLFormElement>(`#form-message-${driver.id}`);
        const input = popupContent.querySelector<HTMLInputElement>(`#msg-input-${driver.id}`);
        const sendButton = popupContent.querySelector<HTMLButtonElement>(`#btn-message-${driver.id}`);
        const messageStatus = popupContent.querySelector<HTMLDivElement>(`#msg-status-${driver.id}`);
        if (form && input && sendButton && messageStatus) form.addEventListener('submit', (event) => {
          event.preventDefault();
          const message = input.value.trim();
          if (!message || sendButton.disabled) return;
          sendButton.disabled = true;
          messageStatus.textContent = 'Enviando…';
          void sendDriverRadioMessage(currentCompany.id, driver, message)
            .then(() => {
              addAuditLog('MENSAJE_MAPA', `Mensaje enviado desde mapa a Móvil ${driver.unitNumber}: "${message}"`);
              input.value = '';
              messageStatus.textContent = 'Mensaje enviado';
              messageStatus.style.color = '#6ee7b7';
            })
            .catch((error) => {
              messageStatus.textContent = error instanceof Error ? error.message : 'No fue posible enviar el mensaje.';
              messageStatus.style.color = '#fda4af';
            })
            .finally(() => { sendButton.disabled = false; });
        });
        return popupContent;
      };
      const existing = markersRef.current[driver.id];
      if (existing) {
        existing.setIcon(customIcon); existing.setLatLng([lat, lng]); existing.bindPopup(buildDriverPopup(), { maxWidth: 250, minWidth: 220 }); enableSmoothMarkerTransition(existing);
      } else {
        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        marker.bindPopup(buildDriverPopup(), { maxWidth: 250, minWidth: 220 });
        markersRef.current[driver.id] = marker;
        enableSmoothMarkerTransition(marker);
      }'''
replace_once('src/components/map/LiveMap.tsx', old_popup, new_popup, 'map quick popup')

# Driver connected list: make the connected count interactive and show colleagues + positions.
replace_once(
    'src/components/pwa/DriverPriorityCounter.tsx',
    "import{Users,Hash}from'lucide-react';",
    "import{Users,Hash,X}from'lucide-react';",
    'driver counter icons',
)
replace_once(
    'src/components/pwa/DriverPriorityCounter.tsx',
    " const[error,setError]=useState(false);\n const[host,setHost]=useState<HTMLElement|null>(null);",
    " const[error,setError]=useState(false);\n const[host,setHost]=useState<HTMLElement|null>(null);\n const[colleaguesOpen,setColleaguesOpen]=useState(false);",
    'driver counter state',
)
replace_once(
    'src/components/pwa/DriverPriorityCounter.tsx',
    '''   <div className="flex items-center gap-2 px-2.5 py-2">
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-500/15 text-cyan-300"><Users className="h-4 w-4"/></div>
    <div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[.12em] text-zinc-500">Conectados</p><p className="mt-0.5 text-xl font-black tabular-nums leading-none text-white">{driversLabel}</p></div>
   </div>''',
    '''   <button type="button" onClick={()=>setColleaguesOpen(true)} className="flex items-center gap-2 px-2.5 py-2 text-left transition hover:bg-cyan-500/[0.08]" aria-label={`Ver ${driversLabel} conductores conectados`} aria-expanded={colleaguesOpen}>
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-500/15 text-cyan-300"><Users className="h-4 w-4"/></div>
    <div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[.12em] text-zinc-500">Conectados</p><p className="mt-0.5 text-xl font-black tabular-nums leading-none text-white">{driversLabel}</p></div>
   </button>''',
    'driver connected button',
)
replace_once(
    'src/components/pwa/DriverPriorityCounter.tsx',
    " const inlineCard=host?createPortal(",
    " const statusLabel=(status:DriverQueueSnapshotItem['status'])=>status==='available'?'LIBRE':status==='paused'?'PAUSA':status==='en_route'?'EN CAMINO':status==='in_trip'?'EN VIAJE':status==='sos'?'SOS':'DESCONECTADO';\n const colleaguesPanel=colleaguesOpen?createPortal(<div className=\"fixed inset-0 z-[3200] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center\" onClick={()=>setColleaguesOpen(false)}><section onClick={event=>event.stopPropagation()} className=\"max-h-[72dvh] w-full max-w-sm overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#101014] shadow-2xl shadow-black/60\"><header className=\"flex items-center justify-between border-b border-zinc-800 px-4 py-3\"><div><p className=\"text-sm font-black text-white\">Móviles conectados</p><p className=\"mt-0.5 text-[9px] text-zinc-500\">Orden de la fila en tiempo real</p></div><button type=\"button\" onClick={()=>setColleaguesOpen(false)} className=\"grid h-8 w-8 place-items-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-400\" aria-label=\"Cerrar lista de conectados\"><X className=\"h-4 w-4\"/></button></header><div className=\"max-h-[58dvh] divide-y divide-zinc-800 overflow-y-auto\">{connected.map((item,index)=>{const isOwn=item.userId===currentUser.id;const waitingPosition=waiting.findIndex(candidate=>candidate.driverId===item.driverId);return <div key={item.driverId} className={`flex items-center gap-3 px-4 py-3 ${isOwn?'bg-blue-500/[0.08]':''}`}><span className=\"grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-xs font-black text-cyan-200\">{index+1}</span><div className=\"min-w-0 flex-1\"><p className=\"truncate text-sm font-black text-white\">Móvil {item.unitNumber}{isOwn?' · Tú':''}</p><p className=\"mt-0.5 text-[9px] font-bold text-zinc-500\">{waitingPosition>=0?`Posición ${waitingPosition+1} para despacho`:statusLabel(item.status)}</p></div><span className={`rounded-lg px-2 py-1 text-[8px] font-black ${item.status==='available'?'bg-emerald-500/10 text-emerald-300':item.status==='paused'?'bg-amber-500/10 text-amber-300':'bg-blue-500/10 text-blue-300'}`}>{statusLabel(item.status)}</span></div>;})}{!connected.length&&!error?<p className=\"px-4 py-8 text-center text-xs text-zinc-500\">No hay otros móviles conectados.</p>:null}{error?<p className=\"px-4 py-8 text-center text-xs text-rose-300\">No pudimos actualizar la fila. Intenta nuevamente.</p>:null}</div></section></div>,document.body):null;\n const inlineCard=host?createPortal(",
    'driver colleagues panel',
)
replace_once(
    'src/components/pwa/DriverPriorityCounter.tsx',
    " return <><DriverTripCancellationControl/>{inlineCard}</>;",
    " return <><DriverTripCancellationControl/>{inlineCard}{colleaguesPanel}</>;",
    'driver colleagues render',
)

print('patch applied')
