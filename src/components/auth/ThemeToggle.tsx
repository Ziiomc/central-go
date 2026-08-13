import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useColorTheme } from '../../lib/theme';

export const ThemeToggle: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { theme, toggleTheme } = useColorTheme();
  const nextLabel = theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="cg-theme-toggle"
      aria-label={nextLabel}
      title={nextLabel}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {!compact && <span>{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>}
    </button>
  );
};
