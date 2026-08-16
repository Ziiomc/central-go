type LocateDriverDetail = {
  driverId?: string;
  unitNumber?: string;
  name?: string;
};

const LOCATE_DRIVER_EVENT = 'centralgo:locate-driver';
const BOOT_FLAG = '__centralGoOperatorQueueUsability';

const normalize = (value: string | null | undefined) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const compactRoleForHeader = (label: string) => {
  const text = normalize(label);
  if (text === 'hora') return 'time';
  if (text === 'cliente') return 'client';
  if (text.includes('direccion inicial') || text === 'origen') return 'origin';
  if (text === 'destino') return 'destination';
  if (text.includes('movil')) return 'driver';
  if (text === 'estado') return 'status';
  if (text === 'valor') return 'fare';
  if (text === 'acciones') return 'actions';
  return '';
};

const markCompactDispatchTables = () => {
  const tables = Array.from(document.querySelectorAll<HTMLTableElement>('.cg-operator-workspace table'));

  tables.forEach((table) => {
    const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th'));
    const labels = headers.map((header) => normalize(header.textContent));
    const isDispatchTable =
      labels.includes('hora') &&
      labels.includes('cliente') &&
      labels.some((label) => label.includes('direccion inicial')) &&
      labels.includes('acciones');

    if (!isDispatchTable) return;

    table.classList.add('cg-compact-dispatch-table');
    table.parentElement?.classList.add('cg-compact-dispatch-scroll');

    const roles = headers.map((header) => compactRoleForHeader(header.textContent ?? ''));
    headers.forEach((header, index) => {
      const role = roles[index];
      if (role) header.dataset.cgCompactRole = role;
      else delete header.dataset.cgCompactRole;
    });

    table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row) => {
      Array.from(row.children).forEach((cell, index) => {
        if (!(cell instanceof HTMLTableCellElement)) return;
        const role = roles[index];
        if (role) cell.dataset.cgCompactRole = role;
        else delete cell.dataset.cgCompactRole;
      });
    });
  });
};

const findControlSection = () => {
  const heading = Array.from(document.querySelectorAll<HTMLHeadingElement>('.cg-operator-workspace h2'))
    .find((element) => normalize(element.textContent) === 'control de moviles');
  return heading?.closest('section') ?? null;
};

const clickDriverInControlTable = (unitNumber: string) => {
  const section = findControlSection();
  if (!section) return false;

  const wanted = normalize(unitNumber);
  const driverButton = Array.from(section.querySelectorAll<HTMLButtonElement>('tbody td:nth-child(2) button'))
    .find((button) => {
      const text = normalize(button.textContent);
      return text.startsWith(`${wanted} ·`) || text.startsWith(`${wanted} `) || text === wanted;
    });

  if (!driverButton) return false;
  driverButton.click();
  return true;
};

const revealAllDrivers = () => {
  const section = findControlSection();
  if (!section) return;
  const allButton = Array.from(section.querySelectorAll<HTMLButtonElement>('button'))
    .find((button) => /^todos\s+\d+/i.test((button.textContent ?? '').trim()));
  allButton?.click();
};

const locateDriverFromQueue = (detail: LocateDriverDetail) => {
  const unitNumber = detail.unitNumber?.trim();
  if (!unitNumber) return;

  if (clickDriverInControlTable(unitNumber)) return;

  revealAllDrivers();
  window.setTimeout(() => {
    if (clickDriverInControlTable(unitNumber)) return;
    window.setTimeout(() => clickDriverInControlTable(unitNumber), 160);
  }, 50);
};

export const registerOperatorQueueUsability = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const scopedWindow = window as Window & { [BOOT_FLAG]?: boolean };
  if (scopedWindow[BOOT_FLAG]) return;
  scopedWindow[BOOT_FLAG] = true;

  window.addEventListener(LOCATE_DRIVER_EVENT, ((event: Event) => {
    locateDriverFromQueue((event as CustomEvent<LocateDriverDetail>).detail ?? {});
  }) as EventListener);

  let frame = 0;
  const scheduleMark = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      markCompactDispatchTables();
    });
  };

  const observer = new MutationObserver(scheduleMark);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('pageshow', scheduleMark);
  window.addEventListener('resize', scheduleMark);
  scheduleMark();
};
