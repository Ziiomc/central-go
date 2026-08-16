export type FontSizeMode = 'normal' | 'large' | 'xlarge';

export const FONT_SIZE_STORAGE_KEY = 'central-go-font-size';

export const FONT_SIZE_OPTIONS: Array<{ value: FontSizeMode; label: string; shortLabel: string; description: string }> = [
  { value: 'normal', label: 'Normal', shortLabel: 'A', description: 'Tamaño equilibrado para escritorio y tablet.' },
  { value: 'large', label: 'Grande', shortLabel: 'A+', description: 'Mejora la lectura de textos pequeños sin agrandar toda la interfaz.' },
  { value: 'xlarge', label: 'Muy grande', shortLabel: 'A++', description: 'Máxima legibilidad para operación a distancia o pantallas pequeñas.' },
];

export const readFontSizeMode = (): FontSizeMode => {
  if (typeof window === 'undefined') return 'normal';
  try {
    const saved = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    return saved === 'large' || saved === 'xlarge' ? saved : 'normal';
  } catch {
    return 'normal';
  }
};

export const applyFontSizeMode = (mode: FontSizeMode, persist = true) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.cgFontSize = mode;
  if (!persist || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, mode);
  } catch {
    // The preference remains active for the current session when storage is unavailable.
  }
};

export const initializeFontSizePreference = () => {
  applyFontSizeMode(readFontSizeMode(), false);
};
