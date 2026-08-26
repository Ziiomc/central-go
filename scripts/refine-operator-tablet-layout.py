from pathlib import Path

path = Path('src/components/modules/OperatorConsole.tsx')
text = path.read_text()
replacements = [
    (
        'className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"',
        'className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center"',
    ),
    (
        'className="min-w-0 sm:flex-1"',
        'className="min-w-0 lg:flex-1"',
    ),
    (
        'className="relative w-full sm:min-w-[220px] sm:flex-[0_1_340px]"',
        'className="relative w-full lg:min-w-[220px] lg:flex-[0_1_340px]"',
    ),
    (
        'className="flex h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-black text-zinc-950 sm:h-10 sm:w-auto"',
        'className="flex h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-black text-zinc-950 lg:h-10 lg:w-auto"',
    ),
]
for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected exactly one tablet layout pattern, found {count}: {old}')
    text = text.replace(old, new, 1)
path.write_text(text)

report = Path('reporte_mejoras_aplicadas.md')
r = report.read_text()
marker = '| Consola móvil de despacho | Diseño UX | Reorganizados título, chips, búsqueda y CTA para apilarse sin solapamiento en móvil. | VERIFICADO POR BUILD; PENDIENTE CAPTURA PROD |'
replacement = '| Consola móvil/tablet de despacho | Diseño UX | Reorganizados título, métricas, búsqueda y CTA: apilado hasta tablet y fila compacta solo en escritorio amplio, evitando compresión del título. | VERIFICADO POR BUILD; PENDIENTE CAPTURA PROD |'
if marker not in r:
    raise SystemExit('report marker for mobile/tablet layout was not found')
report.write_text(r.replace(marker, replacement, 1))
print('Tablet dispatch layout refinement applied')
