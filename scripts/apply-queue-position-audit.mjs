import fs from 'node:fs';

const replaceOnce = (text, oldText, newText, label) => {
  if (!text.includes(oldText)) throw new Error(`Missing patch anchor: ${label}`);
  return text.replace(oldText, newText);
};

// 1) Keep the persisted Postgres order authoritative. Presentation must never
// rewrite queueOrder based on status or mobile number.
{
  const path = 'src/lib/dispatchPriorityRepository.ts';
  let text = fs.readFileSync(path, 'utf8');
  const displayBlock = `/**
 * Pausa conserva el dispatch_queue_order real en Postgres durante su ventana de
 * recuperación, pero visualmente debe salir de entre los móviles libres. Por eso
 * recibe sólo en el snapshot de la consola un orden muy alto; al volver a
 * Disponible, una nueva carga vuelve a exponer su orden persistido original.
 * Los desconectados siguen siendo un bloque visual separado y ordenado por móvil.
 */
const displayQueueOrder=(item:DispatchQueueItem)=>{
  const match=item.unitNumber.match(/\\d+/);
  const numeric=match?Number(match[0]):Number.NaN;
  if(item.status==='paused')return Number.MAX_SAFE_INTEGER-100000+(Number.isFinite(numeric)?numeric:0);
  if(item.status==='offline')return Number.isFinite(numeric)?numeric:item.queueOrder;
  return item.queueOrder;
};

`;
  text = replaceOnce(text, displayBlock, '', 'remove fake display queue order');
  text = replaceOnce(
    text,
    ` return items.map((item)=>({...item,queueOrder:displayQueueOrder(item)}));`,
    ` return items;`,
    'return authoritative queue order',
  );
  fs.writeFileSync(path, text);
}

// 2) Operator console: a single sequential visible position map. Busy and paused
// drivers keep their slot; disconnected drivers stay visible at the end but are
// no longer given a fake active queue number.
{
  const path = 'src/components/modules/OperatorConsole.tsx';
  let text = fs.readFileSync(path, 'utf8');
  text = replaceOnce(
    text,
    `import { isQueueConnected, loadDispatchQueue, moveDispatchPriority, setTraditionalDriverAvailability, subscribeDispatchQueue, type DispatchQueueItem } from '../../lib/dispatchPriorityRepository';`,
    `import { isQueueConnected, loadDispatchQueue, moveDispatchPriority, setTraditionalDriverAvailability, sortDispatchQueueByConnection, subscribeDispatchQueue, type DispatchQueueItem } from '../../lib/dispatchPriorityRepository';`,
    'operator queue sort import',
  );

  const oldQueueDrivers = `  const queueDrivers = useMemo(() => queueItems
    .filter((item) => activeTripDriverIds.has(item.driverId) || item.serviceEnabled || item.status === 'offline')
    .sort((a, b) => {
      const disconnected = (item: DispatchQueueItem) => item.status === 'offline'
        || (item.operationMode === 'app' && item.status === 'available' && !isQueueConnected(item));
      const rank = (item: DispatchQueueItem) => disconnected(item) ? 2 : activeTripDriverIds.has(item.driverId) ? 1 : 0;
      const rankDifference = rank(a) - rank(b);
      if (rankDifference) return rankDifference;
      return a.queueOrder - b.queueOrder || a.unitNumber.localeCompare(b.unitNumber, 'es', { numeric: true });
    })
    .map((item) => drivers.find((driver) => driver.id === item.driverId))
    .filter((driver): driver is Driver => Boolean(driver)), [activeTripDriverIds, drivers, queueItems]);
`;

  const newQueueDrivers = `  const queueDrivers = useMemo(() => queueItems
    .filter((item) => activeTripDriverIds.has(item.driverId) || item.serviceEnabled || item.status === 'offline')
    .sort((a, b) => {
      const disconnected = (item: DispatchQueueItem) => item.status === 'offline'
        || (item.operationMode === 'app' && item.status === 'available' && !isQueueConnected(item));
      const aDisconnected = disconnected(a);
      const bDisconnected = disconnected(b);
      if (aDisconnected !== bDisconnected) return aDisconnected ? 1 : -1;
      if (aDisconnected && bDisconnected) return a.unitNumber.localeCompare(b.unitNumber, 'es', { numeric: true });
      return sortDispatchQueueByConnection(a, b);
    })
    .map((item) => drivers.find((driver) => driver.id === item.driverId))
    .filter((driver): driver is Driver => Boolean(driver)), [activeTripDriverIds, drivers, queueItems]);

  const queuePositionByDriverId = useMemo(() => {
    const positionHolders = queueItems
      .filter((item) => item.serviceEnabled && item.status !== 'offline' && item.status !== 'sos')
      .filter((item) => item.operationMode === 'app' || item.status === 'available')
      .sort(sortDispatchQueueByConnection);
    return new Map(positionHolders.map((item, index) => [item.driverId, index + 1]));
  }, [queueItems]);
`;
  text = replaceOnce(text, oldQueueDrivers, newQueueDrivers, 'operator authoritative queue block');

  text = replaceOnce(
    text,
    `<span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-black text-emerald-300">{queueDrivers.length}</span>`,
    `<span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-black text-emerald-300" title="Móviles con posición activa en la fila">{queuePositionByDriverId.size}</span>`,
    'operator active queue count',
  );

  text = replaceOnce(
    text,
    `              const atSupermarket = supermarketDriverIds.has(driver.id);\n              return (`,
    `              const atSupermarket = supermarketDriverIds.has(driver.id);\n              const queuePosition = queuePositionByDriverId.get(driver.id) ?? null;\n              return (`,
    'operator row queue position',
  );

  text = text.replaceAll('EN CARRERA · permanece visible al final de la fila.', 'EN CARRERA · conserva su posición en la fila.');

  const oldBadge = `<span className={\`grid h-6 w-6 shrink-0 place-items-center rounded-md border text-[10px] font-black \${disconnected ? 'border-rose-300/55 bg-rose-400/20 text-rose-100' : (paused || inTrip) ? 'border-amber-300/45 bg-amber-400/15 text-amber-200' : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300'}\`} title={disconnected ? 'Desconectado · al final de la fila' : paused ? \`Pausa · conserva la posición \${index + 1}\` : inTrip ? 'En carrera · al final de la fila' : \`Posición \${waitingIndex + 1} en la fila\`}>{index + 1}</span>`;
  const newBadge = `<span className={\`grid h-6 w-6 shrink-0 place-items-center rounded-md border text-[10px] font-black \${disconnected ? 'border-rose-300/55 bg-rose-400/20 text-rose-100' : (paused || inTrip) ? 'border-amber-300/45 bg-amber-400/15 text-amber-200' : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300'}\`} title={disconnected ? 'Desconectado · fuera de la fila activa' : paused ? \`Pausa · conserva la posición \${queuePosition ?? '—'}\` : inTrip ? \`En carrera · conserva la posición \${queuePosition ?? '—'}\` : \`Posición \${queuePosition ?? '—'} en la fila\`}>{queuePosition ?? '—'}</span>`;
  text = replaceOnce(text, oldBadge, newBadge, 'operator visible position badge');

  fs.writeFileSync(path, text);
}

