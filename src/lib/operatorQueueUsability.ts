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

const compactStatusLabel = (value: string) => {
  const text = normalize(value);
  if (text === 'pasajero a bordo') return 'A bordo';
  if (text === 'movil en camino') return 'En camino';
  if (text === 'movil llego') return 'En origen';
  if (text === 'asignado') return 'Asignado';
  if (text === 'pendiente') return 'Pendiente';
  if (text === 'finalizado') return 'Finalizado';
  if (text === 'cancelado') return 'Cancelado';
  return value.trim();
};

const firstTextNode = (element: HTMLElement) =>
  Array.from(element.childNodes).find((node) => node.nodeType === Node.TEXT_NODE) as Text | undefined;

const ensureCompactAddressSummary = (row: HTMLTableRowElement) => {
  const clientCell = row.querySelector<HTMLTableCellElement>("td[data-cg-compact-role='client']");
  const originCell = row.querySelector<HTMLTableCellElement>("td[data-cg-compact-role='origin']");
  if (!clientCell || !originCell) return;

  const originText = originCell.querySelector('p')?.textContent?.trim() || originCell.textContent?.trim() || '';
  if (!originText) return;

  let summary = clientCell.querySelector<HTMLElement>('[data-cg-primary-origin]');
  if (!summary) {
    summary = document.createElement('div');
    summary.dataset.cgPrimaryOrigin = 'true';
    summary.style.display = 'flex';
    summary.style.alignItems = 'center';
    summary.style.gap = '5px';
    summary.style.minWidth = '0';
    summary.style.marginBottom = '3px';
    summary.style.color = '#f4f4f5';
    summary.style.fontSize = '12px';
    summary.style.fontWeight = '900';
    summary.style.lineHeight = '1.15';
    clientCell.prepend(summary);
  }

  summary.textContent = `📍 ${originText}`;
  summary.title = originText;
  summary.style.whiteSpace = 'nowrap';
  summary.style.overflow = 'hidden';
  summary.style.textOverflow = 'ellipsis';

  const clientName = Array.from(clientCell.querySelectorAll('p')).find((node) => node !== summary);
  if (clientName) {
    clientName.style.fontSize = '9px';
    clientName.style.fontWeight = '700';
    clientName.style.color = '#a1a1aa';
    clientName.style.lineHeight = '1.1';
  }

  // The address is now always visible in the main scan column. Keep the original
  // origin cell as a semantic source but remove it from the compact visual grid.
  originCell.style.display = 'none';
};

const polishCompactRow = (row: HTMLTableRowElement) => {
  const timeCell = row.querySelector<HTMLTableCellElement>("td[data-cg-compact-role='time']");
  if (timeCell) {
    const textNode = firstTextNode(timeCell);
    const match = timeCell.textContent?.match(/\b(\d{1,2}:\d{2})\b/);
    if (textNode && match && textNode.data.trim() !== match[1]) textNode.data = match[1];
  }

  const clientCell = row.querySelector<HTMLTableCellElement>("td[data-cg-compact-role='client']");
  const phone = clientCell?.querySelectorAll('p')?.[1];
  if (phone && normalize(phone.textContent) === 'sin telefono') phone.textContent = 'Sin número';

  ensureCompactAddressSummary(row);

  const statusCell = row.querySelector<HTMLTableCellElement>("td[data-cg-compact-role='status']");
  const statusBadge = statusCell?.querySelector<HTMLElement>('span');
  if (statusBadge) {
    const fullLabel = statusBadge.dataset.cgFullStatus || statusBadge.textContent?.trim() || '';
    if (!statusBadge.dataset.cgFullStatus) statusBadge.dataset.cgFullStatus = fullLabel;
    const shortLabel = compactStatusLabel(fullLabel);
    if (statusBadge.textContent?.trim() !== shortLabel) statusBadge.textContent = shortLabel;
    if (fullLabel && statusBadge.title !== fullLabel) statusBadge.title = fullLabel;
  }
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
      polishCompactRow(row);
    });
  });
};

const polishVisualDispatchCards = () => {
  const queueHeading = Array.from(document.querySelectorAll<HTMLHeadingElement>('.cg-operator-workspace h2'))
    .find((element) => normalize(element.textContent) === 'cola de despacho');
  const queuePanel = queueHeading?.closest('div.flex.min-h-0.flex-col');
  if (!queuePanel) return;

  queuePanel.querySelectorAll<HTMLElement>('article').forEach((article) => {
    const mainButton = article.querySelector<HTMLButtonElement>(':scope > button:first-child');
    if (!mainButton) return;

    const directDivs = Array.from(mainButton.children).filter((element): element is HTMLElement => element instanceof HTMLElement && element.tagName === 'DIV');
    const clientName = directDivs[1];
    const routeBlock = directDivs[2];
    const originRow = routeBlock?.querySelector<HTMLElement>('span:first-child');
    const originText = originRow?.querySelector<HTMLElement>('span:last-child');

    if (clientName) {
      clientName.style.fontSize = '9px';
      clientName.style.fontWeight = '700';
      clientName.style.color = '#a1a1aa';
      clientName.style.marginTop = '2px';
    }
    if (originRow) {
      originRow.style.fontSize = '13px';
      originRow.style.fontWeight = '900';
      originRow.style.lineHeight = '1.2';
      originRow.style.color = '#f4f4f5';
      originRow.style.marginTop = '4px';
      originRow.style.marginBottom = '3px';
    }
    if (originText) {
      originText.style.overflow = 'hidden';
      originText.style.textOverflow = 'ellipsis';
      originText.style.whiteSpace = 'nowrap';
    }
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
      polishVisualDispatchCards();
    });
  };

  const observer = new MutationObserver(scheduleMark);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('pageshow', scheduleMark);
  window.addEventListener('resize', scheduleMark);
  scheduleMark();
};
