import { useCallback, useEffect, useState } from 'react';

export type ColorTheme = 'light' | 'dark';

const STORAGE_KEY = 'centralgo:color-theme';

const preferredTheme = (): ColorTheme => {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

const applyTheme = (theme: ColorTheme) => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
};

export const useColorTheme = () => {
  const [theme, setTheme] = useState<ColorTheme>(preferredTheme);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => current === 'dark' ? 'light' : 'dark');
  }, []);

  return { theme, toggleTheme };
};