// 3) The secondary priority board must not re-rank a mobile merely because it
// entered a trip. It can filter dispatchable rows, but their relative order is
// always the authoritative queue order.
{
  const path = 'src/components/modules/DispatchPriorityBoard.tsx';
  let text = fs.readFileSync(path, 'utf8');
  text = replaceOnce(
    text,
    `import{isQueueConnected,loadDispatchQueue,setDriverOperationMode,setTraditionalDriverAvailability,subscribeDispatchQueue,type DispatchQueueItem}from'../../lib/dispatchPriorityRepository';`,
    `import{isQueueConnected,loadDispatchQueue,setDriverOperationMode,setTraditionalDriverAvailability,sortDispatchQueueByConnection,subscribeDispatchQueue,type DispatchQueueItem}from'../../lib/dispatchPriorityRepository';`,
    'priority board sort import',
  );
  const oldSort = `const ordered=useMemo(()=>[...visibleQueue].sort((a,b)=>{const aBusy=activeByDriver.has(a.driverId)||['en_route','in_trip'].includes(a.status);const bBusy=activeByDriver.has(b.driverId)||['en_route','in_trip'].includes(b.status);if(aBusy!==bBusy)return aBusy?1:-1;return a.queueOrder-b.queueOrder||a.unitNumber.localeCompare(b.unitNumber,'es',{numeric:true});}),[visibleQueue,activeByDriver]);`;
  const newSort = `const ordered=useMemo(()=>[...visibleQueue].sort(sortDispatchQueueByConnection),[visibleQueue]);`;
  text = replaceOnce(text, oldSort, newSort, 'priority board stable sort');
  fs.writeFileSync(path, text);
}

// 4) Driver UI defensively sorts the snapshot even if transport/RPC ordering is
// ever changed. This keeps every driver on the same deterministic numbering.
{
  const path = 'src/components/pwa/DriverPriorityCounter.tsx';
  let text = fs.readFileSync(path, 'utf8');
  text = replaceOnce(
    text,
    ` const connected=useMemo(()=>queue.filter(item=>item.status!=='offline'),[queue]);`,
    ` const connected=useMemo(()=>[...queue].filter(item=>item.status!=='offline').sort((a,b)=>a.queueOrder-b.queueOrder||a.unitNumber.localeCompare(b.unitNumber,'es',{numeric:true})),[queue]);`,
    'driver deterministic snapshot sort',
  );
  fs.writeFileSync(path, text);
}

console.log('Central GO queue position audit patch applied.');
