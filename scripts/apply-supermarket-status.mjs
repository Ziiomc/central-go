import fs from 'node:fs';

const path = 'src/components/modules/OperatorConsole.tsx';
let text = fs.readFileSync(path, 'utf8');

const replaceOnce = (oldText, newText, label) => {
  if (!text.includes(oldText)) throw new Error(`Missing patch anchor: ${label}`);
  text = text.replace(oldText, newText);
};

replaceOnce(
  "import { ArrowDown, ArrowLeft, CalendarClock, Car, Check, ChevronUp, Eye, GripVertical, LayoutPanelTop, Loader2, MapPin, Navigation, Pencil, PhoneCall, Pin, Plus, Power, RotateCcw, Search, Trash2, UserPlus, UserRound, Wand2, XCircle, Zap } from 'lucide-react';",
  "import { ArrowDown, ArrowLeft, CalendarClock, Car, Check, ChevronUp, Eye, GripVertical, LayoutPanelTop, Loader2, MapPin, Navigation, Pencil, PhoneCall, Pin, Plus, Power, RotateCcw, Search, ShoppingCart, Trash2, UserPlus, UserRound, Wand2, XCircle, Zap } from 'lucide-react';",
  'shopping cart import',
);

replaceOnce(
  "import { isQueueConnected, loadDispatchQueue, moveDispatchPriority, setTraditionalDriverAvailability, subscribeDispatchQueue, type DispatchQueueItem } from '../../lib/dispatchPriorityRepository';\n",
  "import { isQueueConnected, loadDispatchQueue, moveDispatchPriority, setTraditionalDriverAvailability, subscribeDispatchQueue, type DispatchQueueItem } from '../../lib/dispatchPriorityRepository';\nimport { requireSupabase } from '../../lib/supabase';\n",
  'supabase import',
);

replaceOnce(
  "  const [dispatchModeMessage, setDispatchModeMessage] = useState('');\n  const [now, setNow] = useState(synchronizedNow());\n",
  "  const [dispatchModeMessage, setDispatchModeMessage] = useState('');\n  const [now, setNow] = useState(synchronizedNow());\n  const [supermarketDriverIds, setSupermarketDriverIds] = useState<Set<string>>(() => new Set());\n  const [supermarketBusyId, setSupermarketBusyId] = useState<string | null>(null);\n  const [supermarketError, setSupermarketError] = useState('');\n",
  'supermarket state',
);

const queueAnchor = `    void refresh();
    const unsubscribe = subscribeDispatchQueue(currentCompany.id, () => { void refresh(); });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [currentCompany.id]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(\`${'${PRIORITY_HOLD_KEY}'}:${'${currentCompany.id}'}\`) || '{}') as Record<string, number>;
`;

const queueReplacement = `    void refresh();
    const unsubscribe = subscribeDispatchQueue(currentCompany.id, () => { void refresh(); });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [currentCompany.id]);

  useEffect(() => {
    if (currentCompany.id === 'network') {
      setSupermarketDriverIds(new Set());
      return;
    }

    const db = requireSupabase();
    let active = true;
    setSupermarketError('');

    const refreshSupermarket = async () => {
      const { data, error } = await db
        .from('drivers')
        .select('id,at_supermarket')
        .eq('company_id', currentCompany.id)
        .is('archived_at', null);
      if (!active) return;
      if (error) {
        setSupermarketError('No se pudo sincronizar el estado de supermercado.');
        return;
      }
      setSupermarketDriverIds(new Set((data ?? []).filter((row: any) => Boolean(row.at_supermarket)).map((row: any) => String(row.id))));
    };

    void refreshSupermarket();
    const channel = db
      .channel(\`centralgo-supermarket-${'${currentCompany.id}'}-${'${crypto.randomUUID()}'}\`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'drivers',
        filter: \`company_id=eq.${'${currentCompany.id}'}\`,
      }, (payload) => {
        if (!active) return;
        const row = payload.new as { id?: string; at_supermarket?: boolean };
        if (!row.id) return;
        setSupermarketDriverIds((current) => {
          const next = new Set(current);
          if (row.at_supermarket) next.add(row.id as string);
          else next.delete(row.id as string);
          return next;
        });
      })
      .subscribe();

    return () => {
      active = false;
      void db.removeChannel(channel);
    };
  }, [currentCompany.id]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(\`${'${PRIORITY_HOLD_KEY}'}:${'${currentCompany.id}'}\`) || '{}') as Record<string, number>;
`;
replaceOnce(queueAnchor, queueReplacement, 'supermarket realtime effect');

