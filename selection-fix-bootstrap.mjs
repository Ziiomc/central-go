import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const operatorPath = 'src/components/modules/OperatorConsole.tsx';
const mapPath = 'src/components/map/LiveMap.tsx';

for (const path of [operatorPath, mapPath]) {
  if (!existsSync(path)) {
    console.error(`No se encontró ${path} para aplicar la corrección de selección.`);
    process.exit(1);
  }
}

let operator = readFileSync(operatorPath, 'utf8');

const operatorReplacements = [
  [
`      if (event.key === 'Escape') {
        setDriverMenuId(null);
        setColumnsOpen(false);
      }`,
`      if (event.key === 'Escape') {
        setDriverMenuId(null);
        setColumnsOpen(false);
        setFocusDriverId(null);
      }`
  ],
  [
`  const focusDriver = (driver: Driver) => {
    setFocusDriverId(driver.id);
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setDriverMenuId(null);
  };`,
`  const focusDriver = (driver: Driver, toggle = true) => {
    const deselecting = toggle && focusDriverId === driver.id;
    setFocusDriverId(deselecting ? null : driver.id);
    if (!deselecting) {
      mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setDriverMenuId(null);
  };`
  ],
  [
`          onClick={() => selectedDriver && focusDriver(selectedDriver)}`,
`          onClick={() => selectedDriver && focusDriver(selectedDriver, false)}`
  ],
  [
`            onSelectDriver={(driver) => setFocusDriverId(driver.id)}`,
`            onSelectDriver={(driver) =>
              setFocusDriverId((current) => driver ? (current === driver.id ? null : driver.id) : null)
            }`
  ]
];

for (const [oldText, newText] of operatorReplacements) {
  if (!operator.includes(oldText)) {
    console.error('No se encontró un bloque esperado en OperatorConsole para corregir la selección.');
    process.exit(1);
  }
  operator = operator.replace(oldText, newText);
}

writeFileSync(operatorPath, operator);

let map = readFileSync(mapPath, 'utf8');

const mapReplacements = [
  [
`  onSelectDriver?: (driver: Driver) => void;`,
`  onSelectDriver?: (driver: Driver | null) => void;`
  ],
  [
`    darkTileLayer.addTo(map);
    mapInstanceRef.current = map;`,
`    darkTileLayer.addTo(map);
    mapInstanceRef.current = map;

    // Clicking an empty area returns the map to its neutral state.
    // Marker clicks do not bubble to the map in Leaflet, so selecting a taxi
    // still works normally while a background click safely deselects it.
    const clearDriverFocus = () => {
      map.closePopup();
      onSelectDriver?.(null);
    };
    map.on('click', clearDriverFocus);`
  ],
  [
`  // Focus a driver selected from the operational dashboard.
  useEffect(() => {`,
`  // When the dashboard clears its vehicle focus, close any popup that had
  // been reopened by the tracking effect.
  useEffect(() => {
    if (focusDriverId || !mapInstanceRef.current) return;
    mapInstanceRef.current.closePopup();
  }, [focusDriverId]);

  // Focus a driver selected from the operational dashboard.
  useEffect(() => {`
  ]
];

for (const [oldText, newText] of mapReplacements) {
  if (!map.includes(oldText)) {
    console.error('No se encontró un bloque esperado en LiveMap para corregir la selección.');
    process.exit(1);
  }
  map = map.replace(oldText, newText);
}

writeFileSync(mapPath, map);

console.log('Selección de móviles corregida: toggle, fondo del mapa y tecla Esc habilitados.');
