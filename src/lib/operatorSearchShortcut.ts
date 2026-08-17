const findOperatorSearch = () => document.querySelector<HTMLInputElement>('input[placeholder^="Buscar carrera"]');

const focusOperatorSearch = () => {
  const input = findOperatorSearch();
  if (!input) return false;
  input.focus({ preventScroll: false });
  input.select();
  input.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  return true;
};

export const registerOperatorSearchShortcut = () => {
  const handleKeyDown = (event: KeyboardEvent) => {
    const modifier = event.ctrlKey || event.metaKey;
    const isK = event.code === 'KeyK' || event.key.toLowerCase() === 'k';
    if (!modifier || !isK || event.altKey) return;

    if (!findOperatorSearch()) return;
    event.preventDefault();
    event.stopPropagation();
    focusOperatorSearch();
  };

  const handleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const shortcut = target?.closest('kbd');
    if (!shortcut || shortcut.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() !== 'ctrl k') return;
    if (!findOperatorSearch()) return;
    event.preventDefault();
    focusOperatorSearch();
  };

  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('click', handleClick, true);
};
