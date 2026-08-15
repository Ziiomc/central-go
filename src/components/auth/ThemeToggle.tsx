import React, { useState } from 'react';
import { Check, ChevronDown, Flame, Moon, Sun, Crown } from 'lucide-react';
import { type ColorTheme, useColorTheme } from '../../lib/theme';

const themeOptions: Array<{ id: ColorTheme; label: string; description: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'light', label: 'Claro', description: 'Máxima claridad visual', icon: Sun },
  { id: 'dark', label: 'Oscuro', description: 'Azul profundo y moderno', icon: Moon },
  { id: 'executive', label: 'Ejecutivo', description: 'Gris sobrio y profesional', icon: Crown },
  { id: 'fire', label: 'Fuego', description: 'Negro con acentos naranja', icon: Flame },
];

export const ThemeToggle: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { theme, setTheme } = useColorTheme();
  const [open, setOpen] = useState(false);
  const active = themeOptions.find((option) => option.id === theme) ?? themeOptions[0];
  const ActiveIcon = active.icon;

  return (
    <div className="cg-theme-menu-wrap">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="cg-theme-toggle"
        aria-label="Cambiar modo de color"
        title={`Modo ${active.label}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <ActiveIcon className="h-4 w-4" />
        {!compact && <span>{active.label}</span>}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="cg-theme-menu" role="menu" aria-label="Cambiar modo de color">
          <div className="cg-theme-menu-heading">Cambiar modo</div>
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const selected = option.id === theme;
            return (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className="cg-theme-option"
                data-theme-option={option.id}
                data-selected={selected}
                onClick={() => { setTheme(option.id); setOpen(false); }}
              >
                <span className="cg-theme-option-icon"><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1 text-left">
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
                {selected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