const priorityAnchor = `  const togglePriorityHold = (driver: Driver) => {
    setPriorityHolds((current) => {
      const next = { ...current };
      if (next[driver.id] != null) delete next[driver.id];
      else {
        const visibleIndex = availableDrivers.findIndex((item) => item.id === driver.id);
        if (visibleIndex < 0) return current;
        next[driver.id] = visibleIndex;
      }
      try { window.localStorage.setItem(\`${'${PRIORITY_HOLD_KEY}'}:${'${currentCompany.id}'}\`, JSON.stringify(next)); } catch { /* preference remains for this session */ }
      return next;
    });
  };

  const activeTrips = useMemo(() => {
`;

const priorityReplacement = `  const togglePriorityHold = (driver: Driver) => {
    setPriorityHolds((current) => {
      const next = { ...current };
      if (next[driver.id] != null) delete next[driver.id];
      else {
        const visibleIndex = availableDrivers.findIndex((item) => item.id === driver.id);
        if (visibleIndex < 0) return current;
        next[driver.id] = visibleIndex;
      }
      try { window.localStorage.setItem(\`${'${PRIORITY_HOLD_KEY}'}:${'${currentCompany.id}'}\`, JSON.stringify(next)); } catch { /* preference remains for this session */ }
      return next;
    });
  };

  const toggleSupermarketStatus = async (driver: Driver) => {
    if (supermarketBusyId) return;
    const nextValue = !supermarketDriverIds.has(driver.id);
    setSupermarketBusyId(driver.id);
    setSupermarketError('');
    setSupermarketDriverIds((current) => {
      const next = new Set(current);
      if (nextValue) next.add(driver.id);
      else next.delete(driver.id);
      return next;
    });

    try {
      const { error } = await requireSupabase().rpc('centralgo_operator_set_driver_supermarket', {
        p_driver_id: driver.id,
        p_at_supermarket: nextValue,
      });
      if (error) throw error;
    } catch (error) {
      setSupermarketDriverIds((current) => {
        const next = new Set(current);
        if (nextValue) next.delete(driver.id);
        else next.add(driver.id);
        return next;
      });
      setSupermarketError(error instanceof Error ? error.message : 'No fue posible actualizar el estado de supermercado.');
    } finally {
      setSupermarketBusyId(null);
    }
  };

  const activeTrips = useMemo(() => {
`;
replaceOnce(priorityAnchor, priorityReplacement, 'supermarket toggle');

replaceOnce(
  "              const vehicle = driver.vehicleId ? vehicleById.get(driver.vehicleId) : undefined;\n              return (\n",
  "              const vehicle = driver.vehicleId ? vehicleById.get(driver.vehicleId) : undefined;\n              const atSupermarket = supermarketDriverIds.has(driver.id);\n              return (\n",
  'row state',
);

const pinAnchor = `                    <button
                      type="button"
                      disabled={rowLocked}
                      aria-pressed={priorityHolds[driver.id] != null}
                      onClick={() => togglePriorityHold(driver)}
                      className={\`grid h-8 w-8 place-items-center rounded-lg border transition disabled:opacity-30 ${'${priorityHolds[driver.id] != null ? \'border-amber-300/50 bg-amber-400 text-zinc-950\' : \'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-amber-400/40 hover:text-amber-200\'}'}\`}
                      title={priorityHolds[driver.id] != null ? 'Prioridad fija: al reincorporar vuelve a este lugar de la fila' : 'Mantener esta posición de prioridad al reincorporar'}
                      aria-label={\`Mantener la posición de prioridad del móvil ${'${driver.unitNumber}'}\`}
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </button>
                  </span>
                  <GripVertical className={\`h-4 w-4 shrink-0 ${'${disconnected ? \'text-rose-400/35\' : (paused || inTrip) ? \'text-amber-400/30\' : \'text-zinc-700\'}'}\`} />
`;

