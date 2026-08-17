const SEARCH_SELECTOR = 'input[placeholder^="Buscar carrera"]';

const findOperatorSearch = () => document.querySelector<HTMLInputElement>(SEARCH_SELECTOR);

const isEditableTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
};

const focusOperatorSearch = () => {
  const input = findOperatorSearch();
  if (!input) return false;

  input.focus({ preventScroll: false });
  input.select();
  input.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  return true;
};

const updateShortcutHint = () => {
  document.querySelectorAll<HTMLElement>('kbd').forEach(kbd => {
    const text = kbd.textContent?.replace(/\s+/g, ' ').trim().toLowerCase();
    if (text !== 'ctrl k' && text !== 'alt k') return;

    if (text !== 'alt k') kbd.textContent = 'Alt K';
    if (kbd.title !== 'Buscar en Central GO · Alt + K o /') kbd.title = 'Buscar en Central GO · Alt + K o /';
    if (kbd.getAttribute('aria-label') !== 'Atajo de búsqueda Alt K') kbd.setAttribute('aria-label', 'Atajo de búsqueda Alt K');
    if (kbd.style.cursor !== 'pointer') kbd.style.cursor = 'pointer';
  });
};

export const registerOperatorSearchShortcut = () => {
  const handleKeyDown = (event: KeyboardEvent) => {
    const isK = event.code === 'KeyK' || event.key.toLowerCase() === 'k';
    const ctrlOrMetaK = (event.ctrlKey || event.metaKey) && isK && !event.altKey;
    const altK = event.altKey && isK && !event.ctrlKey && !event.metaKey;
    const slash = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && !isEditableTarget(event.target);

    if (!ctrlOrMetaK && !altK && !slash) return;
    if (!findOperatorSearch()) return;

    event.preventDefault();
    event.stopPropagation();
    focusOperatorSearch();
  };

  const handleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const shortcut = target?.closest('kbd');
    if (!shortcut) return;

    const text = shortcut.textContent?.replace(/\s+/g, ' ').trim().toLowerCase();
    if (text !== 'ctrl k' && text !== 'alt k') return;
    if (!findOperatorSearch()) return;

    event.preventDefault();
    focusOperatorSearch();
  };

  // A single global capture listener is enough and avoids duplicate handling.
  window.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('click', handleClick, true);

  // React can mount the console after bootstrap. Use bounded retries instead of a MutationObserver
  // so the shortcut hint can never create a self-triggering DOM mutation loop.
  [0, 250, 1000, 2500].forEach(delay => window.setTimeout(updateShortcutHint, delay));
};
