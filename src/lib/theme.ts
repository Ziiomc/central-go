import { useCallback, useEffect, useState } from 'react';

export type ColorTheme = 'light' | 'dark';

const STORAGE_KEY = 'centralgo:color-theme';

const preferredTheme = (): ColorTheme => {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* Use the system preference when private storage is blocked. */ }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

const applyTheme = (theme: ColorTheme) => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#e7f0f9' : '#0b2340');
};

export const useColorTheme = () => {
  const [theme, setTheme] = useState<ColorTheme>(preferredTheme);

  useEffect(() => {
    applyTheme(theme);
    try { window.localStorage.setItem(STORAGE_KEY, theme); }
    catch { /* Theme remains active for the current session. */ }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => current === 'dark' ? 'light' : 'dark');
  }, []);

  return { theme, toggleTheme };
};