const pinReplacement = `                    <button
                      type="button"
                      disabled={rowLocked}
                      aria-pressed={priorityHolds[driver.id] != null}
                      onClick={() => togglePriorityHold(driver)}
                      className={\`grid h-8 w-8 place-items-center rounded-lg border transition disabled:opacity-30 ${'${priorityHolds[driver.id] != null ? \'border-amber-300/50 bg-amber-400 text-zinc-950\' : \'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-amber-400/40 hover:text-amber-200\'}'}\`}
                      title={priorityHolds[driver.id] != null ? 'Prioridad fija: al reincorporar vuelve a este lugar de la fila' : 'Mantener esta posición de prioridad al reincorporar'}
                      aria-label={\`Mantener la posición de prioridad del móvil ${'${driver.unitNumber}'}\`}
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={supermarketBusyId === driver.id}
                      aria-pressed={atSupermarket}
                      onClick={() => void toggleSupermarketStatus(driver)}
                      className={\`grid h-8 w-8 place-items-center rounded-lg border transition disabled:opacity-50 ${'${atSupermarket ? \'border-amber-200/70 bg-amber-400 text-zinc-950 shadow-sm shadow-amber-500/20\' : \'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-amber-400/45 hover:text-amber-200\'}'}\`}
                      title={atSupermarket ? 'Móvil marcado EN SUPERMERCADO · toca para quitar' : 'Marcar este móvil como EN SUPERMERCADO'}
                      aria-label={\`${'${atSupermarket ? \'Quitar\' : \'Marcar\'}'} supermercado para el móvil ${'${driver.unitNumber}'}\`}
                    >
                      {supermarketBusyId === driver.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
                    </button>
                  </span>
                  <GripVertical className={\`h-4 w-4 shrink-0 ${'${disconnected ? \'text-rose-400/35\' : (paused || inTrip) ? \'text-amber-400/30\' : \'text-zinc-700\'}'}\`} />
`;
replaceOnce(pinAnchor, pinReplacement, 'cart button');

const tooltipAnchor = `                    <span className={\`mt-2 block border-t border-zinc-800 pt-2 text-[9px] font-black ${'${disconnected ? \'text-rose-300\' : (paused || inTrip) ? \'text-amber-300\' : \'text-emerald-300\'}'}\`}>● {disconnected ? 'DESCONECTADO' : paused ? 'PAUSA' : inTrip ? 'EN CARRERA' : DRIVER_STATUS_LABELS[driver.status]}</span>
                  </span>
`;
const tooltipReplacement = `                    <span className={\`mt-2 block border-t border-zinc-800 pt-2 text-[9px] font-black ${'${disconnected ? \'text-rose-300\' : (paused || inTrip) ? \'text-amber-300\' : \'text-emerald-300\'}'}\`}>● {disconnected ? 'DESCONECTADO' : paused ? 'PAUSA' : inTrip ? 'EN CARRERA' : DRIVER_STATUS_LABELS[driver.status]}</span>
                    {atSupermarket && <span className="mt-1 block rounded-md border border-amber-300/30 bg-amber-400/10 px-1.5 py-1 text-[8px] font-black text-amber-200">CARRITO · EN SUPERMERCADO</span>}
                  </span>
`;
replaceOnce(tooltipAnchor, tooltipReplacement, 'tooltip status');

const footerAnchor = `          <div className="flex items-center justify-between gap-2 rounded-b-2xl border-t border-zinc-800 bg-zinc-950/40 px-3 py-2 text-[8px] font-bold text-zinc-500">
            <span>En fila {queueDrivers.length} · Libres {availableDrivers.length}</span>
            <span>Sin app {noAppDriverCount}</span>
          </div>
`;
const footerReplacement = `          {supermarketError && <div className="border-t border-rose-500/20 bg-rose-500/[0.07] px-3 py-2 text-[8px] font-bold text-rose-200">{supermarketError}</div>}
          <div className="flex items-center justify-between gap-2 rounded-b-2xl border-t border-zinc-800 bg-zinc-950/40 px-3 py-2 text-[8px] font-bold text-zinc-500">
            <span>En fila {queueDrivers.length} · Libres {availableDrivers.length}</span>
            <span className="flex items-center gap-2"><span className="inline-flex items-center gap-1 text-amber-300"><ShoppingCart className="h-3 w-3" />{supermarketDriverIds.size}</span><span>Sin app {noAppDriverCount}</span></span>
          </div>
`;
replaceOnce(footerAnchor, footerReplacement, 'footer count');

fs.writeFileSync(path, text);
console.log('OperatorConsole supermarket status patch applied.');
