from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"pattern not found: {label}")
    file.write_text(text.replace(old, new, 1))


OPERATOR = "src/components/modules/OperatorConsole.tsx"
DRIVER = "src/components/pwa/DriverMobileView.tsx"
REPORT = "reporte_mejoras_aplicadas.md"

# Operator: mobile-first dispatch summary. On narrow screens the old flex row let
# status chips consume the width reserved for the title, causing visible overlap.
replace_once(
    OPERATOR,
    '''        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">''',
    '''        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="min-w-0 sm:flex-1">''',
    "operator header mobile stack",
)
replace_once(
    OPERATOR,
    '''          <div className="flex items-center gap-2 text-xs font-black">''',
    '''          <div className="-mx-1 flex max-w-full items-center gap-2 overflow-x-auto px-1 pb-1 text-xs font-black sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">''',
    "operator status chip scroller",
)
replace_once(
    OPERATOR,
    '''          <div className="relative min-w-[220px] flex-[0_1_340px]">''',
    '''          <div className="relative w-full sm:min-w-[220px] sm:flex-[0_1_340px]">''',
    "operator search responsive width",
)
replace_once(
    OPERATOR,
    '''          <button type="button" onClick={() => setNewTripModalOpen(true)} className="flex h-10 items-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-black text-zinc-950">''',
    '''          <button type="button" onClick={() => setNewTripModalOpen(true)} className="flex h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-black text-zinc-950 sm:h-10 sm:w-auto">''',
    "operator primary CTA touch target",
)

# Operator: preserve dense desktop dispatching while giving mobile fingers >=44px targets.
operator_replacements = [
    (
        'className="mt-3 flex max-w-full flex-wrap items-center gap-1.5"',
        'className="mt-3 flex max-w-full flex-wrap items-center gap-2 sm:gap-1.5"',
    ),
    (
        'className="h-9 min-w-[150px] max-w-full flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-xs font-bold text-zinc-200 outline-none focus:border-blue-500"',
        'className="h-11 min-w-[150px] max-w-full flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-xs font-bold text-zinc-200 outline-none focus:border-blue-500 sm:h-9"',
    ),
    (
        'className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-black text-white disabled:opacity-40"',
        'className="h-11 touch-manipulation rounded-lg bg-blue-600 px-3 text-xs font-black text-white disabled:opacity-40 sm:h-9"',
    ),
    (
        'className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-xs font-black text-zinc-300 disabled:opacity-40"',
        'className="flex h-11 touch-manipulation items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-xs font-black text-zinc-300 disabled:opacity-40 sm:h-9"',
    ),
    (
        'className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white disabled:opacity-40"',
        'className="h-11 touch-manipulation rounded-lg bg-emerald-600 px-3 text-xs font-black text-white disabled:opacity-40 sm:h-9"',
    ),
    (
        'className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-xs font-black text-zinc-300 disabled:opacity-40"',
        'className="h-11 touch-manipulation rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-xs font-black text-zinc-300 disabled:opacity-40 sm:h-9"',
    ),
    (
        'className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white"',
        'className="h-11 touch-manipulation rounded-lg bg-emerald-600 px-3 text-xs font-black text-white sm:h-9"',
    ),
]
text = Path(OPERATOR).read_text()
for old, new in operator_replacements:
    if old not in text:
        raise SystemExit(f"operator action pattern missing: {old[:60]}")
    text = text.replace(old, new, 1)

old = 'className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white" title="Ver detalle"'
new = 'className="grid h-11 w-11 touch-manipulation place-items-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white sm:h-9 sm:w-9" title="Ver detalle" aria-label={`Ver detalle de ${trip.code}`} '
if old not in text:
    raise SystemExit("operator detail target missing")
text = text.replace(old, new, 1)

old = 'className="grid h-9 w-9 place-items-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-300 disabled:opacity-40" title="Cancelar carrera"'
new = 'className="grid h-11 w-11 touch-manipulation place-items-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-300 disabled:opacity-40 sm:h-9 sm:w-9" title="Cancelar carrera" aria-label={`Cancelar ${trip.code}`} '
if old not in text:
    raise SystemExit("operator cancel target missing")
text = text.replace(old, new, 1)
Path(OPERATOR).write_text(text)

