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

    kbd.textContent = 'Alt K';
    kbd.title = 'Buscar en Central GO · Alt + K o /';
    kbd.setAttribute('aria-label', 'Atajo de búsqueda Alt K');
    kbd.style.cursor = 'pointer';
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
    event.stopImmediatePropagation();
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

  // Capture phase gives the app the first chance for shortcuts that are actually delivered by the browser.
  window.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('click', handleClick, true);

  // React may mount/rerender the console after this bootstrap runs, so keep the visible hint synchronized.
  const observer = new MutationObserver(() => updateShortcutHint());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(updateShortcutHint, 0);
};
