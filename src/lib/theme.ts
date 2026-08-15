import { useCallback, useEffect, useState } from 'react';

export type ColorTheme = 'light' | 'dark' | 'executive' | 'fire';

const STORAGE_KEY = 'centralgo:color-theme';
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
    light: '#eef4f8',
    dark: '#071321',
    executive: '#292b2e',
    fire: '#090706',
  };
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[theme]);
};

export const useColorTheme = () => {
  const [theme, setTheme] = useState<ColorTheme>(preferredTheme);

  useEffect(() => {
    applyTheme(theme);
    try { window.localStorage.setItem(STORAGE_KEY, theme); }
    catch { /* Theme remains active for the current session. */ }
  }, [theme]);

  const selectTheme = useCallback((nextTheme: ColorTheme) => setTheme(nextTheme), []);
  const toggleTheme = useCallback(() => {
    setTheme((current) => THEMES[(THEMES.indexOf(current) + 1) % THEMES.length]);
  }, []);

  return { theme, setTheme: selectTheme, toggleTheme, themes: THEMES };
};