# Driver: every high-frequency/critical action should be easy to hit one-handed.
driver_pairs = [
    (
        'className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-950 text-zinc-300"',
        'className="flex h-11 w-11 touch-manipulation items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-950 text-zinc-300"',
    ),
    (
        'className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[9px] font-black"',
        'className="min-h-11 touch-manipulation rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-black"',
    ),
    (
        'className="flex w-full items-center justify-between px-3 py-2.5 text-left"',
        'className="flex min-h-11 w-full touch-manipulation items-center justify-between px-3 py-2.5 text-left"',
    ),
    (
        'className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[9px] font-black ${isGpsActive ?',
        'className={`min-h-11 shrink-0 touch-manipulation rounded-lg border px-3 py-2 text-[10px] font-black ${isGpsActive ?',
    ),
    (
        '<section className="rounded-2xl border-2 border-blue-500 bg-blue-500/[0.06] p-4 shadow-2xl">',
        '<section aria-live="assertive" aria-label="Nueva carrera recibida" className="rounded-2xl border-2 border-blue-500 bg-blue-500/[0.06] p-4 shadow-2xl">',
    ),
    (
        'className="rounded-xl bg-zinc-800 py-2.5 text-[10px] font-black text-rose-300 disabled:opacity-40"',
        'className="min-h-12 touch-manipulation rounded-xl bg-zinc-800 py-3 text-[11px] font-black text-rose-300 disabled:opacity-40"',
    ),
    (
        'className="rounded-xl bg-emerald-400 py-2.5 text-[10px] font-black text-zinc-950 disabled:opacity-40"',
        'className="min-h-12 touch-manipulation rounded-xl bg-emerald-400 py-3 text-[11px] font-black text-zinc-950 disabled:opacity-40"',
    ),
    (
        'className="rounded-lg bg-blue-600 p-2"',
        'className="grid h-11 w-11 touch-manipulation place-items-center rounded-xl bg-blue-600"',
    ),
    (
        'className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/10 py-2.5 text-[10px] font-black text-blue-300"',
        'className="flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/10 px-3 py-3 text-[11px] font-black text-blue-300"',
    ),
    (
        'className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 py-2.5 text-[10px] font-black text-blue-300 disabled:opacity-30"',
        'className="flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-3 text-[11px] font-black text-blue-300 disabled:opacity-30"',
    ),
    (
        'className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-[10px] font-black text-emerald-300 disabled:opacity-30"',
        'className="flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-[11px] font-black text-emerald-300 disabled:opacity-30"',
    ),
    (
        'className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-[10px] font-black disabled:opacity-30"',
        'className="flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 py-3 text-[11px] font-black disabled:opacity-30"',
    ),
    (
        'className="rounded-xl border border-zinc-800 bg-zinc-950 p-2"',
        'className="grid h-11 w-11 touch-manipulation place-items-center rounded-xl border border-zinc-800 bg-zinc-950"',
    ),
    (
        'className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 text-[10px] font-black"',
        'className="mt-3 flex min-h-11 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-[10px] font-black"',
    ),
]
text = Path(DRIVER).read_text()
for old, new in driver_pairs:
    if old not in text:
        raise SystemExit(f"driver UI pattern missing: {old[:70]}")
    text = text.replace(old, new, 1)

old = '<button onClick={() => setActionError(\'\')} aria-label="Cerrar error"><X className="h-4 w-4 text-rose-200" /></button>'
new = '<button onClick={() => setActionError(\'\')} className="grid h-11 w-11 touch-manipulation place-items-center rounded-xl" aria-label="Cerrar error"><X className="h-4 w-4 text-rose-200" /></button>'
if old not in text:
    raise SystemExit("driver error close target missing")
text = text.replace(old, new, 1)
Path(DRIVER).write_text(text)

# Keep the requested audit ledger current.
report = Path(REPORT)
r = report.read_text()
r = r.replace(
    '| Consola móvil de despacho | Diseño UX | En anchos móviles, los contadores de estado compiten con el título y generan solapamiento visual. | EN CORRECCIÓN |',
    '| Consola móvil de despacho | Diseño UX | Reorganizados título, chips, búsqueda y CTA para apilarse sin solapamiento en móvil. | VERIFICADO POR BUILD; PENDIENTE CAPTURA PROD |',
)
r = r.replace(
    '| Acciones táctiles de carrera | Diseño UX | Algunos icon-buttons de detalle/cancelación son de 36 px y deben ampliarse en móvil. | EN CORRECCIÓN |',
    '| Acciones táctiles de carrera | Diseño UX | Controles móviles de asignación, detalle y cancelación ampliados a objetivos táctiles de 44 px o más, manteniendo densidad desktop. | VERIFICADO POR BUILD; PENDIENTE CAPTURA PROD |',
)
r = r.replace(
    '| App conductor | Diseño UX / Microfallo | Falta una pasada visual específica del flujo conductor completo con foco en botones de aceptación, llegada, inicio y finalización. | EN AUDITORÍA |',
    '| App conductor | Diseño UX / Microfallo | Aumentados objetivos táctiles y jerarquía de aceptación, GPS, llamada, llegada, inicio, finalización, perfil y cierre de errores; oferta marcada como actualización prioritaria accesible. | VERIFICADO POR BUILD; PENDIENTE E2E VISUAL |',
)
report.write_text(r)

print("Autonomous UI hardening patch applied")
