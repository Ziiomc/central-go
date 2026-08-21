import { useCallback, useEffect, useState } from 'react';

export type ColorTheme = 'light' | 'dark' | 'executive' | 'fire';

const STORAGE_KEY = 'centralgo:color-theme';
const THEME_EVENT = 'centralgo:theme-changed';
const THEMES: ColorTheme[] = ['light', 'dark', 'executive', 'fire'];

const isTheme = (value: string | null): value is ColorTheme => Boolean(value && THEMES.includes(value as ColorTheme));

const preferredTheme = (): ColorTheme => {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch { /* Use the system preference when private storage is blocked. */ }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

const applyTheme = (theme: ColorTheme) => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark';
  const themeColors: Record<ColorTheme, string> = {
    light: '#dfe7ec',
    dark: '#071321',
    executive: '#292b2e',
    fire: '#090706',
  };
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[theme]);
};

export const useColorTheme = () => {
  const [theme, setThemeState] = useState<ColorTheme>(preferredTheme);

  useEffect(() => {
    applyTheme(theme);
    try { window.localStorage.setItem(STORAGE_KEY, theme); }
    catch { /* Theme remains active for the current session. */ }
  }, [theme]);

  useEffect(() => {
    const syncTheme = (event: Event) => {
      const next = (event as CustomEvent<ColorTheme>).detail;
      if (isTheme(next)) setThemeState(next);
    };
    const syncStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && isTheme(event.newValue)) setThemeState(event.newValue);
    };
    window.addEventListener(THEME_EVENT, syncTheme);
    window.addEventListener('storage', syncStorage);
    return () => {
      window.removeEventListener(THEME_EVENT, syncTheme);
      window.removeEventListener('storage', syncStorage);
    };
  }, []);

  const selectTheme = useCallback((nextTheme: ColorTheme) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    try { window.localStorage.setItem(STORAGE_KEY, nextTheme); } catch {}
    window.dispatchEvent(new CustomEvent<ColorTheme>(THEME_EVENT, { detail: nextTheme }));
  }, []);

  const toggleTheme = useCallback(() => {
    const current = isTheme(document.documentElement.dataset.theme ?? null) ? document.documentElement.dataset.theme as ColorTheme : preferredTheme();
    selectTheme(THEMES[(THEMES.indexOf(current) + 1) % THEMES.length]);
  }, [selectTheme]);

  return { theme, setTheme: selectTheme, toggleTheme, themes: THEMES };
};
